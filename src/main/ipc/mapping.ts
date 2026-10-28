// Handlers of the "mapping" channels declared in src/shared/ipc/mapping.ts.
import {
  getGroupFilter,
  labels,
  rankTemplates,
  reconcile,
  setGroupFilter,
  suggest,
  useTemplate,
} from "../../shared/ipc/mapping";
import { getCurrentTable } from "../data-session";
import {
  matchFields,
  rankTemplates as rank,
  reconcile as reconcileProfile,
  suggestLabel,
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
  handle(suggest, ({ fields, columns }) => matchFields(fields, columns));
  handle(reconcile, ({ profile, fields, columns }) => reconcileProfile(profile, fields, columns));
  handle(labels, ({ keys }) => Object.fromEntries(keys.map((k) => [k, suggestLabel(k)])));

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
