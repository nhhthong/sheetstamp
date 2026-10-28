// Template library operations behind the IPC handlers. Pure Node: the storage is passed in.
import { readFile, stat } from "node:fs/promises";
import { basename, extname, isAbsolute } from "node:path";
import {
  type CreateRequest,
  type FoundTag,
  MAX_SOURCE_BYTES,
  type Outcome,
  type ParsedFile,
  type TemplateDetail,
  type TemplateSummary,
} from "../../shared/ipc/templates";
import { suggestLabel } from "../mapping";
import {
  type Storage,
  StorageError,
  type Template,
  UNGROUPED_ID,
  UNGROUPED_NAME,
} from "../storage";
import { EasyTemplateXEngine } from "../template-engine/easy-template-x-engine";

const engine = new EasyTemplateXEngine();

export const messages = {
  notDocx: "Chỉ nhận file Word (.docx). Chọn một file .docx khác.",
  tooBig: "File lớn hơn 20 MB. Chọn file nhỏ hơn.",
  unreadable: "Không đọc được file này. Kiểm tra file còn tồn tại, hoặc chọn file khác.",
  notWord:
    "File này không phải tài liệu Word hợp lệ. Mở file bằng Word, lưu lại thành .docx rồi thử lại.",
  emptyName: "Nhập tên mẫu.",
  noGroup: "Nhóm không tồn tại. Chọn nhóm khác.",
  saveFailed: "Không lưu được mẫu. Kiểm tra ổ đĩa còn chỗ trống rồi thử lại.",
} as const;

export const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

/** Read a chosen file after checking it is a .docx of acceptable size. */
async function readSource(path: string): Promise<Outcome<{ bytes: Uint8Array; fileName: string }>> {
  if (!isAbsolute(path) || extname(path).toLowerCase() !== ".docx") return fail(messages.notDocx);
  try {
    const info = await stat(path);
    if (!info.isFile()) return fail(messages.unreadable);
    if (info.size > MAX_SOURCE_BYTES) return fail(messages.tooBig);
    return { ok: true, value: { bytes: await readFile(path), fileName: basename(path) } };
  } catch {
    return fail(messages.unreadable);
  }
}

async function tagsOf(bytes: Uint8Array): Promise<Outcome<FoundTag[]>> {
  try {
    const tags = await engine.parseTags(bytes);
    return {
      ok: true,
      value: tags.map((t) => ({
        key: t.key,
        raw: t.raw,
        kind: t.kind,
        label: t.kind === "field" ? suggestLabel(t.key) : "",
      })),
    };
  } catch {
    return fail(messages.notWord);
  }
}

export async function parseFile(path: string): Promise<Outcome<ParsedFile>> {
  const source = await readSource(path);
  if (!source.ok) return source;
  const tags = await tagsOf(source.value.bytes);
  if (!tags.ok) return tags;
  return { ok: true, value: { fileName: source.value.fileName, tags: tags.value } };
}

function summary(t: Template, names: Map<string, string>): TemplateSummary {
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    groupId: t.groupId,
    groupName: names.get(t.groupId) ?? UNGROUPED_NAME,
    note: t.note,
    sourceFileName: t.sourceFileName,
    tagCount: t.tags.length,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
  };
}

async function groupNames(storage: Storage): Promise<Map<string, string>> {
  const names = new Map((await storage.listGroups()).map((g) => [g.id, g.name]));
  names.set(UNGROUPED_ID, UNGROUPED_NAME);
  return names;
}

export async function listTemplates(storage: Storage): Promise<TemplateSummary[]> {
  const names = await groupNames(storage);
  const all = await storage.listTemplates();
  // Newest first: a template just created is the first row.
  return all.map((t) => summary(t, names)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTemplate(storage: Storage, id: string): Promise<TemplateDetail | null> {
  const t = await storage.getTemplate(id);
  if (!t) return null;
  const names = await groupNames(storage);
  return {
    ...summary(t, names),
    tags: t.tags.map(({ name, label }) => ({ name, label })),
    filenamePattern: t.filenamePattern,
  };
}

export async function createTemplate(
  storage: Storage,
  request: CreateRequest,
): Promise<Outcome<{ id: string }>> {
  const name = request.name.trim();
  if (name === "") return fail(messages.emptyName);
  if (
    request.groupId !== UNGROUPED_ID &&
    !(await storage.listGroups()).some((g) => g.id === request.groupId)
  ) {
    return fail(messages.noGroup);
  }
  const source = await readSource(request.path);
  if (!source.ok) return source;
  // Tags come from the file, never from the renderer; the renderer only supplies labels.
  const found = await tagsOf(source.value.bytes);
  if (!found.ok) return found;
  const tags = found.value
    .filter((t) => t.kind === "field")
    .map((t) => ({ name: t.key, label: request.labels[t.key]?.trim() || t.label }));
  try {
    const created = await storage.createTemplate({
      name,
      kind: "word",
      groupId: request.groupId,
      note: request.note.trim(),
      tags,
      sourcePath: request.path,
    });
    return { ok: true, value: { id: created.id } };
  } catch (error) {
    if (error instanceof StorageError && error.code === "invalid") return fail(error.message);
    return fail(messages.saveFailed);
  }
}
