// Opening and saving the layout of an image template. Pure Node: the storage is passed in.
import { emptyImageLayout, parseImageLayout } from "../../shared/image-layout";
import type { ImageEditorDoc, SaveLayoutRequest } from "../../shared/ipc/images";
import type { Outcome } from "../../shared/ipc/templates";
import { suggestLabel } from "../mapping";
import { type Storage, StorageError } from "../storage";
import { fail, messages } from "./library";

export const editorMessages = {
  notFound: "Không tìm thấy mẫu ảnh này. Quay lại danh sách mẫu và thử lại.",
  newer: "Mẫu này được lưu bởi một phiên bản mới hơn của ứng dụng. Cập nhật ứng dụng để chỉnh sửa.",
  invalid: "Bố cục của mẫu này bị hỏng nên không mở được. Tạo lại mẫu từ ảnh nền.",
  badLayout: "Bố cục không hợp lệ nên chưa lưu. Kiểm tra các ô chữ rồi thử lại.",
} as const;

export async function openImageEditor(
  storage: Storage,
  id: string,
): Promise<Outcome<ImageEditorDoc>> {
  const template = await storage.getTemplate(id);
  if (!template || template.kind !== "image") return fail(editorMessages.notFound);
  const stored = template.imageLayout === undefined ? emptyImageLayout() : template.imageLayout;
  const parsed = parseImageLayout(stored);
  if (!parsed.ok) return fail(editorMessages[parsed.reason]);
  let background: Uint8Array;
  try {
    background = await storage.readSource(id);
  } catch {
    return fail(messages.unreadable);
  }
  return {
    ok: true,
    value: {
      name: template.name,
      background,
      layout: parsed.layout,
      labels: Object.fromEntries(template.tags.map((t) => [t.name, t.label])),
    },
  };
}

/** Validates the layout and commits it together with the tags (one per distinct field) in one mutation. */
export async function saveImageLayout(
  storage: Storage,
  request: SaveLayoutRequest,
): Promise<Outcome<undefined>> {
  const parsed = parseImageLayout(request.layout);
  if (!parsed.ok)
    return fail(parsed.reason === "newer" ? editorMessages.newer : editorMessages.badLayout);
  const { layout } = parsed;
  const keys = [...new Set(layout.boxes.map((b) => b.field))];
  const tags = keys.map((name) => ({
    name,
    label: request.labels[name]?.trim() || suggestLabel(name),
  }));
  try {
    const template = await storage.getTemplate(request.id);
    if (!template || template.kind !== "image") return fail(editorMessages.notFound);
    await storage.updateTemplate(request.id, { imageLayout: layout, tags });
    return { ok: true, value: undefined };
  } catch (error) {
    if (error instanceof StorageError && error.code === "invalid") return fail(error.message);
    return fail(messages.saveFailed);
  }
}
