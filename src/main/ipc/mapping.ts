// Handlers of the "mapping" channels declared in src/shared/ipc/mapping.ts.
import {
  getGroupFilter,
  getRow,
  getTemplateBytes,
  openMapping,
  rankTemplates,
  setEntry,
  setGroupFilter,
  useTemplate,
} from "../../shared/ipc/mapping";
import { getCurrentTable } from "../data-session";
import {
  getMappingRow,
  openMapping as open,
  rankTemplates as rank,
  setMappingEntry,
  templateBytes,
} from "../mapping";
import { UNGROUPED_ID, UNGROUPED_NAME } from "../storage";
import { getStorage } from "../templates/store";
import { handle } from "./define";

export const templateMessages = {
  missing: "Không tìm thấy mẫu này. Chọn mẫu khác.",
  notWord: "Mẫu này không phải mẫu Word. Chọn mẫu khác.",
  saveFailed: "Không ghi được ngày dùng mẫu. Thử lại.",
} as const;

export function register(): void {
  // Step 3: the table and the template bytes stay in main; the renderer gets columns, a row count and one row.
  handle(openMapping, async ({ templateId }) =>
    open(await getStorage(), getCurrentTable(), templateId),
  );
  handle(setEntry, async (request) =>
    setMappingEntry(await getStorage(), getCurrentTable(), request),
  );
  handle(getRow, ({ index }) => getMappingRow(getCurrentTable(), index));
  handle(getTemplateBytes, async ({ templateId }) => templateBytes(await getStorage(), templateId));

  handle(rankTemplates, async () => {
    const storage = await getStorage();
    const table = getCurrentTable();
    const templates = (await storage.listTemplates()).filter((t) => t.kind === "word");
    return { hasData: table !== undefined, items: rank(templates, table?.columns ?? []) };
  });

  handle(getGroupFilter, async () => {
    const storage = await getStorage();
    const { lastGroupFilter } = await storage.getChoices();
    if (lastGroupFilter === null) return null;
    if (lastGroupFilter === UNGROUPED_ID) return UNGROUPED_ID;
    const groups = await storage.listGroups();
    return groups.some((g) => g.id === lastGroupFilter) ? lastGroupFilter : null;
  });

  handle(setGroupFilter, async ({ groupId }) => {
    await (await getStorage()).setChoices({ lastGroupFilter: groupId });
  });

  handle(useTemplate, async ({ templateId }) => {
    const storage = await getStorage();
    const found = await storage.getTemplate(templateId);
    if (!found) return { ok: false as const, message: templateMessages.missing };
    if (found.kind !== "word") return { ok: false as const, message: templateMessages.notWord };
    try {
      await storage.markUsed(templateId);
    } catch {
      return { ok: false as const, message: templateMessages.saveFailed };
    }
    const groups = await storage.listGroups();
    const groupName =
      found.groupId === UNGROUPED_ID
        ? UNGROUPED_NAME
        : (groups.find((g) => g.id === found.groupId)?.name ?? UNGROUPED_NAME);
    return { ok: true as const, name: found.name, groupName };
  });
}
