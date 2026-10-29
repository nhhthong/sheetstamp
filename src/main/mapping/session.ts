// Step 3 of the Home page in main: the template, the loaded table and the stored mapping meet here.
// Pure Node: the storage and the table are passed in, so the logic is testable without Electron.
import { lazy } from "../../shared/i18n";
import { parseImageLayout } from "../../shared/image-layout";
import {
  type FieldMapping,
  type ImageSource,
  MAX_FIXED_TEXT,
  type OpenedMapping,
  type RowResult,
  type SetEntryResult,
  type TemplateBytes,
} from "../../shared/ipc/mapping";
import type { DataTable } from "../data";
import type { Storage, Template } from "../storage";
import { reconcile } from "./profile";
import { toProfile, toRecord } from "./shape";

export const mappingMessages = lazy(
  {
    missing: "Không tìm thấy mẫu này. Chọn lại mẫu ở bước trước.",
    notWord: "Mẫu này không phải mẫu Word. Chọn mẫu khác.",
    noData: "Chưa có dữ liệu. Mở file dữ liệu ở bước đầu.",
    badField: "Trường này không có trong mẫu.",
    badColumn: "Cột này không có trong file dữ liệu. Chọn cột khác.",
    tooLong: `Chữ cố định dài tối đa ${MAX_FIXED_TEXT} ký tự.`,
    badRow: "Dòng này không có trong file dữ liệu.",
    saveFailed: "Không lưu được cách ghép cột. Thử lại.",
    readFailed: "Không đọc được file mẫu. Chọn lại mẫu ở bước trước.",
    notImage: "Mẫu này không phải mẫu ảnh. Chọn mẫu khác.",
    noBoxes: "Mẫu này chưa có khung chữ. Mở mẫu để thêm.",
    badLayout: "Bố cục của mẫu này không đọc được. Mở mẫu để kiểm tra hoặc tạo lại từ ảnh nền.",
  },
  {
    missing: "This template was not found. Choose the template again in the previous step.",
    notWord: "This is not a Word template. Choose another template.",
    noData: "No data yet. Open a data file in the first step.",
    badField: "This field is not in the template.",
    badColumn: "This column is not in the data file. Choose another column.",
    tooLong: `Fixed text can be at most ${MAX_FIXED_TEXT} characters.`,
    badRow: "This row is not in the data file.",
    saveFailed: "Could not save how the columns are matched. Try again.",
    readFailed: "Could not read the template file. Choose the template again in the previous step.",
    notImage: "This is not an image template. Choose another template.",
    noBoxes: "This template has no text boxes yet. Open the template to add some.",
    badLayout:
      "The layout of this template cannot be read. Open the template to check it or create it again from the background image.",
  },
);

type Fail = { ok: false; message: string };
const fail = (message: string): Fail => ({ ok: false, message });

async function wordTemplate(storage: Storage, id: string): Promise<Template | Fail> {
  const template = await storage.getTemplate(id);
  if (!template) return fail(mappingMessages.missing);
  if (template.kind !== "word") return fail(mappingMessages.notWord);
  return template;
}

/** A Word or an image template (both are mapped the same way). */
async function mappableTemplate(storage: Storage, id: string): Promise<Template | Fail> {
  const template = await storage.getTemplate(id);
  return template ?? fail(mappingMessages.missing);
}

/** Why an image template cannot be used yet (no text boxes, or a layout that cannot be read); null when it can. */
export function imageProblem(template: Template): string | null {
  if (template.kind !== "image") return null;
  const parsed = parseImageLayout(template.imageLayout ?? { version: 1, boxes: [] });
  if (!parsed.ok) return mappingMessages.badLayout;
  return parsed.layout.boxes.length === 0 ? mappingMessages.noBoxes : null;
}

/** Same content, regardless of key order. */
const canonical = (record: Record<string, FieldMapping>): string =>
  JSON.stringify(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * Enter step 3: keep the valid choices of the stored mapping, match the rest automatically (with the template's
 * labels) and save the result when it changed.
 */
export async function openMapping(
  storage: Storage,
  table: DataTable | undefined,
  templateId: string,
): Promise<OpenedMapping> {
  if (!table) return fail(mappingMessages.noData);
  const template = await mappableTemplate(storage, templateId);
  if ("ok" in template) return template;
  const problem = imageProblem(template);
  if (problem) return fail(problem);

  const fields = template.tags.map((t) => ({ key: t.name, label: t.label }));
  // Matching and saving happen inside the storage queue, from the freshest mapping.
  let result: ReturnType<typeof reconcile> | undefined;
  let entries: Record<string, FieldMapping> = {};
  try {
    await storage.patchMapping(template.id, (mapping, current) => {
      const currentFields = current.tags.map((t) => ({ key: t.name, label: t.label }));
      const reconciled = reconcile(toProfile(mapping), currentFields, table.columns);
      result = reconciled;
      entries = toRecord(reconciled.profile);
      return canonical(entries) !== canonical(toRecord(toProfile(mapping))) ? entries : null;
    });
  } catch {
    return fail(mappingMessages.saveFailed);
  }
  if (!result) return fail(mappingMessages.saveFailed);
  return {
    ok: true,
    view: {
      templateName: template.name,
      kind: template.kind,
      fields,
      columns: table.columns,
      rowCount: table.rows.length,
      entries,
      unmatched: result.unmatched,
      lost: result.lost,
    },
  };
}

class Refusal extends Error {}

/** Save one field's choice. Everything is checked against the template and the loaded data. */
export async function setMappingEntry(
  storage: Storage,
  table: DataTable | undefined,
  request: { templateId: string; key: string; entry: FieldMapping | null },
): Promise<SetEntryResult> {
  if (!table) return fail(mappingMessages.noData);
  const template = await mappableTemplate(storage, request.templateId);
  if ("ok" in template) return template;
  const { entry } = request;
  if (entry?.kind === "column" && !table.columns.includes(entry.column)) {
    return fail(mappingMessages.badColumn);
  }
  if (entry?.kind === "fixed" && entry.text.length > MAX_FIXED_TEXT) {
    return fail(mappingMessages.tooLong);
  }
  let entries: Record<string, FieldMapping> = {};
  try {
    // Read, merge and write run inside the storage queue, so no other write can slip between them.
    await storage.patchMapping(template.id, (mapping, current) => {
      if (!current.tags.some((t) => t.name === request.key)) {
        throw new Refusal(mappingMessages.badField);
      }
      entries = toRecord(toProfile(mapping));
      if (entry === null) delete entries[request.key];
      else entries[request.key] = entry;
      return entries;
    });
  } catch (error) {
    return fail(error instanceof Refusal ? error.message : mappingMessages.saveFailed);
  }
  return { ok: true, entries };
}

/** The cells of one row. Only this row is copied out of the table. */
export function getMappingRow(table: DataTable | undefined, index: number): RowResult {
  if (!table) return fail(mappingMessages.noData);
  const row = table.rows[index];
  if (!row) return fail(mappingMessages.badRow);
  return { ok: true, cells: [...row] };
}

export async function templateBytes(storage: Storage, templateId: string): Promise<TemplateBytes> {
  const template = await wordTemplate(storage, templateId);
  if ("ok" in template) return template;
  try {
    const buffer = await storage.readSource(template.id);
    return { ok: true, docx: new Uint8Array(buffer) };
  } catch {
    return fail(mappingMessages.readFailed);
  }
}

/** The background and the text boxes of an image template, for the preview (drawn by `image:render`). */
export async function imageSource(storage: Storage, templateId: string): Promise<ImageSource> {
  const template = await storage.getTemplate(templateId);
  if (!template) return fail(mappingMessages.missing);
  if (template.kind !== "image") return fail(mappingMessages.notImage);
  const problem = imageProblem(template);
  if (problem) return fail(problem);
  const parsed = parseImageLayout(template.imageLayout);
  if (!parsed.ok) return fail(mappingMessages.badLayout);
  try {
    const background = await storage.readSource(template.id);
    return {
      ok: true,
      background: new Uint8Array(background),
      boxes: parsed.layout.boxes.map(({ id: _id, ...box }) => box),
    };
  } catch {
    return fail(mappingMessages.readFailed);
  }
}
