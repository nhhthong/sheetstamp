// Image templates in the library: reading and checking the background, creating the record. Pure Node.

import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import { lazy } from "../../shared/i18n";
import { emptyImageLayout } from "../../shared/image-layout";
import { MAX_BACKGROUND_BYTES } from "../../shared/ipc/images";
import type { CreateImageRequest, Outcome, ParsedImage } from "../../shared/ipc/templates";
import { type Storage, StorageError, UNGROUPED_ID } from "../storage";
import { checkImage, type ImageCheck, type ImageInfo, type ImageProblem } from "./image-file";
import { fail, messages } from "./library";

export const imageMessages: Record<ImageProblem, string> = lazy<Record<ImageProblem, string>>(
  {
    "not-image": "Chỉ nhận ảnh PNG hoặc JPG. Chọn một ảnh khác.",
    "too-big": "Ảnh lớn hơn 20 MB. Thu nhỏ ảnh rồi thử lại.",
    "too-many-pixels": "Ảnh lớn hơn 25 megapixel. Thu nhỏ ảnh rồi thử lại.",
    "cut-off": "Ảnh bị cắt dở. Tải lại ảnh gốc hoặc chọn ảnh khác.",
    get unreadable() {
      return messages.unreadable;
    },
  },
  {
    "not-image": "Only PNG or JPG images are accepted. Choose another image.",
    "too-big": "The image is larger than 20 MB. Make it smaller and try again.",
    "too-many-pixels": "The image is larger than 25 megapixels. Make it smaller and try again.",
    "cut-off": "The image is cut off. Load the original image again or choose another one.",
    get unreadable() {
      return messages.unreadable;
    },
  },
);

/** Reads a chosen file (checking its size before reading it) and checks the bytes, not the extension. */
export async function readImage(
  path: string,
): Promise<Outcome<{ bytes: Uint8Array; fileName: string; info: ImageInfo }>> {
  if (!isAbsolute(path)) return fail(imageMessages["not-image"]);
  let bytes: Uint8Array;
  try {
    const info = await stat(path);
    if (!info.isFile()) return fail(messages.unreadable);
    if (info.size > MAX_BACKGROUND_BYTES) return fail(imageMessages["too-big"]);
    bytes = await readFile(path);
  } catch {
    return fail(messages.unreadable);
  }
  const checked: ImageCheck = checkImage(bytes);
  if (!checked.ok) return fail(imageMessages[checked.problem]);
  return { ok: true, value: { bytes, fileName: basename(path), info: checked.info } };
}

export async function parseImageFile(path: string): Promise<Outcome<ParsedImage>> {
  const image = await readImage(path);
  if (!image.ok) return image;
  const { width, height, large } = image.value.info;
  return { ok: true, value: { fileName: image.value.fileName, width, height, large } };
}

/** Stores the template with an empty layout; the boxes are added in the editor. */
export async function createImageTemplate(
  storage: Storage,
  request: CreateImageRequest,
): Promise<Outcome<{ id: string }>> {
  const name = request.name.trim();
  if (name === "") return fail(messages.emptyName);
  if (
    request.groupId !== UNGROUPED_ID &&
    !(await storage.listGroups()).some((g) => g.id === request.groupId)
  ) {
    return fail(messages.noGroup);
  }
  const image = await readImage(request.path);
  if (!image.ok) return image;
  try {
    const created = await storage.createTemplate({
      name,
      kind: "image",
      groupId: request.groupId,
      note: request.note.trim(),
      imageLayout: emptyImageLayout(),
      source: { bytes: image.value.bytes, fileName: image.value.fileName },
    });
    return { ok: true, value: { id: created.id } };
  } catch (error) {
    if (error instanceof StorageError && error.code === "invalid") return fail(error.message);
    return fail(messages.saveFailed);
  }
}
