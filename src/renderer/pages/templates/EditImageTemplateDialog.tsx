import { useEffect, useMemo, useState } from "react";
import type {
  GroupInfo,
  ImageReplacePreview,
  TemplateDetail,
  TemplateSummary,
} from "../../../shared/ipc/templates";
import * as ipc from "../../../shared/ipc/templates";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { call } from "../../lib/ipc";
import { tpl } from "../../strings/templates";

const NEW_GROUP = "__new__";
const norm = (text: string) => text.trim().normalize("NFC").toLocaleLowerCase();

export type EditImageTemplateDialogProps = {
  open: boolean;
  /** Template to edit; the dialog loads it from main. */
  templateId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the changes are stored. The dialog closes itself and shows the toast. */
  onSaved: () => void;
};

export function EditImageTemplateDialog(props: EditImageTemplateDialogProps) {
  // The form mounts only while open, so every opening starts from the stored template.
  return props.open && props.templateId ? <Form {...props} templateId={props.templateId} /> : null;
}

type Replacement = { path: string; preview: ImageReplacePreview };

function Form({
  open,
  templateId,
  onOpenChange,
  onSaved,
}: EditImageTemplateDialogProps & { templateId: string }) {
  const toast = useToast();
  const text = tpl.editImageDialog;
  const [loaded, setLoaded] = useState<TemplateDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [others, setOthers] = useState<TemplateSummary[]>([]);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [note, setNote] = useState("");
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [replaceError, setReplaceError] = useState("");
  const [reading, setReading] = useState(false);
  const [patternProblems, setPatternProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let live = true;
    void Promise.all([call(ipc.get, { id: templateId }), call(ipc.groupsList), call(ipc.list)])
      .then(([detail, g, all]) => {
        if (!live) return;
        if (!detail) return setLoadFailed(true);
        setLoaded(detail);
        setGroups(g);
        setOthers(all.filter((t) => t.id !== templateId));
        setName(detail.name);
        setGroupId(detail.groupId);
        setNote(detail.note);
        setPattern(detail.filenamePattern);
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [templateId]);

  const keysSignature = loaded ? loaded.tags.map((t) => t.name).join("\u0000") : "";
  useEffect(() => {
    if (!loaded) return;
    let live = true;
    void call(ipc.checkPattern, {
      pattern,
      keys: keysSignature ? keysSignature.split("\u0000") : [],
    })
      .then((m) => live && setPatternProblems(m))
      .catch(() => live && setPatternProblems([]));
    return () => {
      live = false;
    };
  }, [loaded, pattern, keysSignature]);

  const duplicate = useMemo(() => {
    if (groupId === NEW_GROUP || norm(name) === "") return false;
    return others.some(
      (t) => t.kind === "image" && t.groupId === groupId && norm(t.name) === norm(name),
    );
  }, [others, groupId, name]);

  const groupOptions = useMemo(() => {
    if (!loaded || groups.some((g) => g.id === loaded.groupId)) return groups;
    return [{ id: loaded.groupId, name: loaded.groupName }, ...groups];
  }, [groups, loaded]);

  async function chooseReplacement() {
    const path = await call(ipc.chooseImage);
    if (!path) return;
    setReading(true);
    setReplaceError("");
    setConfirming(false);
    try {
      const result = await call(ipc.imageReplacePreview, { id: templateId, path });
      if (!result.ok) {
        // Nothing is changed: the earlier choice (if any) stays.
        setReplaceError(result.message);
        return;
      }
      setReplacement({ path, preview: result.value });
    } catch {
      setReplaceError(tpl.editDialog.loadFailed);
    } finally {
      setReading(false);
    }
  }

  const outside = replacement?.preview.outside ?? [];

  async function save(confirmed: boolean) {
    setSaveError("");
    if (name.trim() === "") return setSaveError(tpl.dialog.nameNeeded);
    if (patternProblems.length > 0) return setSaveError(patternProblems.join(" "));
    // Boxes that would be cut are listed above; replacing the image asks once more before anything is stored.
    if (outside.length > 0 && !confirmed) return setConfirming(true);
    setConfirming(false);
    setSaving(true);
    try {
      let targetGroup = groupId;
      if (groupId === NEW_GROUP) {
        if (newGroup.trim() === "") return setSaveError(tpl.dialog.groupNeeded);
        const made = await call(ipc.groupsCreate, { name: newGroup.trim() });
        if (!made.ok) return setSaveError(made.message);
        targetGroup = made.value.id;
      }
      const result = await call(ipc.updateImage, {
        id: templateId,
        name: name.trim(),
        groupId: targetGroup,
        note,
        filenamePattern: pattern,
        replacePath: replacement?.path ?? null,
      });
      if (!result.ok) return setSaveError(result.message);
      toast.show(tpl.saved);
      onOpenChange(false);
      onSaved();
    } catch {
      setSaveError(tpl.loadError);
    } finally {
      setSaving(false);
    }
  }

  const preview = replacement?.preview;
  const ready = loaded !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={text.title}
      footer={
        confirming ? (
          <div className="flex items-center gap-2" role="group">
            <span className="font-semibold">{text.confirm(outside.length)}</span>
            <Button variant="danger" onClick={() => void save(true)}>
              {text.confirmYes}
            </Button>
            <Button variant="secondary" autoFocus onClick={() => setConfirming(false)}>
              {text.confirmBack}
            </Button>
          </div>
        ) : (
          <Button onClick={() => void save(false)} disabled={!ready || saving || reading}>
            {saving ? tpl.editDialog.saving : tpl.editDialog.save}
          </Button>
        )
      }
    >
      {loadFailed ? <Status kind="danger">{tpl.editDialog.loadFailed}</Status> : null}
      {!ready && !loadFailed ? <p className="text-muted">{tpl.editDialog.loading}</p> : null}
      {ready ? (
        <>
          <section
            aria-label={text.currentFile}
            className="flex flex-col items-start gap-2 rounded-control border border-line px-4 py-3"
          >
            <p className="text-sm text-muted">{preview ? text.newFile : text.currentFile}</p>
            <Status kind="success" className="font-semibold">
              <span data-testid="edit-file-name">{preview?.fileName ?? loaded.sourceFileName}</span>
            </Status>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void chooseReplacement()}>
                {text.replaceFile}
              </Button>
              {replacement ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplacement(null);
                    setReplaceError("");
                    setConfirming(false);
                  }}
                >
                  {text.undoReplace}
                </Button>
              ) : null}
            </div>
            {reading ? <p className="text-sm text-muted">{tpl.dialog.reading}</p> : null}
            {replaceError ? (
              <Status kind="danger" className="text-sm">
                <span data-testid="replace-error">{replaceError}</span>
              </Status>
            ) : null}
          </section>

          {preview ? (
            <div
              data-testid="replace-summary"
              className="flex flex-col gap-1 rounded-control border border-line px-4 py-3 text-sm"
            >
              <p className="font-semibold">{text.changesTitle}</p>
              <p data-testid="image-size">{tpl.imageDialog.size(preview.width, preview.height)}</p>
              {preview.large ? (
                <Status kind="warning" className="text-left text-sm">
                  {tpl.imageDialog.large}
                </Status>
              ) : null}
              {preview.boxCount === 0 ? <p>{text.noBoxes}</p> : null}
              {preview.boxCount > 0 && outside.length === 0 ? (
                <p>{text.allInside(preview.boxCount)}</p>
              ) : null}
              {outside.length > 0 ? (
                <>
                  <Status kind="warning">{text.outsideTitle(outside.length)}</Status>
                  <ul data-testid="outside-boxes" className="m-0 list-disc pl-6">
                    {outside.map((b) => (
                      <li key={b.id} data-testid="outside-box">
                        {b.label}: {b.fit === "partly" ? text.partly : text.outside}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

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
                {groupOptions.map((g) => (
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
              {(p) => (
                <Input {...p} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
              )}
            </Field>
          ) : null}

          <Field label={tpl.dialog.note}>
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>

          <Field
            label={tpl.editDialog.filenamePattern}
            hint={patternProblems.length === 0 ? tpl.editDialog.patternHint : undefined}
            error={patternProblems.length > 0 ? patternProblems.join(" ") : undefined}
          >
            {(p) => <Input {...p} value={pattern} onChange={(e) => setPattern(e.target.value)} />}
          </Field>
        </>
      ) : null}

      {saveError ? <Status kind="danger">{saveError}</Status> : null}
    </Dialog>
  );
}
