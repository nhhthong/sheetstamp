// Handlers of the "templates" channels declared in src/shared/ipc/templates.ts.
import { BrowserWindow, dialog } from "electron";
import {
  chooseFile,
  create,
  get,
  groupsCreate,
  groupsList,
  list,
  parseFile,
  remove,
} from "../../shared/ipc/templates";
import { StorageError } from "../storage";
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
  handle(parseFile, ({ path }) => parseChosenFile(path));
  handle(create, async (request) => createTemplate(await getStorage(), request));
  handle(groupsList, async () => (await getStorage()).listGroups());
  handle(groupsCreate, async ({ name }) => {
    try {
      return { ok: true as const, value: await (await getStorage()).createGroup(name) };
    } catch (error) {
      if (error instanceof StorageError) return { ok: false as const, message: error.message };
      throw error;
    }
  });
}
