/** Stored shapes and the `Storage` interface (ADR 0001). No Electron imports: the data folder is passed in. */

export const SCHEMA_VERSION = 1;

/** Fixed id of the virtual group that holds templates whose group was deleted. */
export const UNGROUPED_ID = "ungrouped";
export const UNGROUPED_NAME = "Chưa phân nhóm";
export const DEFAULT_GROUP_NAMES = ["Hợp đồng", "Nghỉ việc", "Tài liệu khác"] as const;
export const DEFAULT_FILENAME_PATTERN = "{{ten}}";

export type TemplateKind = "word" | "image";

export interface TemplateTag {
  /** Tag as written in the document, without braces: `ten`. */
  name: string;
  /** Display label shown instead of the raw tag: `Tên`. */
  label: string;
}

/**
 * One mapping decision per tag. It names a column header (never a cell value); `fixed` holds text the user
 * typed in the app, not text taken from an imported file.
 */
export type MappingEntry =
  | { kind: "column"; column: string }
  | { kind: "fixed"; text: string }
  | { kind: "empty" };

export type MappingProfile = Record<string, MappingEntry>;

export interface Template {
  id: string;
  name: string;
  kind: TemplateKind;
  groupId: string;
  note: string;
  /** Original file name, for display. */
  sourceFileName: string;
  /** Path of the stored copy, relative to the data folder: `sources/<id>-<uuid>.<ext>` (a new name per replacement). */
  sourceCopy: string;
  tags: TemplateTag[];
  filenamePattern: string;
  mapping: MappingProfile;
  /** Image templates only: text boxes. Opaque to storage; the image-template ticket owns its shape. */
  imageLayout?: unknown;
  /** ISO 8601 dates. */
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Group {
  id: string;
  name: string;
}

export interface Choices {
  lastOutputFolder: string | null;
  /** Group id, or null for "Tất cả". */
  lastGroupFilter: string | null;
  removeDiacritics: boolean;
}

export const DEFAULT_CHOICES: Choices = {
  lastOutputFolder: null,
  lastGroupFilter: null,
  removeDiacritics: false,
};

/** Fields the caller sets when creating a template; the rest is generated. */
export interface NewTemplate {
  name: string;
  kind: TemplateKind;
  groupId?: string;
  note?: string;
  tags?: TemplateTag[];
  filenamePattern?: string;
  mapping?: MappingProfile;
  imageLayout?: unknown;
  /** The file to store, already read by the caller: the bytes that were checked are the bytes that are saved. */
  source: SourceFile;
}

export interface SourceFile {
  bytes: Uint8Array;
  /** Original file name for display; only its extension is used for the stored copy. */
  fileName: string;
}

export type TemplatePatch = Partial<
  Pick<
    Template,
    "name" | "groupId" | "note" | "tags" | "filenamePattern" | "mapping" | "imageLayout"
  >
>;

export interface StorageWarning {
  /** `corrupt-file`: the file was moved aside. `invalid-record`: bad records were skipped and the original was copied aside. */
  code: "corrupt-file" | "invalid-record";
  /** Collection file name, e.g. `templates.json`. */
  file: string;
  /** Where the original file went, e.g. `templates.json.bak` or `templates.json.bak.2`. */
  movedTo: string;
  /** Vietnamese message for the user. */
  message: string;
}

export type StorageErrorCode =
  | "newer-schema"
  | "io"
  | "not-found"
  | "invalid"
  | "duplicate"
  | "reserved";

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly file?: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export interface Storage {
  /** Problems found while opening. Empty on a clean start. */
  readonly warnings: readonly StorageWarning[];

  listTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  /** Stores the bytes in the data folder, then saves the record. */
  createTemplate(input: NewTemplate): Promise<Template>;
  /**
   * One mutation. `patch` may be a function of the freshest record (it runs inside the storage queue, so it
   * never works from a stale read). With `source`, the file is replaced together with the patch: the new copy
   * gets a new name, the record is committed, and only then the old copy is deleted, so a failure at any point
   * leaves the old record and the old file intact.
   */
  updateTemplate(
    id: string,
    patch: TemplatePatch | ((current: Template) => TemplatePatch),
    source?: SourceFile,
  ): Promise<Template>;
  /**
   * Changes only the mapping, inside the storage queue. `change` gets the current mapping and returns the new
   * one, or `null` for no change (nothing is written). It may throw to refuse; the error propagates.
   */
  patchMapping(
    id: string,
    change: (mapping: MappingProfile, template: Template) => MappingProfile | null,
  ): Promise<Template>;
  /** Sets `lastUsedAt` to now. */
  markUsed(id: string): Promise<Template>;
  /** Removes the record, its stored copy and its mapping profile. */
  deleteTemplate(id: string): Promise<void>;
  /** Bytes of the stored copy. */
  readSource(id: string): Promise<Buffer>;

  /** Stored groups in order. The virtual "Chưa phân nhóm" group is not listed (see `UNGROUPED_ID`). */
  listGroups(): Promise<Group[]>;
  /** Rejects with `invalid` (empty), `reserved` ("Chưa phân nhóm") or `duplicate` (same name, ignoring case). */
  createGroup(name: string): Promise<Group>;
  /** Same rejections as `createGroup`, plus `not-found`. */
  renameGroup(id: string, name: string): Promise<Group>;
  /** Rejects with `not-found` when the group is gone. Moves the group's templates to `UNGROUPED_ID`; resolves with how many were moved. */
  deleteGroup(id: string): Promise<{ moved: number }>;

  getChoices(): Promise<Choices>;
  setChoices(patch: Partial<Choices>): Promise<Choices>;
}
