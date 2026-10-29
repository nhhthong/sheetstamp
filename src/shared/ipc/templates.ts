// IPC channels of the "templates" feature (template library) and the groups they belong to.
import {
  arrayOf,
  type Channel,
  channel,
  IpcValidationError,
  isRecord,
  nothing,
  record,
  string,
} from "./define";

export type TemplateKind = "word" | "image";

/** One row of the library list. */
export type TemplateSummary = {
  id: string;
  name: string;
  kind: TemplateKind;
  groupId: string;
  groupName: string;
  note: string;
  sourceFileName: string;
  tagCount: number;
  createdAt: string;
  lastUsedAt: string | null;
};

export type TemplateDetail = TemplateSummary & {
  tags: { name: string; label: string }[];
  filenamePattern: string;
};

export type GroupInfo = { id: string; name: string };

/** A tag found in a chosen file, with the label suggested for it. Unsupported tags have no label. */
export type FoundTag = { key: string; raw: string; kind: "field" | "unsupported"; label: string };

export type ParsedFile = { fileName: string; tags: FoundTag[] };

/** A background image that passed the checks. `large`: above 4 megapixels, accepted with a warning. */
export type ParsedImage = { fileName: string; width: number; height: number; large: boolean };

/** A box that a replacement background would cut. `partly`: some of it stays on the image; `outside`: none. */
export type OutsideBox = { id: string; field: string; label: string; fit: "partly" | "outside" };

/** What replacing an image template's background would do to its boxes, computed in main from the stored layout. */
export type ImageReplacePreview = ParsedImage & { boxCount: number; outside: OutsideBox[] };

/** Same as `UpdateRequest` without labels (an image template's fields come from its boxes). */
export type UpdateImageRequest = Omit<UpdateRequest, "labels">;

export type CreateImageRequest = { path: string; name: string; groupId: string; note: string };

/** Failures the user can fix are returned, not thrown, so the dialog can show the message inline. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

export type CreateRequest = {
  path: string;
  name: string;
  groupId: string;
  note: string;
  /** Display label per tag key; keys not found in the file are ignored. */
  labels: Record<string, string>;
};

/** What replacing a template's file would change, computed in main from the stored tags and the new file. */
export type ReplacePreview = {
  fileName: string;
  /** Fields of the new file that the template does not have yet; their labels are suggestions. */
  added: { key: string; label: string }[];
  /** Tags of the template that the new file no longer has. */
  removed: string[];
  /** Tags present in both. */
  kept: string[];
  /** Removed tags that had a saved mapping entry; the entry is dropped when the file is replaced. */
  removedMapped: string[];
  /** Number of kept tags that have a saved mapping entry (their mapping stays). */
  keptMapped: number;
  /** Loop marks and footnote tags in the new file (not supported, not filled). */
  unsupported: FoundTag[];
};

export type UpdateRequest = {
  id: string;
  name: string;
  groupId: string;
  note: string;
  filenamePattern: string;
  /** Display label per tag key; keys the template will not have are ignored. */
  labels: Record<string, string>;
  /** New source file; null keeps the current one. Tags are read from it in main. */
  replacePath: string | null;
};

export type PatternCheckRequest = { pattern: string; keys: string[] };

/** Largest source file accepted, in bytes. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const MAX_PATH = 4096;
const MAX_LABELS = 1000;

const parsePath = (value: unknown): { path: string } => ({
  path: string(record(value).path, "path", { min: 1, max: MAX_PATH }),
});
const parseId = (value: unknown): { id: string } => ({
  id: string(record(value).id, "id", { min: 1, max: 200 }),
});

function parseLabels(value: unknown): Record<string, string> {
  if (!isRecord(value)) throw new IpcValidationError("labels must be an object");
  const keys = Object.keys(value);
  if (keys.length > MAX_LABELS) throw new IpcValidationError("labels has too many entries");
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = string(value[key], "label", { max: 500 });
  return out;
}

export const list: Channel<undefined, TemplateSummary[]> = channel("templates:list", nothing);
export const get: Channel<{ id: string }, TemplateDetail | null> = channel(
  "templates:get",
  parseId,
);
export const remove: Channel<{ id: string }, void> = channel("templates:delete", parseId);
export const chooseFile: Channel<undefined, string | null> = channel(
  "templates:choose-file",
  nothing,
);
export const parseFile: Channel<{ path: string }, Outcome<ParsedFile>> = channel(
  "templates:parse-file",
  parsePath,
);
export const create: Channel<CreateRequest, Outcome<{ id: string }>> = channel(
  "templates:create",
  (value) => {
    const r = record(value);
    return {
      path: parsePath(r).path,
      name: string(r.name, "name", { min: 1, max: 200 }),
      groupId: string(r.groupId, "groupId", { min: 1, max: 200 }),
      note: string(r.note, "note", { max: 2000 }),
      labels: parseLabels(r.labels),
    };
  },
);
export const chooseImage: Channel<undefined, string | null> = channel(
  "templates:choose-image",
  nothing,
);
export const parseImage: Channel<{ path: string }, Outcome<ParsedImage>> = channel(
  "templates:parse-image",
  parsePath,
);
export const createImage: Channel<CreateImageRequest, Outcome<{ id: string }>> = channel(
  "templates:create-image",
  (value) => {
    const r = record(value);
    return {
      path: parsePath(r).path,
      name: string(r.name, "name", { min: 1, max: 200 }),
      groupId: string(r.groupId, "groupId", { min: 1, max: 200 }),
      note: string(r.note, "note", { max: 2000 }),
    };
  },
);
export const imageReplacePreview: Channel<
  { id: string; path: string },
  Outcome<ImageReplacePreview>
> = channel("templates:image-replace-preview", (value) => ({
  id: parseId(value).id,
  path: parsePath(value).path,
}));
export const updateImage: Channel<UpdateImageRequest, Outcome<{ id: string }>> = channel(
  "templates:update-image",
  (value) => {
    const r = record(value);
    return {
      id: parseId(r).id,
      name: string(r.name, "name", { min: 1, max: 200 }),
      groupId: string(r.groupId, "groupId", { min: 1, max: 200 }),
      note: string(r.note, "note", { max: 2000 }),
      filenamePattern: string(r.filenamePattern, "filenamePattern", { max: 500 }),
      replacePath: r.replacePath === null ? null : parsePath({ path: r.replacePath }).path,
    };
  },
);
export const groupsList: Channel<undefined, GroupInfo[]> = channel("groups:list", nothing);
export const groupsCreate: Channel<{ name: string }, Outcome<GroupInfo>> = channel(
  "groups:create",
  (value) => ({ name: string(record(value).name, "name", { min: 1, max: 200 }) }),
);

export const replacePreview: Channel<
  { id: string; path: string },
  Outcome<ReplacePreview>
> = channel("templates:replace-preview", (value) => ({
  id: parseId(value).id,
  path: parsePath(value).path,
}));
export const update: Channel<UpdateRequest, Outcome<{ id: string }>> = channel(
  "templates:update",
  (value) => {
    const r = record(value);
    const replacePath = r.replacePath === null ? null : parsePath({ path: r.replacePath }).path;
    return {
      id: parseId(r).id,
      name: string(r.name, "name", { min: 1, max: 200 }),
      groupId: string(r.groupId, "groupId", { min: 1, max: 200 }),
      note: string(r.note, "note", { max: 2000 }),
      filenamePattern: string(r.filenamePattern, "filenamePattern", { max: 500 }),
      labels: parseLabels(r.labels),
      replacePath,
    };
  },
);
/** Advisory check for inline messages while typing; saving checks again against the stored tags. */
export const checkPattern: Channel<PatternCheckRequest, string[]> = channel(
  "templates:check-pattern",
  (value) => {
    const r = record(value);
    return {
      pattern: string(r.pattern, "pattern", { max: 500 }),
      keys: arrayOf(r.keys, "keys", (k) => string(k, "key", { min: 1, max: 500 }), MAX_LABELS),
    };
  },
);
export const groupsRename: Channel<{ id: string; name: string }, Outcome<GroupInfo>> = channel(
  "groups:rename",
  (value) => ({
    id: parseId(value).id,
    name: string(record(value).name, "name", { min: 1, max: 200 }),
  }),
);
/** Deleting a group moves its templates to "Chưa phân nhóm"; `moved` is how many. */
export const groupsDelete: Channel<{ id: string }, Outcome<{ moved: number }>> = channel(
  "groups:delete",
  parseId,
);

export const channels = [
  list,
  get,
  remove,
  chooseFile,
  parseFile,
  create,
  chooseImage,
  parseImage,
  createImage,
  imageReplacePreview,
  updateImage,
  groupsList,
  groupsCreate,
  replacePreview,
  update,
  checkPattern,
  groupsRename,
  groupsDelete,
] as const;
export const events = [] as const;
