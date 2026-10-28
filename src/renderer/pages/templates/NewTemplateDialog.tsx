import { AlertTriangle, FileUp } from "lucide-react";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import type { FoundTag, GroupInfo, TemplateSummary } from "../../../shared/ipc/templates";
import * as ipc from "../../../shared/ipc/templates";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { call } from "../../lib/ipc";
import { tpl } from "../../strings/templates";

const NEW_GROUP = "__new__";

type Chosen = { path: string; fileName: string; tags: FoundTag[] };

/** File name without its extension, used to prefill the template name. */
const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

const norm = (text: string) => text.trim().normalize("NFC").toLocaleLowerCase();

const isLoop = (tag: FoundTag) => /^\{\{\s*[#/]/.test(tag.raw);

export type NewTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the template is stored, with its id. The dialog closes itself and shows the toast. */
  onCreated: (templateId: string) => void;
};

/** The new-template dialog for Word templates. Other pages (the export flow) reuse it as is. */
export function NewTemplateDialog(props: NewTemplateDialogProps) {
  // The form mounts only while open, so every opening starts with empty state.
  return props.open ? <Form {...props} /> : null;
}

function Form({ open, onOpenChange, onCreated }: NewTemplateDialogProps) {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [existing, setExisting] = useState<TemplateSummary[]>([]);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([call(ipc.groupsList), call(ipc.list)]).then(([g, t]) => {
      if (!live) return;
      setGroups(g);
      setExisting(t);
      setGroupId((current) => current || g[0]?.id || NEW_GROUP);
    });
    return () => {
      live = false;
    };
  }, []);

  const fields = chosen?.tags.filter((t) => t.kind === "field") ?? [];
  const unsupported = chosen?.tags.filter((t) => t.kind === "unsupported") ?? [];

  const duplicate = useMemo(() => {
    if (groupId === NEW_GROUP || norm(name) === "") return false;
    return existing.some((t) => t.groupId === groupId && norm(t.name) === norm(name));
  }, [existing, groupId, name]);

  async function openPath(path: string) {
    setReading(true);
    setFileError("");
    try {
      const result = await call(ipc.parseFile, { path });
      if (!result.ok) {
        setChosen(null);
        setFileError(result.message);
        return;
      }
      const { fileName, tags } = result.value;
      setChosen({ path, fileName, tags });
      setLabels(
        Object.fromEntries(tags.filter((t) => t.kind === "field").map((t) => [t.key, t.label])),
      );
      setName((current) => (current.trim() === "" ? baseName(fileName) : current));
    } finally {
      setReading(false);
    }
  }

  async function choose() {
    const path = await call(ipc.chooseFile);
    if (path) await openPath(path);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const path = window.sheetstamp.pathForFile(file);
    if (path) void openPath(path);
  }

  async function save() {
    setSaveError("");
    if (!chosen) return setSaveError(tpl.dialog.fileNeeded);
    if (name.trim() === "") return setSaveError(tpl.dialog.nameNeeded);
    setSaving(true);
    try {
      let targetGroup = groupId;
      if (groupId === NEW_GROUP) {
        if (newGroup.trim() === "") return setSaveError(tpl.dialog.groupNeeded);
        const made = await call(ipc.groupsCreate, { name: newGroup.trim() });
        if (!made.ok) return setSaveError(made.message);
        targetGroup = made.value.id;
      }
      const result = await call(ipc.create, {
        path: chosen.path,
        name: name.trim(),
        groupId: targetGroup,
        note,
        labels,
      });
      if (!result.ok) return setSaveError(result.message);
      toast.show(tpl.saved);
      onOpenChange(false);
      onCreated(result.value.id);
    } catch {
      setSaveError(tpl.loadError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={tpl.dialog.title}
      footer={
        <Button onClick={() => void save()} disabled={saving || reading}>
          {saving ? tpl.dialog.saving : tpl.dialog.save}
        </Button>
      }
    >
      <section
        aria-label={tpl.dialog.dropLabel}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-2 rounded-control border-2 border-dashed px-4 py-5 text-center ${dragging ? "border-accent bg-panel" : "border-line"}`}
      >
        {chosen ? (
          <Status kind="success" className="font-semibold">
            <span data-testid="chosen-file">{chosen.fileName}</span>
          </Status>
        ) : (
          <>
            <FileUp aria-hidden="true" className="size-6 text-muted" />
            <p className="font-semibold">{tpl.dialog.dropHere}</p>
            <p className="text-sm text-muted">{tpl.dialog.orChoose}</p>
          </>
        )}
        <Button variant="secondary" size="sm" onClick={() => void choose()}>
          {chosen ? tpl.dialog.changeFile : tpl.dialog.chooseButton}
        </Button>
        {reading ? <p className="text-sm text-muted">{tpl.dialog.reading}</p> : null}
        {fileError ? (
          <Status kind="danger" className="text-left text-sm">
            {fileError}
          </Status>
        ) : null}
      </section>

      <Field label={tpl.dialog.name}>
        {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      {duplicate ? (
        <Status kind="warning" className="-mt-2 text-sm">
          {tpl.dialog.duplicate}
        </Status>
      ) : null}

      <Field label={tpl.dialog.group}>
        {(p) => (
          <Select {...p} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value={NEW_GROUP}>{tpl.dialog.newGroupOption}</option>
          </Select>
        )}
      </Field>
      {groupId === NEW_GROUP ? (
        <Field label={tpl.dialog.newGroupName}>
          {(p) => <Input {...p} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />}
        </Field>
      ) : null}

      {showNote ? (
        <Field label={tpl.dialog.note}>
          {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      ) : (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowNote(true)}>
          {tpl.dialog.addNote}
        </Button>
      )}

      {chosen ? (
        <div className="flex flex-col gap-3">
          {fields.length === 0 ? (
            <Status kind="warning">{tpl.dialog.noFields}</Status>
          ) : (
            <details className="rounded-control border border-line px-3 py-2">
              <summary className="cursor-pointer">
                <span data-testid="field-count">{tpl.dialog.fieldsFound(fields.length)}</span>{" "}
                <span className="font-semibold text-accent">{tpl.dialog.showLabels}</span>
              </summary>
              <ul className="mt-3 flex max-h-48 list-none flex-col gap-2 overflow-y-auto p-0">
                {fields.map((tag) => (
                  <li key={tag.key} className="flex items-center gap-3">
                    <code className="w-2/5 shrink-0 truncate text-sm" title={tag.key}>
                      {tag.key}
                    </code>
                    <Input
                      aria-label={tpl.dialog.labelFor(tag.key)}
                      value={labels[tag.key] ?? ""}
                      onChange={(e) =>
                        setLabels((prev) => ({ ...prev, [tag.key]: e.target.value }))
                      }
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
          {unsupported.length > 0 ? (
            <div className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div>
                <p>{tpl.dialog.unsupportedTitle(unsupported.length)}</p>
                <ul className="mt-1 list-disc pl-5" data-testid="unsupported-list">
                  {unsupported.map((tag) => (
                    <li key={tag.raw}>
                      <code>{tag.raw}</code> (
                      {isLoop(tag)
                        ? tpl.dialog.unsupportedReason.loop
                        : tpl.dialog.unsupportedReason.note}
                      )
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {saveError ? <Status kind="danger">{saveError}</Status> : null}
    </Dialog>
  );
}
