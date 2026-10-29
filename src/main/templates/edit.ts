// Editing a saved template: fields, replacing the Word file, groups. Pure Node: the storage is passed in.

import { lazy } from "../../shared/i18n";
import type { FoundTag } from "../../shared/ipc/templates";
import {
  type GroupInfo,
  type Outcome,
  type ReplacePreview,
  type UpdateRequest,
} from "../../shared/ipc/templates";
import { validatePattern } from "../export/filename";
import { reconcile, toProfile, toRecord } from "../mapping";
import {
  type MappingProfile as MappingRecord,
  type Storage,
  StorageError,
  type Template,
  UNGROUPED_ID,
  ungroupedName,
} from "../storage";
import { fail, messages, readSource, tagsOf } from "./library";

export const editMessages = lazy(
  {
    notFound: "Không tìm thấy mẫu này. Có thể mẫu đã bị xóa.",
    groupNotFound: "Nhóm không tồn tại. Có thể nhóm đã bị xóa.",
    groupEmpty: "Nhập tên nhóm.",
    get groupReserved() {
      return `Tên “${ungroupedName()}” dành cho mẫu không có nhóm. Đặt tên khác.`;
    },
    groupDuplicate: "Đã có nhóm tên này. Đặt tên khác.",
    patternEmpty: "Nhập mẫu tên file, ví dụ {{ten}}.",
    patternPath: "Mẫu tên file không được chứa / \\ hoặc ..",
    patternUnknown: (key: string) => `{{${key}}} không có trong mẫu này.`,
  },
  {
    notFound: "This template was not found. It may have been deleted.",
    groupNotFound: "The group does not exist. It may have been deleted.",
    groupEmpty: "Enter a group name.",
    get groupReserved() {
      return `The name “${ungroupedName()}” is for templates without a group. Use another name.`;
    },
    groupDuplicate: "A group with this name already exists. Use another name.",
    patternEmpty: "Enter a file name pattern, for example {{ten}}.",
    patternPath: "The file name pattern cannot contain / \\ or ..",
    patternUnknown: (key: string) => `{{${key}}} is not in this template.`,
  },
);

/** Inline messages for a filename pattern, checked against the template's tag keys. */
export function patternMessages(pattern: string, keys: readonly string[]): string[] {
  const out = validatePattern(pattern, keys).map((problem) => {
    if (problem.kind === "empty") return editMessages.patternEmpty;
    if (problem.kind === "path-characters") return editMessages.patternPath;
    return editMessages.patternUnknown(problem.key);
  });
  return [...new Set(out)];
}

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

function diffAgainst(template: Template, fileName: string, tags: FoundTag[]): Diff {
  const fields = tags.filter((t) => t.kind === "field");
  const unsupported = tags.filter((t) => t.kind === "unsupported");
  const have = new Set(template.tags.map((t) => t.name));
  const now = new Set(fields.map((t) => t.key));
  const mapped = toRecord(toProfile(template.mapping));
  const names = template.tags.map((t) => t.name);
  const removed = names.filter((k) => !now.has(k));
  const kept = names.filter((k) => now.has(k));
  return {
    fileName,
    fields,
    unsupported,
    added: fields.filter((t) => !have.has(t.key)),
    removed,
    kept,
    removedMapped: removed.filter((k) => Object.hasOwn(mapped, k)),
    keptMapped: kept.filter((k) => Object.hasOwn(mapped, k)).length,
  };
}

/** Reads the chosen file once and parses those bytes. */
async function readAndParse(path: string) {
  const source = await readSource(path);
  if (!source.ok) return source;
  const tags = await tagsOf(source.value.bytes);
  if (!tags.ok) return tags;
  return { ok: true as const, value: { ...source.value, tags: tags.value } };
}

export async function replacePreview(
  storage: Storage,
  id: string,
  path: string,
): Promise<Outcome<ReplacePreview>> {
  const template = await storage.getTemplate(id);
  if (!template) return fail(editMessages.notFound);
  const parsed = await readAndParse(path);
  if (!parsed.ok) return parsed;
  const d = diffAgainst(template, parsed.value.fileName, parsed.value.tags);
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
function reconcileMapping(template: Template, tagNames: readonly string[]): MappingRecord {
  const profile = toProfile(template.mapping);
  const stay = new Set(tagNames);
  // Only columns of tags that stay count as present, so no column freed by a removed tag is auto-assigned.
  const columns = Object.entries(profile.fields).flatMap(([tag, entry]) =>
    entry.kind === "column" && stay.has(tag) ? [entry.column] : [],
  );
  const result = reconcile(
    profile,
    tagNames.map((key) => ({ key })),
    columns,
  );
  return toRecord(result.profile);
}

export async function updateTemplate(
  storage: Storage,
  request: UpdateRequest,
): Promise<Outcome<{ id: string }>> {
  if (!(await storage.getTemplate(request.id))) return fail(editMessages.notFound);
  const name = request.name.trim();
  if (name === "") return fail(messages.emptyName);
  if (
    request.groupId !== UNGROUPED_ID &&
    !(await storage.listGroups()).some((g) => g.id === request.groupId)
  ) {
    return fail(messages.noGroup);
  }

  // The new file is read once; the tags that are checked and the bytes that are stored come from the same read.
  const replacement = request.replacePath === null ? null : await readAndParse(request.replacePath);
  if (replacement && !replacement.ok) return replacement;
  const fresh = replacement?.value;

  // Computed inside the storage queue from the freshest record, so a concurrent mapping change is never overwritten.
  const patchFor = (template: Template) => {
    const fields = fresh ? diffAgainst(template, fresh.fileName, fresh.tags).fields : null;
    const labelOf = new Map(template.tags.map((t) => [t.name, t.label]));
    // Tags come from the new file when it is replaced, else from the stored template; never from the renderer.
    const tags = fields
      ? fields.map((t) => ({
          name: t.key,
          label: request.labels[t.key]?.trim() || labelOf.get(t.key) || t.label,
        }))
      : template.tags.map((t) => ({
          name: t.name,
          label: request.labels[t.name]?.trim() || t.label,
        }));
    const problems = patternMessages(
      request.filenamePattern,
      tags.map((t) => t.name),
    );
    if (problems.length > 0) throw new StorageError("invalid", problems.join(" "));
    return {
      name,
      groupId: request.groupId,
      note: request.note.trim(),
      tags,
      filenamePattern: request.filenamePattern,
      ...(fields
        ? {
            mapping: reconcileMapping(
              template,
              tags.map((t) => t.name),
            ),
          }
        : {}),
    };
  };
  try {
    await storage.updateTemplate(
      request.id,
      patchFor,
      fresh ? { bytes: fresh.bytes, fileName: fresh.fileName } : undefined,
    );
  } catch (error) {
    if (error instanceof StorageError) {
      if (error.code === "not-found") return fail(editMessages.notFound);
      if (error.code === "invalid") return fail(error.message);
    }
    return fail(messages.saveFailed);
  }
  return { ok: true, value: { id: request.id } };
}

/** Group rules live in the storage (inside its queue); this only turns their error codes into messages. */
function groupProblem(error: unknown): string {
  if (error instanceof StorageError) {
    if (error.code === "invalid") return editMessages.groupEmpty;
    if (error.code === "reserved") return editMessages.groupReserved;
    if (error.code === "duplicate") return editMessages.groupDuplicate;
    if (error.code === "not-found") return editMessages.groupNotFound;
  }
  return messages.saveFailed;
}

export async function createGroup(storage: Storage, name: string): Promise<Outcome<GroupInfo>> {
  try {
    return { ok: true, value: await storage.createGroup(name) };
  } catch (error) {
    return fail(groupProblem(error));
  }
}

export async function renameGroup(
  storage: Storage,
  id: string,
  name: string,
): Promise<Outcome<GroupInfo>> {
  try {
    return { ok: true, value: await storage.renameGroup(id, name) };
  } catch (error) {
    return fail(groupProblem(error));
  }
}

export async function deleteGroup(
  storage: Storage,
  id: string,
): Promise<Outcome<{ moved: number }>> {
  try {
    return { ok: true, value: await storage.deleteGroup(id) };
  } catch (error) {
    return fail(groupProblem(error));
  }
}
