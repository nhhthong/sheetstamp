// Editing a saved template: fields, replacing the Word file, groups. Pure Node: the storage is passed in.

import type { FoundTag } from "../../shared/ipc/templates";
import {
  type GroupInfo,
  type Outcome,
  type ReplacePreview,
  type UpdateRequest,
} from "../../shared/ipc/templates";
import { validatePattern } from "../export/filename";
import { reconcile } from "../mapping";
import {
  type MappingEntry,
  type MappingProfile,
  type Storage,
  StorageError,
  type Template,
  UNGROUPED_ID,
  UNGROUPED_NAME,
} from "../storage";
import { fail, messages, parseFile } from "./library";

export const editMessages = {
  notFound: "Không tìm thấy mẫu này. Có thể mẫu đã bị xóa.",
  groupNotFound: "Nhóm không tồn tại. Có thể nhóm đã bị xóa.",
  groupEmpty: "Nhập tên nhóm.",
  groupReserved: `Tên “${UNGROUPED_NAME}” dành cho mẫu không có nhóm. Đặt tên khác.`,
  groupDuplicate: "Đã có nhóm tên này. Đặt tên khác.",
  patternEmpty: "Nhập mẫu tên file, ví dụ {{ten}}.",
  patternPath: "Mẫu tên file không được chứa / \\ hoặc ..",
  patternUnknown: (key: string) => `{{${key}}} không có trong mẫu này.`,
} as const;

/** Inline messages for a filename pattern, checked against the template's tag keys. */
export function patternMessages(pattern: string, keys: readonly string[]): string[] {
  const out = validatePattern(pattern, keys).map((problem) => {
    if (problem.kind === "empty") return editMessages.patternEmpty;
    if (problem.kind === "path-characters") return editMessages.patternPath;
    return editMessages.patternUnknown(problem.key);
  });
  return [...new Set(out)];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isWrapped = (v: unknown): v is { version: 1; fields: Record<string, MappingEntry> } =>
  isObject(v) && v.version === 1 && isObject(v.fields);

/**
 * The saved mapping as per-tag entries. Accepts the bare record and the `{ version, fields }` wrapper of
 * `src/main/mapping`; `wrapMapping` puts entries back in the shape that was found.
 */
function mappingFields(mapping: unknown): Record<string, MappingEntry> {
  if (isWrapped(mapping)) return mapping.fields;
  return isObject(mapping) ? (mapping as Record<string, MappingEntry>) : {};
}
const wrapMapping = (original: unknown, fields: Record<string, MappingEntry>): MappingProfile =>
  (isWrapped(original) ? { ...original, fields } : fields) as MappingProfile;

type Diff = {
  fileName: string;
  fields: FoundTag[];
  unsupported: FoundTag[];
  added: FoundTag[];
  removed: string[];
  kept: string[];
  removedMapped: string[];
  keptMapped: number;
};

async function diffAgainst(template: Template, path: string): Promise<Outcome<Diff>> {
  const parsed = await parseFile(path);
  if (!parsed.ok) return parsed;
  const fields = parsed.value.tags.filter((t) => t.kind === "field");
  const unsupported = parsed.value.tags.filter((t) => t.kind === "unsupported");
  const have = new Set(template.tags.map((t) => t.name));
  const now = new Set(fields.map((t) => t.key));
  const mapped = mappingFields(template.mapping);
  const names = template.tags.map((t) => t.name);
  const removed = names.filter((k) => !now.has(k));
  const kept = names.filter((k) => now.has(k));
  return {
    ok: true,
    value: {
      fileName: parsed.value.fileName,
      fields,
      unsupported,
      added: fields.filter((t) => !have.has(t.key)),
      removed,
      kept,
      removedMapped: removed.filter((k) => Object.hasOwn(mapped, k)),
      keptMapped: kept.filter((k) => Object.hasOwn(mapped, k)).length,
    },
  };
}

export async function replacePreview(
  storage: Storage,
  id: string,
  path: string,
): Promise<Outcome<ReplacePreview>> {
  const template = await storage.getTemplate(id);
  if (!template) return fail(editMessages.notFound);
  const diff = await diffAgainst(template, path);
  if (!diff.ok) return diff;
  const d = diff.value;
  return {
    ok: true,
    value: {
      fileName: d.fileName,
      added: d.added.map((t) => ({ key: t.key, label: t.label })),
      removed: d.removed,
      kept: d.kept,
      removedMapped: d.removedMapped,
      keptMapped: d.keptMapped,
      unsupported: d.unsupported,
    },
  };
}

/** Mapping after a file replacement: kept tags keep their entry, removed tags lose it, new tags stay unmatched. */
function reconcileMapping(template: Template, tagNames: readonly string[]): MappingProfile {
  const entries = mappingFields(template.mapping);
  const stay = new Set(tagNames);
  // Only columns of tags that stay count as present, so no column freed by a removed tag is auto-assigned.
  const columns = Object.entries(entries).flatMap(([tag, entry]) =>
    entry.kind === "column" && stay.has(tag) ? [entry.column] : [],
  );
  const result = reconcile(
    { version: 1, fields: entries },
    tagNames.map((key) => ({ key })),
    columns,
  );
  return wrapMapping(template.mapping, result.profile.fields as Record<string, MappingEntry>);
}

export async function updateTemplate(
  storage: Storage,
  request: UpdateRequest,
): Promise<Outcome<{ id: string }>> {
  const template = await storage.getTemplate(request.id);
  if (!template) return fail(editMessages.notFound);
  const name = request.name.trim();
  if (name === "") return fail(messages.emptyName);
  if (
    request.groupId !== UNGROUPED_ID &&
    !(await storage.listGroups()).some((g) => g.id === request.groupId)
  ) {
    return fail(messages.noGroup);
  }

  // Tags come from the new file when it is replaced, else from the stored template; never from the renderer.
  let tags = template.tags;
  let mapping = template.mapping;
  if (request.replacePath !== null) {
    const diff = await diffAgainst(template, request.replacePath);
    if (!diff.ok) return diff;
    const labelOf = new Map(template.tags.map((t) => [t.name, t.label]));
    tags = diff.value.fields.map((t) => ({
      name: t.key,
      label: request.labels[t.key]?.trim() || labelOf.get(t.key) || t.label,
    }));
    mapping = reconcileMapping(
      template,
      tags.map((t) => t.name),
    );
  } else {
    tags = template.tags.map((t) => ({
      name: t.name,
      label: request.labels[t.name]?.trim() || t.label,
    }));
  }

  const problems = patternMessages(
    request.filenamePattern,
    tags.map((t) => t.name),
  );
  if (problems.length > 0) return fail(problems.join(" "));

  const before = {
    name: template.name,
    groupId: template.groupId,
    note: template.note,
    tags: template.tags,
    filenamePattern: template.filenamePattern,
    mapping: template.mapping,
  };
  try {
    await storage.updateTemplate(request.id, {
      name,
      groupId: request.groupId,
      note: request.note.trim(),
      tags,
      filenamePattern: request.filenamePattern,
      mapping,
    });
  } catch (error) {
    if (error instanceof StorageError && error.code === "invalid") return fail(error.message);
    return fail(messages.saveFailed);
  }
  if (request.replacePath !== null) {
    try {
      await storage.replaceSource(request.id, request.replacePath);
    } catch {
      // The new file could not be stored: put the old record back so nothing changes.
      await storage.updateTemplate(request.id, before).catch(() => {});
      return fail(messages.saveFailed);
    }
  }
  return { ok: true, value: { id: request.id } };
}

const groupKey = (name: string) => name.trim().normalize("NFC").toLocaleLowerCase();

/** Shared by create and rename: not empty, not the reserved name, unique ignoring case. */
async function checkGroupName(
  storage: Storage,
  name: string,
  selfId: string | null,
): Promise<string | null> {
  if (name.trim() === "") return editMessages.groupEmpty;
  if (groupKey(name) === groupKey(UNGROUPED_NAME)) return editMessages.groupReserved;
  const clash = (await storage.listGroups()).some(
    (g) => g.id !== selfId && groupKey(g.name) === groupKey(name),
  );
  return clash ? editMessages.groupDuplicate : null;
}

export async function createGroup(storage: Storage, name: string): Promise<Outcome<GroupInfo>> {
  const problem = await checkGroupName(storage, name, null);
  if (problem) return fail(problem);
  try {
    return { ok: true, value: await storage.createGroup(name) };
  } catch {
    return fail(messages.saveFailed);
  }
}

export async function renameGroup(
  storage: Storage,
  id: string,
  name: string,
): Promise<Outcome<GroupInfo>> {
  if (!(await storage.listGroups()).some((g) => g.id === id)) {
    return fail(editMessages.groupNotFound);
  }
  const problem = await checkGroupName(storage, name, id);
  if (problem) return fail(problem);
  try {
    return { ok: true, value: await storage.renameGroup(id, name) };
  } catch {
    return fail(messages.saveFailed);
  }
}

export async function deleteGroup(
  storage: Storage,
  id: string,
): Promise<Outcome<{ moved: number }>> {
  if (!(await storage.listGroups()).some((g) => g.id === id)) {
    return fail(editMessages.groupNotFound);
  }
  const moved = (await storage.listTemplates()).filter((t) => t.groupId === id).length;
  try {
    await storage.deleteGroup(id);
    return { ok: true, value: { moved } };
  } catch {
    return fail(messages.saveFailed);
  }
}
