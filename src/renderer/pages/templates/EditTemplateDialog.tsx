import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  GroupInfo,
  ReplacePreview,
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

export type EditTemplateDialogProps = {
  open: boolean;
  /** Template to edit; the dialog loads it from main. */
  templateId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the changes are stored. The dialog closes itself and shows the toast. */
  onSaved: () => void;
};

export function EditTemplateDialog(props: EditTemplateDialogProps) {
  // The form mounts only while open, so every opening starts from the stored template.
  return props.open && props.templateId ? <Form {...props} templateId={props.templateId} /> : null;
}

type Replacement = { path: string; preview: ReplacePreview };

function Form({
  open,
  templateId,
  onOpenChange,
  onSaved,
}: EditTemplateDialogProps & { templateId: string }) {
  const toast = useToast();
  const [loaded, setLoaded] = useState<TemplateDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [others, setOthers] = useState<TemplateSummary[]>([]);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [note, setNote] = useState("");
  const [pattern, setPattern] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [replaceError, setReplaceError] = useState("");
  const [reading, setReading] = useState(false);
  const [patternProblems, setPatternProblems] = useState<string[]>([]);
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
        setLabels(Object.fromEntries(detail.tags.map((t) => [t.name, t.label])));
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [templateId]);

  // The tags the template will have after saving: the file's, or the stored ones.
  const rows = useMemo(() => {
    if (!loaded) return [];
    const removed = new Set(replacement?.preview.removed ?? []);
    const added = new Set(replacement?.preview.added.map((a) => a.key) ?? []);
    const stored = loaded.tags.map((t) => ({
      key: t.name,
      removed: removed.has(t.name),
      added: false,
    }));
    const fresh = (replacement?.preview.added ?? []).map((a) => ({
      key: a.key,
      removed: false,
      added: added.has(a.key),
    }));
    return [...stored, ...fresh];
  }, [loaded, replacement]);
  const keys = useMemo(() => rows.filter((r) => !r.removed).map((r) => r.key), [rows]);
  const keysSignature = keys.join("\u0000");

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
    return others.some((t) => t.groupId === groupId && norm(t.name) === norm(name));
  }, [others, groupId, name]);

  const groupOptions = useMemo(() => {
    if (!loaded || groups.some((g) => g.id === loaded.groupId)) return groups;
    return [{ id: loaded.groupId, name: loaded.groupName }, ...groups];
  }, [groups, loaded]);

  async function chooseReplacement() {
    const path = await call(ipc.chooseFile);
    if (!path) return;
    setReading(true);
    setReplaceError("");
    try {
      const result = await call(ipc.replacePreview, { id: templateId, path });
      if (!result.ok) {
        // Nothing is changed: the earlier choice (if any) stays.
        setReplaceError(result.message);
        return;
      }
      setReplacement({ path, preview: result.value });
      setLabels((prev) => {
        const next = { ...prev };
        for (const a of result.value.added) next[a.key] = next[a.key] ?? a.label;
        return next;
      });
    } catch {
      setReplaceError(tpl.editDialog.loadFailed);
    } finally {
      setReading(false);
    }
  }

  async function save() {
    setSaveError("");
    if (name.trim() === "") return setSaveError(tpl.dialog.nameNeeded);
    if (patternProblems.length > 0) return setSaveError(patternProblems.join(" "));
    setSaving(true);
    try {
      let targetGroup = groupId;
      if (groupId === NEW_GROUP) {
        if (newGroup.trim() === "") return setSaveError(tpl.dialog.groupNeeded);
        const made = await call(ipc.groupsCreate, { name: newGroup.trim() });
        if (!made.ok) return setSaveError(made.message);
        targetGroup = made.value.id;
      }
      const result = await call(ipc.update, {
        id: templateId,
        name: name.trim(),
        groupId: targetGroup,
        note,
        filenamePattern: pattern,
        labels,
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
      title={tpl.editDialog.title}
      footer={
        <Button onClick={() => void save()} disabled={!ready || saving || reading}>
          {saving ? tpl.editDialog.saving : tpl.editDialog.save}
        </Button>
      }
    >
      {loadFailed ? <Status kind="danger">{tpl.editDialog.loadFailed}</Status> : null}
      {!ready && !loadFailed ? <p className="text-muted">{tpl.editDialog.loading}</p> : null}
      {ready ? (
        <>
          <section
            aria-label={tpl.editDialog.currentFile}
            className="flex flex-col items-start gap-2 rounded-control border border-line px-4 py-3"
          >
            <p className="text-sm text-muted">
              {preview ? tpl.editDialog.newFile : tpl.editDialog.currentFile}
            </p>
            <Status kind="success" className="font-semibold">
              <span data-testid="edit-file-name">{preview?.fileName ?? loaded.sourceFileName}</span>
            </Status>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void chooseReplacement()}>
                {tpl.editDialog.replaceFile}
              </Button>
              {replacement ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplacement(null);
                    setReplaceError("");
                  }}
                >
                  {tpl.editDialog.undoReplace}
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
              <p className="font-semibold">{tpl.editDialog.changesTitle}</p>
              {preview.added.length === 0 && preview.removed.length === 0 ? (
                <p>{tpl.editDialog.noChanges}</p>
              ) : null}
              <p>{tpl.editDialog.keptLine(preview.kept.length)}</p>
              {preview.keptMapped > 0 ? (
                <p>{tpl.editDialog.mappingKept(preview.keptMapped)}</p>
              ) : null}
              {preview.added.length > 0 ? (
                <Status kind="info" className="text-text">
                  {tpl.editDialog.addedLine(preview.added.map((a) => a.key).join(", "))}
                </Status>
              ) : null}
              {preview.removed.length > 0 ? (
                <Status kind="warning">
                  {tpl.editDialog.removedLine(preview.removed.join(", "))}
                </Status>
              ) : null}
              {preview.removedMapped.length > 0 ? (
                <p>{tpl.editDialog.removedMapped(preview.removedMapped.join(", "))}</p>
              ) : null}
              {preview.unsupported.length > 0 ? (
                <Status kind="warning">
                  {tpl.dialog.unsupportedTitle(preview.unsupported.length)}{" "}
                  {preview.unsupported.map((u) => u.raw).join(", ")}
                </Status>
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

          <details
            open={preview !== undefined}
            className="rounded-control border border-line px-3 py-2"
          >
            <summary className="cursor-pointer">
              <span data-testid="edit-field-count">{tpl.editDialog.fieldsTitle(keys.length)}</span>{" "}
              <span className="font-semibold text-accent">{tpl.dialog.showLabels}</span>
            </summary>
            <ul className="mt-3 flex max-h-56 list-none flex-col gap-2 overflow-y-auto p-0">
              {rows.map((row) => (
                <li key={row.key} data-testid="tag-row" className="flex items-center gap-3">
                  <div className="flex w-2/5 shrink-0 flex-col">
                    <code className="truncate text-sm" title={row.key}>
                      {row.key}
                    </code>
                    {row.removed ? (
                      <span className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle aria-hidden="true" className="size-3.5" />
                        {tpl.editDialog.removedBadge}
                      </span>
                    ) : null}
                    {row.added ? (
                      <span className="flex items-center gap-1 text-xs text-accent">
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        {tpl.editDialog.addedBadge}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    aria-label={tpl.dialog.labelFor(row.key)}
                    value={labels[row.key] ?? ""}
                    disabled={row.removed}
                    onChange={(e) => setLabels((prev) => ({ ...prev, [row.key]: e.target.value }))}
                  />
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}

      {saveError ? <Status kind="danger">{saveError}</Status> : null}
    </Dialog>
  );
}
