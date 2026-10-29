// Handlers of the "templates" channels declared in src/shared/ipc/templates.ts.
import { BrowserWindow, dialog } from "electron";
import {
  checkPattern,
  chooseFile,
  chooseImage,
  create,
  createImage,
  get,
  groupsCreate,
  groupsDelete,
  groupsList,
  groupsRename,
  list,
  parseFile,
  parseImage,
  remove,
  replacePreview,
  update,
} from "../../shared/ipc/templates";
import {
  createGroup,
  deleteGroup,
  patternMessages,
  replacePreview as previewReplace,
  renameGroup,
  updateTemplate,
} from "../templates/edit";
import { createImageTemplate, parseImageFile } from "../templates/image";
import {
  createTemplate,
  getTemplate,
  listTemplates,
  parseFile as parseChosenFile,
} from "../templates/library";
import { getStorage } from "../templates/store";
import { handle } from "./define";

export function register(): void {
  handle(list, async () => listTemplates(await getStorage()));
  handle(get, async ({ id }) => getTemplate(await getStorage(), id));
  handle(remove, async ({ id }) => {
    await (await getStorage()).deleteTemplate(id);
  });
  handle(chooseFile, async (_request, event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = {
      properties: ["openFile" as const],
      filters: [{ name: "Word", extensions: ["docx"] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle(chooseImage, async (_request, event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = {
      properties: ["openFile" as const],
      filters: [{ name: "Ảnh", extensions: ["png", "jpg", "jpeg"] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle(parseFile, ({ path }) => parseChosenFile(path));
  handle(parseImage, ({ path }) => parseImageFile(path));
  handle(createImage, async (request) => createImageTemplate(await getStorage(), request));
  handle(create, async (request) => createTemplate(await getStorage(), request));
  handle(groupsList, async () => (await getStorage()).listGroups());
  handle(groupsCreate, async ({ name }) => createGroup(await getStorage(), name));
  handle(groupsRename, async ({ id, name }) => renameGroup(await getStorage(), id, name));
  handle(groupsDelete, async ({ id }) => deleteGroup(await getStorage(), id));
  handle(replacePreview, async ({ id, path }) => previewReplace(await getStorage(), id, path));
  handle(update, async (request) => updateTemplate(await getStorage(), request));
  handle(checkPattern, ({ pattern, keys }) => patternMessages(pattern, keys));
}
