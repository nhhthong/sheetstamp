// Editing a saved image template: name, group, note, filename pattern, and replacing the background. Pure Node.

import { emptyImageLayout, parseImageLayout } from "../../shared/image-layout";
import { boxFit } from "../../shared/image-layout/bounds";
import type {
  ImageReplacePreview,
  Outcome,
  OutsideBox,
  UpdateImageRequest,
} from "../../shared/ipc/templates";
import { type Storage, StorageError, type Template, UNGROUPED_ID } from "../storage";
import { editMessages, patternMessages } from "./edit";
import { readImage } from "./image";
import { editorMessages } from "./image-editor";
import { fail, messages } from "./library";

async function imageTemplate(storage: Storage, id: string): Promise<Template | null> {
  const template = await storage.getTemplate(id);
  return template?.kind === "image" ? template : null;
}

/** Boxes of the stored layout that a new image of this size would cut, in the layout's order. */
export async function previewImageReplace(
  storage: Storage,
  id: string,
  path: string,
): Promise<Outcome<ImageReplacePreview>> {
  const template = await imageTemplate(storage, id);
  if (!template) return fail(editMessages.notFound);
  const parsed = parseImageLayout(template.imageLayout ?? emptyImageLayout());
  if (!parsed.ok) return fail(editorMessages[parsed.reason]);
  const image = await readImage(path);
  if (!image.ok) return image;
  const { width, height, large } = image.value.info;
  const labelOf = new Map(template.tags.map((t) => [t.name, t.label]));
  const outside: OutsideBox[] = [];
  for (const box of parsed.layout.boxes) {
    const fit = boxFit(box, width, height);
    if (fit !== "inside") {
      outside.push({
        id: box.id,
        field: box.field,
        label: labelOf.get(box.field) ?? box.field,
        fit,
      });
    }
  }
  return {
    ok: true,
    value: {
      fileName: image.value.fileName,
      width,
      height,
      large,
      boxCount: parsed.layout.boxes.length,
      outside,
    },
  };
}

/**
 * One storage mutation. With a replacement, the new image is stored under a new name, the record is committed,
 * and only then is the old copy deleted. The layout, tags and mapping are not touched: boxes are never moved.
 */
export async function updateImageTemplate(
  storage: Storage,
  request: UpdateImageRequest,
): Promise<Outcome<{ id: string }>> {
  if (!(await imageTemplate(storage, request.id))) return fail(editMessages.notFound);
  const name = request.name.trim();
  if (name === "") return fail(messages.emptyName);
  if (
    request.groupId !== UNGROUPED_ID &&
    !(await storage.listGroups()).some((g) => g.id === request.groupId)
  ) {
    return fail(messages.noGroup);
  }
  // The new image is checked again here (same checks as create); the stored bytes come from this one read.
  const image = request.replacePath === null ? null : await readImage(request.replacePath);
  if (image && !image.ok) return image;
  const patchFor = (template: Template) => {
    const problems = patternMessages(
      request.filenamePattern,
      template.tags.map((t) => t.name),
    );
    if (problems.length > 0) throw new StorageError("invalid", problems.join(" "));
    return {
      name,
      groupId: request.groupId,
      note: request.note.trim(),
      filenamePattern: request.filenamePattern,
    };
  };
  try {
    await storage.updateTemplate(
      request.id,
      patchFor,
      image?.ok ? { bytes: image.value.bytes, fileName: image.value.fileName } : undefined,
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
