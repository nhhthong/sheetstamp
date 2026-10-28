// IPC channels of the "templates" feature (template library) and the groups they belong to.
import {
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
};

export type GroupInfo = { id: string; name: string };

/** A tag found in a chosen file, with the label suggested for it. Unsupported tags have no label. */
export type FoundTag = { key: string; raw: string; kind: "field" | "unsupported"; label: string };

export type ParsedFile = { fileName: string; tags: FoundTag[] };

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
export const groupsList: Channel<undefined, GroupInfo[]> = channel("groups:list", nothing);
export const groupsCreate: Channel<{ name: string }, Outcome<GroupInfo>> = channel(
  "groups:create",
  (value) => ({ name: string(record(value).name, "name", { min: 1, max: 200 }) }),
);

export const channels = [
  list,
  get,
  remove,
  chooseFile,
  parseFile,
  create,
  groupsList,
  groupsCreate,
] as const;
export const events = [] as const;
