// Step 3 of the Home page in main: the template, the loaded table and the stored mapping meet here.
// Pure Node: the storage and the table are passed in, so the logic is testable without Electron.
import {
  type FieldMapping,
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

export const mappingMessages = {
  missing: "Không tìm thấy mẫu này. Chọn lại mẫu ở bước trước.",
  notWord: "Mẫu này không phải mẫu Word. Chọn mẫu khác.",
  noData: "Chưa có dữ liệu. Mở file dữ liệu ở bước đầu.",
  badField: "Trường này không có trong mẫu.",
  badColumn: "Cột này không có trong file dữ liệu. Chọn cột khác.",
  tooLong: `Chữ cố định dài tối đa ${MAX_FIXED_TEXT} ký tự.`,
  badRow: "Dòng này không có trong file dữ liệu.",
  saveFailed: "Không lưu được cách ghép cột. Thử lại.",
  readFailed: "Không đọc được file mẫu. Chọn lại mẫu ở bước trước.",
} as const;

type Fail = { ok: false; message: string };
const fail = (message: string): Fail => ({ ok: false, message });

async function wordTemplate(storage: Storage, id: string): Promise<Template | Fail> {
  const template = await storage.getTemplate(id);
  if (!template) return fail(mappingMessages.missing);
  if (template.kind !== "word") return fail(mappingMessages.notWord);
  return template;
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
  const template = await wordTemplate(storage, templateId);
  if ("ok" in template) return template;

  const fields = template.tags.map((t) => ({ key: t.name, label: t.label }));
  const result = reconcile(toProfile(template.mapping), fields, table.columns);
  const entries = toRecord(result.profile);
  if (canonical(entries) !== canonical(toRecord(toProfile(template.mapping)))) {
    try {
      await storage.updateTemplate(template.id, { mapping: entries });
    } catch {
      return fail(mappingMessages.saveFailed);
    }
  }
  return {
    ok: true,
    view: {
      templateName: template.name,
      fields,
      columns: table.columns,
      rowCount: table.rows.length,
      entries,
      unmatched: result.unmatched,
      lost: result.lost,
    },
  };
}

// Saves are queued so two quick changes never overwrite each other (read, merge, write).
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
};

/** Save one field's choice. Everything is checked against the template and the loaded data. */
export function setMappingEntry(
  storage: Storage,
  table: DataTable | undefined,
  request: { templateId: string; key: string; entry: FieldMapping | null },
): Promise<SetEntryResult> {
  return serial(async () => {
    if (!table) return fail(mappingMessages.noData);
    const template = await wordTemplate(storage, request.templateId);
    if ("ok" in template) return template;
    if (!template.tags.some((t) => t.name === request.key)) return fail(mappingMessages.badField);
    const { entry } = request;
    if (entry?.kind === "column" && !table.columns.includes(entry.column)) {
      return fail(mappingMessages.badColumn);
    }
    if (entry?.kind === "fixed" && entry.text.length > MAX_FIXED_TEXT) {
      return fail(mappingMessages.tooLong);
    }
    const entries = toRecord(toProfile(template.mapping));
    if (entry === null) delete entries[request.key];
    else entries[request.key] = entry;
    try {
      await storage.updateTemplate(template.id, { mapping: entries });
    } catch {
      return fail(mappingMessages.saveFailed);
    }
    return { ok: true, entries };
  });
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
