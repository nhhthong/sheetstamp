import { randomUUID } from "node:crypto";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { sweepTempFiles } from "./atomic";
import { Collection, type Migration } from "./collection";
import {
  type Choices,
  DEFAULT_CHOICES,
  DEFAULT_FILENAME_PATTERN,
  DEFAULT_GROUP_NAMES,
  type Group,
  type NewTemplate,
  SCHEMA_VERSION,
  type Storage,
  StorageError,
  type StorageWarning,
  type Template,
  type TemplatePatch,
  UNGROUPED_ID,
} from "./types";

export * from "./types";

export interface OpenOptions {
  /** Replaces `fs.rename`; lets tests simulate a crash between temp write and rename. */
  rename?: (from: string, to: string) => Promise<void>;
  /** Migrations per file name, keyed by the version they upgrade from. */
  migrations?: Record<string, Record<number, Migration>>;
  now?: () => Date;
  /** Version the app writes (default `SCHEMA_VERSION`); tests raise it to exercise migrations. */
  schemaVersion?: number;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isTemplate = (v: unknown): boolean =>
  isObject(v) &&
  typeof v.id === "string" &&
  typeof v.name === "string" &&
  (v.kind === "word" || v.kind === "image") &&
  typeof v.groupId === "string" &&
  typeof v.note === "string" &&
  typeof v.sourceFileName === "string" &&
  typeof v.sourceCopy === "string" &&
  Array.isArray(v.tags) &&
  typeof v.filenamePattern === "string" &&
  isObject(v.mapping) &&
  typeof v.createdAt === "string";

const isTemplates = (v: unknown): v is Template[] => Array.isArray(v) && v.every(isTemplate);
const isGroups = (v: unknown): v is Group[] =>
  Array.isArray(v) &&
  v.every((g) => isObject(g) && typeof g.id === "string" && typeof g.name === "string");
const isChoices = (v: unknown): v is Choices =>
  isObject(v) &&
  (v.lastOutputFolder === null || typeof v.lastOutputFolder === "string") &&
  (v.lastGroupFilter === null || typeof v.lastGroupFilter === "string") &&
  typeof v.removeDiacritics === "boolean";

function requireName(name: unknown): string {
  if (typeof name !== "string" || name.trim() === "") {
    throw new StorageError("invalid", "Tên không được để trống.");
  }
  return name.trim();
}

/** Only letters and digits survive, so the stored copy's name can never escape the folder. */
function safeExtension(fileName: string): string {
  return path
    .extname(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 8);
}

/**
 * Opens (or creates) the store in `folder`. Throws `StorageError("newer-schema")` when a file was written
 * by a newer app; never overwrites it. Corrupt files are moved to `.bak` and reported in `warnings`.
 */
export async function openStorage(folder: string, options: OpenOptions = {}): Promise<Storage> {
  const rename = options.rename ?? fsp.rename;
  const now = options.now ?? (() => new Date());
  const warnings: StorageWarning[] = [];
  const sourcesDir = path.join(folder, "sources");
  await fsp.mkdir(sourcesDir, { recursive: true });
  await sweepTempFiles(folder);
  await sweepTempFiles(sourcesDir);

  const common = { folder, rename, warnings, version: options.schemaVersion ?? SCHEMA_VERSION };
  const migrations = options.migrations ?? {};
  const templates = await Collection.open<Template[]>({
    ...common,
    file: "templates.json",
    empty: () => [],
    isValid: isTemplates,
    migrations: migrations["templates.json"] ?? {},
  });
  const groups = await Collection.open<Group[]>({
    ...common,
    file: "groups.json",
    empty: () => DEFAULT_GROUP_NAMES.map((name) => ({ id: randomUUID(), name })),
    isValid: isGroups,
    migrations: migrations["groups.json"] ?? {},
  });
  const choices = await Collection.open<Choices>({
    ...common,
    file: "choices.json",
    empty: () => ({ ...DEFAULT_CHOICES }),
    isValid: isChoices,
    migrations: migrations["choices.json"] ?? {},
  });

  // A first run writes the default groups so their ids stay stable; templates pointing at a group that
  // no longer exists (for example groups.json was moved aside) fall back to "Chưa phân nhóm".
  if (
    !(await fsp.access(path.join(folder, "groups.json")).then(
      () => true,
      () => false,
    ))
  ) {
    await groups.mutate(() => {});
  }
  const known = new Set([UNGROUPED_ID, ...groups.get().map((g) => g.id)]);
  if (templates.get().some((t) => !known.has(t.groupId))) {
    await templates.mutate((draft) => {
      for (const t of draft) if (!known.has(t.groupId)) t.groupId = UNGROUPED_ID;
    });
  }

  // Every public mutation runs through one chain, so multi-file operations (delete group, create with
  // a copied file) cannot interleave with each other.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <R>(fn: () => Promise<R>): Promise<R> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };

  const find = (id: string): Template => {
    const t = templates.get().find((x) => x.id === id);
    if (!t) throw new StorageError("not-found", "Không tìm thấy mẫu.");
    return t;
  };
  const checkGroup = (id: string) => {
    if (id !== UNGROUPED_ID && !groups.get().some((g) => g.id === id)) {
      throw new StorageError("invalid", "Nhóm không tồn tại.");
    }
  };
  const absolute = (relative: string) => path.join(folder, relative);

  /** Copies the file to `sources/<id><ext>` through a temp name, so a half copy is never a source. */
  async function copySource(id: string, sourcePath: string): Promise<string> {
    const relative = path.posix.join("sources", `${id}${safeExtension(sourcePath)}`);
    const tmp = `${absolute(relative)}.${randomUUID()}.tmp`;
    try {
      await fsp.copyFile(sourcePath, tmp);
      await rename(tmp, absolute(relative));
    } catch (error) {
      await fsp.rm(tmp, { force: true }).catch(() => {});
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("not-found", "Không tìm thấy file mẫu để sao chép.");
      }
      throw error;
    }
    return relative;
  }

  const store: Storage = {
    warnings,

    async listTemplates() {
      await templates.settled();
      return structuredClone(templates.get());
    },
    async getTemplate(id) {
      await templates.settled();
      const t = templates.get().find((x) => x.id === id);
      return t && structuredClone(t);
    },

    createTemplate: (input: NewTemplate) =>
      serial(async () => {
        const name = requireName(input.name);
        if (input.kind !== "word" && input.kind !== "image") {
          throw new StorageError("invalid", "Loại mẫu không hợp lệ.");
        }
        const groupId = input.groupId ?? UNGROUPED_ID;
        checkGroup(groupId);
        const id = randomUUID();
        const sourceCopy = await copySource(id, input.sourcePath);
        const template: Template = {
          id,
          name,
          kind: input.kind,
          groupId,
          note: input.note ?? "",
          sourceFileName: path.basename(input.sourcePath),
          sourceCopy,
          tags: input.tags ?? [],
          filenamePattern: input.filenamePattern ?? DEFAULT_FILENAME_PATTERN,
          mapping: input.mapping ?? {},
          ...(input.imageLayout === undefined ? {} : { imageLayout: input.imageLayout }),
          createdAt: now().toISOString(),
          lastUsedAt: null,
        };
        try {
          await templates.mutate((draft) => {
            draft.push(template);
          });
        } catch (error) {
          await fsp.rm(absolute(sourceCopy), { force: true }).catch(() => {});
          throw error;
        }
        return structuredClone(template);
      }),

    updateTemplate: (id: string, patch: TemplatePatch) =>
      serial(async () => {
        find(id);
        if (patch.name !== undefined) patch = { ...patch, name: requireName(patch.name) };
        if (patch.groupId !== undefined) checkGroup(patch.groupId);
        return templates.mutate((draft) => {
          const t = draft.find((x) => x.id === id) as Template;
          Object.assign(t, patch);
          return structuredClone(t);
        });
      }),

    replaceSource: (id: string, sourcePath: string) =>
      serial(async () => {
        const old = find(id);
        const sourceCopy = await copySource(id, sourcePath);
        let updated: Template;
        try {
          updated = await templates.mutate((draft) => {
            const t = draft.find((x) => x.id === id) as Template;
            t.sourceCopy = sourceCopy;
            t.sourceFileName = path.basename(sourcePath);
            return structuredClone(t);
          });
        } catch (error) {
          if (sourceCopy !== old.sourceCopy) {
            await fsp.rm(absolute(sourceCopy), { force: true }).catch(() => {});
          }
          throw error;
        }
        if (old.sourceCopy !== sourceCopy) {
          await fsp.rm(absolute(old.sourceCopy), { force: true }).catch(() => {});
        }
        return updated;
      }),

    markUsed: (id: string) =>
      serial(async () => {
        find(id);
        return templates.mutate((draft) => {
          const t = draft.find((x) => x.id === id) as Template;
          t.lastUsedAt = now().toISOString();
          return structuredClone(t);
        });
      }),

    deleteTemplate: (id: string) =>
      serial(async () => {
        const t = find(id);
        await templates.mutate((draft) => {
          draft.splice(
            draft.findIndex((x) => x.id === id),
            1,
          );
        });
        await fsp.rm(absolute(t.sourceCopy), { force: true });
      }),

    async readSource(id) {
      await templates.settled();
      return fsp.readFile(absolute(find(id).sourceCopy));
    },

    async listGroups() {
      await groups.settled();
      return structuredClone(groups.get());
    },
    createGroup: (name: string) =>
      serial(async () => {
        const group: Group = { id: randomUUID(), name: requireName(name) };
        await groups.mutate((draft) => {
          draft.push(group);
        });
        return { ...group };
      }),
    renameGroup: (id: string, name: string) =>
      serial(async () => {
        const clean = requireName(name);
        if (!groups.get().some((g) => g.id === id)) {
          throw new StorageError("not-found", "Nhóm không tồn tại.");
        }
        return groups.mutate((draft) => {
          const g = draft.find((x) => x.id === id) as Group;
          g.name = clean;
          return { ...g };
        });
      }),
    deleteGroup: (id: string) =>
      serial(async () => {
        if (!groups.get().some((g) => g.id === id)) {
          throw new StorageError("not-found", "Nhóm không tồn tại.");
        }
        // Templates first: a failure between the two writes leaves an empty group, never an orphan.
        await templates.mutate((draft) => {
          for (const t of draft) if (t.groupId === id) t.groupId = UNGROUPED_ID;
        });
        await groups.mutate((draft) => {
          draft.splice(
            draft.findIndex((x) => x.id === id),
            1,
          );
        });
        if (choices.get().lastGroupFilter === id) {
          await choices.mutate((draft) => {
            draft.lastGroupFilter = null;
          });
        }
      }),

    async getChoices() {
      await choices.settled();
      return { ...choices.get() };
    },
    setChoices: (patch: Partial<Choices>) =>
      serial(() =>
        choices.mutate((draft) => {
          if (patch.lastOutputFolder !== undefined) draft.lastOutputFolder = patch.lastOutputFolder;
          if (patch.lastGroupFilter !== undefined) draft.lastGroupFilter = patch.lastGroupFilter;
          if (patch.removeDiacritics !== undefined) draft.removeDiacritics = patch.removeDiacritics;
          return { ...draft };
        }),
      ),
  };
  return store;
}
