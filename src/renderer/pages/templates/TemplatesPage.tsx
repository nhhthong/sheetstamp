import { FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TemplateSummary } from "../../../shared/ipc/templates";
import * as ipc from "../../../shared/ipc/templates";
import { Page } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/cn";
import { call } from "../../lib/ipc";
import { tpl } from "../../strings/templates";
import { vi } from "../../strings/vi";
import { EditTemplateDialog } from "./EditTemplateDialog";
import { GroupsDialog } from "./GroupsDialog";
import { NewTemplateDialog } from "./NewTemplateDialog";

export { NewTemplateDialog } from "./NewTemplateDialog";

type Tab = "docs" | "images";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

function hint(t: TemplateSummary): string {
  const used = t.lastUsedAt ? tpl.usedOn(formatDate(t.lastUsedAt)) : tpl.neverUsed;
  const base = `${tpl.fieldsCount(t.tagCount)}, ${used}`;
  return t.note ? `${base}. ${t.note}` : base;
}

export function TemplatesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("docs");
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTemplates(await call(ipc.list));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function remove(id: string) {
    try {
      await call(ipc.remove, { id });
      toast.show(tpl.deleted);
    } catch {
      toast.show(tpl.deleteFailed);
    }
    setConfirming(null);
    await refresh();
  }

  const docs = (templates ?? []).filter((t) => t.kind === "word");

  return (
    <Page
      title={vi.pages.templates.title}
      subtitle={vi.pages.templates.subtitle}
      actions={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setGroupsOpen(true)}>
            {tpl.manageGroups}
          </Button>
          <Button onClick={() => setDialogOpen(true)} disabled={tab === "images"}>
            {tpl.newTemplate}
          </Button>
        </div>
      }
    >
      <div
        role="group"
        aria-label={tpl.tabsLabel}
        className="mb-6 inline-flex rounded-control border border-line p-0.5"
      >
        {(
          [
            ["docs", tpl.tabDocs],
            ["images", tpl.tabImages],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-control px-4 py-1.5 font-semibold",
              tab === id ? "bg-accent text-on-accent" : "text-text hover:bg-panel",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "images" ? (
        <Status kind="info">{tpl.imagesSoon}</Status>
      ) : error ? (
        <Status kind="danger">{tpl.loadError}</Status>
      ) : templates === null ? (
        <p className="text-muted">{vi.common.loading}</p>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-dialog border border-line p-6">
          <p>{tpl.emptyDocs}</p>
          <Button onClick={() => setDialogOpen(true)}>{tpl.createFirst}</Button>
        </div>
      ) : (
        <ul aria-label={tpl.list} className="m-0 flex list-none flex-col gap-2 p-0">
          {docs.map((t) => (
            <li
              key={t.id}
              data-testid="template-row"
              className="flex items-center gap-4 rounded-dialog border border-line px-4 py-3"
            >
              <FileText aria-hidden="true" className="size-6 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{t.name}</p>
                <p className="truncate text-sm text-muted">{hint(t)}</p>
              </div>
              <span className="shrink-0 rounded-control bg-panel px-2 py-1 text-sm">
                {t.groupName}
              </span>
              {confirming === t.id ? (
                <div className="flex shrink-0 items-center gap-2" role="group">
                  <span className="font-semibold">{tpl.confirmDelete}</span>
                  <Button variant="danger" size="sm" onClick={() => void remove(t.id)}>
                    {tpl.confirmYes}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    autoFocus
                    onClick={() => setConfirming(null)}
                  >
                    {tpl.keep}
                  </Button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`${tpl.edit} ${t.name}`}
                    onClick={() => setEditing(t.id)}
                  >
                    {tpl.edit}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`${tpl.delete} ${t.name}`}
                    onClick={() => setConfirming(t.id)}
                  >
                    {tpl.delete}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <NewTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void refresh()}
      />
      <EditTemplateDialog
        open={editing !== null}
        templateId={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => void refresh()}
      />
      <GroupsDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        onChanged={() => void refresh()}
      />
    </Page>
  );
}
