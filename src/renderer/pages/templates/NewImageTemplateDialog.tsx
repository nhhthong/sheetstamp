import { FileUp } from "lucide-react";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import type { GroupInfo, ParsedImage, TemplateSummary } from "../../../shared/ipc/templates";
import * as ipc from "../../../shared/ipc/templates";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { call } from "../../lib/ipc";
import { tpl } from "../../strings/templates";

const NEW_GROUP = "__new__";

type Chosen = ParsedImage & { path: string };

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
const norm = (text: string) => text.trim().normalize("NFC").toLocaleLowerCase();

export type NewImageTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the template is stored, with its id. The dialog closes itself and shows the toast. */
  onCreated: (templateId: string) => void;
};

/** The new-template dialog for image templates. The file is checked in main; this only shows the result. */
export function NewImageTemplateDialog(props: NewImageTemplateDialogProps) {
  return props.open ? <Form {...props} /> : null;
}

function Form({ open, onOpenChange, onCreated }: NewImageTemplateDialogProps) {
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

  const duplicate = useMemo(() => {
    if (groupId === NEW_GROUP || norm(name) === "") return false;
    return existing.some(
      (t) => t.kind === "image" && t.groupId === groupId && norm(t.name) === norm(name),
    );
  }, [existing, groupId, name]);

  async function openPath(path: string) {
    setReading(true);
    setFileError("");
    try {
      const result = await call(ipc.parseImage, { path });
      if (!result.ok) {
        setChosen(null);
        setFileError(result.message);
        return;
      }
      setChosen({ ...result.value, path });
      setName((current) => (current.trim() === "" ? baseName(result.value.fileName) : current));
    } finally {
      setReading(false);
    }
  }

  async function choose() {
    const path = await call(ipc.chooseImage);
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
    if (!chosen) return setSaveError(tpl.imageDialog.fileNeeded);
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
      const result = await call(ipc.createImage, {
        path: chosen.path,
        name: name.trim(),
        groupId: targetGroup,
        note,
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
        <Button onClick={() => void save()} disabled={saving || reading || duplicate}>
          {saving ? tpl.dialog.saving : tpl.dialog.save}
        </Button>
      }
    >
      <section
        aria-label={tpl.imageDialog.dropLabel}
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
            <p className="font-semibold">{tpl.imageDialog.dropHere}</p>
            <p className="text-sm text-muted">{tpl.dialog.orChoose}</p>
          </>
        )}
        <Button variant="secondary" size="sm" onClick={() => void choose()}>
          {chosen ? tpl.imageDialog.changeFile : tpl.imageDialog.chooseButton}
        </Button>
        {reading ? <p className="text-sm text-muted">{tpl.dialog.reading}</p> : null}
        {fileError ? (
          <Status kind="danger" className="text-left text-sm">
            {fileError}
          </Status>
        ) : null}
        {chosen ? (
          <p className="text-sm text-muted" data-testid="image-size">
            {tpl.imageDialog.size(chosen.width, chosen.height)}
          </p>
        ) : null}
        {chosen?.large ? (
          <Status kind="warning" className="text-left text-sm">
            {tpl.imageDialog.large}
          </Status>
        ) : null}
      </section>

      <Field label={tpl.dialog.name}>
        {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      {duplicate ? (
        <Status kind="danger" className="-mt-2 text-sm">
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

      {saveError ? <Status kind="danger">{saveError}</Status> : null}
    </Dialog>
  );
}
