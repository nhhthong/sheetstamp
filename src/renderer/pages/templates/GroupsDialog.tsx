import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupInfo, TemplateSummary } from "../../../shared/ipc/templates";
import * as ipc from "../../../shared/ipc/templates";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { call } from "../../lib/ipc";
import { tpl } from "../../strings/templates";
import { vi } from "../../strings/vi";

const t = tpl.groupsDialog;

export type GroupsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a rename or delete, so the list behind the dialog can reload. */
  onChanged: () => void;
};

export function GroupsDialog(props: GroupsDialogProps) {
  return props.open ? <Form {...props} /> : null;
}

function Form({ open, onOpenChange, onChanged }: GroupsDialogProps) {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupInfo[] | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const [refocus, setRefocus] = useState(0);

  // The row that held focus is gone after a delete: focus goes to the first remaining row's first button, or
  // to "Xong" when no group is left, so keyboard users do not start over from the top of the dialog.
  useEffect(() => {
    if (refocus === 0) return;
    // Wait two frames: the parent page reloads its list and the dialog library re-checks focus after a delete;
    // moving focus before they settle can lose it again.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const list = listRef.current;
        const target =
          list?.querySelector<HTMLElement>("button") ??
          list?.closest("[role=dialog]")?.querySelector<HTMLElement>("[data-testid=groups-done]");
        target?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [refocus]);

  const load = useCallback(async () => {
    const [g, all] = await Promise.all([call(ipc.groupsList), call(ipc.list)]);
    setGroups(g);
    setTemplates(all);
  }, []);
  useEffect(() => {
    void load().catch(() => setError(tpl.loadError));
  }, [load]);

  const countOf = (id: string) => templates.filter((x) => x.groupId === id).length;

  async function saveName(id: string) {
    setError("");
    const result = await call(ipc.groupsRename, { id, name: draft });
    if (!result.ok) return setError(result.message);
    setRenaming(null);
    toast.show(t.renamed);
    await load();
    onChanged();
  }

  async function remove(id: string) {
    setError("");
    try {
      const result = await call(ipc.groupsDelete, { id });
      setConfirming(null);
      if (!result.ok) return setError(result.message);
      toast.show(t.deleted(result.value.moved));
      await load();
      onChanged();
      setRefocus((n) => n + 1);
    } catch {
      setConfirming(null);
      setError(t.actionFailed);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      hideCancel
      footer={
        <Button onClick={() => onOpenChange(false)} data-testid="groups-done">
          {t.close}
        </Button>
      }
    >
      {groups !== null && groups.length === 0 ? <p className="text-muted">{t.empty}</p> : null}
      <ul ref={listRef} aria-label={t.list} className="m-0 flex list-none flex-col gap-2 p-0">
        {(groups ?? []).map((g) => (
          <li
            key={g.id}
            data-testid="group-row"
            className="flex flex-col gap-2 rounded-control border border-line px-3 py-2"
          >
            {renaming === g.id ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveName(g.id);
                }}
              >
                <Input
                  autoFocus
                  aria-label={t.renameLabel(g.name)}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button type="submit" size="sm">
                  {t.renameSave}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRenaming(null);
                    setError("");
                  }}
                >
                  {vi.common.cancel}
                </Button>
              </form>
            ) : confirming === g.id ? (
              <div className="flex flex-col gap-2" role="group">
                <p className="font-semibold">{t.confirm(g.name, countOf(g.id))}</p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={() => void remove(g.id)}>
                    {t.confirmYes}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    autoFocus
                    onClick={() => setConfirming(null)}
                  >
                    {t.keep}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="text-sm text-muted">{t.templateCount(countOf(g.id))}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t.renameButtonLabel(g.name)}
                  onClick={() => {
                    setRenaming(g.id);
                    setDraft(g.name);
                    setError("");
                  }}
                >
                  {t.rename}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t.deleteLabel(g.name)}
                  onClick={() => setConfirming(g.id)}
                >
                  {t.delete}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error ? <Status kind="danger">{error}</Status> : null}
    </Dialog>
  );
}
