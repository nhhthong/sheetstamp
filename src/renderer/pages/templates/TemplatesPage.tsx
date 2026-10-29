import { FileText, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TemplateSummary } from "../../../shared/ipc/templates";
import * as ipc from "../../../shared/ipc/templates";
import { Page } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/date";
import { call } from "../../lib/ipc";
import { tpl } from "../../strings/templates";
import { vi } from "../../strings/vi";
import { EditImageTemplateDialog } from "./EditImageTemplateDialog";
import { EditTemplateDialog } from "./EditTemplateDialog";
import { GroupsDialog } from "./GroupsDialog";
import { ImageEditorPage } from "./image-editor/ImageEditorPage";
import { NewImageTemplateDialog } from "./NewImageTemplateDialog";
import { NewTemplateDialog } from "./NewTemplateDialog";
import { StorageBanner, useStorageStatus } from "./StorageBanner";

export { NewTemplateDialog } from "./NewTemplateDialog";

type Tab = "docs" | "images";

function hint(t: TemplateSummary): string {
  const used = t.lastUsedAt ? tpl.usedOn(formatDate(t.lastUsedAt)) : tpl.neverUsed;
  const fields = `${tpl.fieldsCount(t.tagCount)}, ${used}`;
  // Image rows also show the background file: it is the only thing besides the name that tells them apart.
  const base = t.kind === "image" ? `${t.sourceFileName}, ${fields}` : fields;
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
  const [editingImageInfo, setEditingImageInfo] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const storage = useStorageStatus();
  // A data folder that could not be opened (for example written by a newer version) is read-only for the UI.
  const blocked = storage?.error != null;

  const refresh = useCallback(async () => {
    try {
      setTemplates(await call(ipc.list));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    if (storage && !storage.error) void refresh();
  }, [refresh, storage]);

  /** After an image template is created the image editor opens for it as a sub-page of Mẫu. */
  function continueToImageEditor(templateId: string) {
    void refresh();
    setEditingImage(templateId);
  }

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

  const rows = (templates ?? []).filter((t) => t.kind === (tab === "docs" ? "word" : "image"));
  const Icon = tab === "docs" ? FileText : ImageIcon;

  if (editingImage !== null) {
    return (
      <ImageEditorPage
        templateId={editingImage}
        onBack={() => {
          setEditingImage(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <Page
      title={vi.pages.templates.title}
      subtitle={vi.pages.templates.subtitle}
      actions={
        <div className="flex gap-3">
          <Button variant="secondary" disabled={blocked} onClick={() => setGroupsOpen(true)}>
            {tpl.manageGroups}
          </Button>
          <Button onClick={() => setDialogOpen(true)} disabled={blocked}>
            {tpl.newTemplate}
          </Button>
        </div>
      }
    >
      <div className="mb-6 empty:hidden">
        <StorageBanner status={storage} />
      </div>
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

      {blocked ? null : error ? (
        <Status kind="danger">{tpl.loadError}</Status>
      ) : templates === null ? (
        <p className="text-muted">{vi.common.loading}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-dialog border border-line p-6">
          <p>{tab === "docs" ? tpl.emptyDocs : tpl.emptyImages}</p>
          <Button onClick={() => setDialogOpen(true)}>{tpl.createFirst}</Button>
        </div>
      ) : (
        <ul
          aria-label={tab === "docs" ? tpl.list : tpl.listImages}
          className="m-0 flex list-none flex-col gap-2 p-0"
        >
          {rows.map((t) => (
            <li
              key={t.id}
              data-testid="template-row"
              className="flex items-center gap-4 rounded-dialog border border-line px-4 py-3"
            >
              <Icon aria-hidden="true" className="size-6 shrink-0 text-muted" />
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
                  {t.kind === "image" ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`${tpl.editImageInfo} ${t.name}`}
                        onClick={() => setEditingImageInfo(t.id)}
                      >
                        {tpl.editImageInfo}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`${tpl.editImage} ${t.name}`}
                        onClick={() => setEditingImage(t.id)}
                      >
                        {tpl.editImage}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`${tpl.edit} ${t.name}`}
                      onClick={() => setEditing(t.id)}
                    >
                      {tpl.edit}
                    </Button>
                  )}
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
        open={dialogOpen && tab === "docs"}
        onOpenChange={setDialogOpen}
        onCreated={() => void refresh()}
      />
      <NewImageTemplateDialog
        open={dialogOpen && tab === "images"}
        onOpenChange={setDialogOpen}
        onCreated={continueToImageEditor}
      />
      <EditTemplateDialog
        open={editing !== null}
        templateId={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => void refresh()}
      />
      <EditImageTemplateDialog
        open={editingImageInfo !== null}
        templateId={editingImageInfo}
        onOpenChange={(open) => !open && setEditingImageInfo(null)}
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
