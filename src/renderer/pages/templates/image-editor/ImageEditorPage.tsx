import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutBox } from "../../../../shared/image-layout";
import { IMAGE_LAYOUT_VERSION } from "../../../../shared/image-layout";
import { boxFit } from "../../../../shared/image-layout/bounds";
import type { FontFamilyInfo } from "../../../../shared/ipc/images";
import * as imageIpc from "../../../../shared/ipc/images";
import { MAX_BOXES } from "../../../../shared/ipc/images";
import { Button } from "../../../components/ui/button";
import { Field } from "../../../components/ui/input";
import { Status } from "../../../components/ui/status";
import { call } from "../../../lib/ipc";
import { ied } from "../../../strings/image-editor";
import { BoxInspector, type InspectorChange } from "./BoxInspector";
import { defaultFont } from "./default-font";
import { EditorCanvas } from "./EditorCanvas";
import { FieldNameInput } from "./FieldNameInput";
import { labelFor, newField } from "./fields";
import { missingFamilies } from "./inspector";
import { newBox } from "./new-box";

const STEP = 1;
const FAST_STEP = 10;

type Loaded = { name: string; bitmap: ImageBitmap; bytes: Uint8Array };
type Patch = Partial<Omit<LayoutBox, "id">>;
/** The editor sub-page of an image template: the background, its text boxes, and "Lưu mẫu". No undo. */
export function ImageEditorPage({
  templateId,
  onBack,
}: {
  templateId: string;
  onBack: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [boxes, setBoxes] = useState<LayoutBox[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [fonts, setFonts] = useState<FontFamilyInfo[] | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    let live = true;
    let bitmap: ImageBitmap | undefined;
    void (async () => {
      try {
        const [opened, fonts] = await Promise.all([
          call(imageIpc.openImageEditor, { id: templateId }),
          call(imageIpc.listFonts).catch(() => null),
        ]);
        if (!live) return;
        if (!opened.ok) return setLoadError(opened.message);
        // Decoded in the renderer from the bytes main sent: no URL, so the CSP needs no blob: source.
        bitmap = await createImageBitmap(new Blob([opened.value.background.slice()]));
        if (!live) return bitmap.close();
        const first = defaultFont(fonts ?? []);
        if (first) setFontFamily(first);
        setFonts(fonts);
        setBoxes(opened.value.layout.boxes);
        setLabels(opened.value.labels);
        counter.current = opened.value.layout.boxes.length;
        setLoaded({ name: opened.value.name, bitmap, bytes: opened.value.background });
      } catch {
        if (live) setLoadError(ied.loadFailed);
      }
    })();
    return () => {
      live = false;
      bitmap?.close();
    };
  }, [templateId]);

  const selected = boxes.find((b) => b.id === selectedId) ?? null;
  const labelOf = useCallback((field: string) => labelFor(field, labels), [labels]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const box = boxes.find((b) => b.id === id);
      setAnnouncement(box ? ied.selected(labelOf(box.field), box.x, box.y) : ied.none);
    },
    [boxes, labelOf],
  );

  const change = useCallback((id: string, patch: Patch) => {
    setBoxes((all) => all.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setDirty(true);
    setMessage(null);
  }, []);

  // In the order the fields were added: main pairs the n-th field with the n-th column.
  const orderedFields = [...new Set(boxes.map((b) => b.field))];
  // Boxes left outside the image (for example after the background was replaced): flagged, never moved here.
  const flagged = new Set(
    loaded
      ? boxes
          .filter((b) => boxFit(b, loaded.bitmap.width, loaded.bitmap.height) !== "inside")
          .map((b) => b.id)
      : [],
  );
  const missing = fonts ? missingFamilies(boxes, fonts) : [];

  function addBox() {
    if (!loaded || boxes.length >= MAX_BOXES) return;
    // A new field named "Trường n"; the name is selected in the inspector, so typing replaces it.
    const used = new Set(boxes.map((b) => b.field));
    let n = used.size + 1;
    while (used.has(newField(`${ied.fieldNew} ${n}`, {})?.key ?? "")) n += 1;
    const created = newField(`${ied.fieldNew} ${n}`, labels);
    if (!created) return;
    const field = created.key;
    counter.current += 1;
    const box = newBox(
      field,
      boxes.length,
      { imageWidth: loaded.bitmap.width, imageHeight: loaded.bitmap.height, fontFamily },
      `box-${Date.now().toString(36)}-${counter.current}`,
    );
    const label = created.label;
    setLabels((l) => ({ ...l, [field]: l[field] ?? label }));
    setBoxes([...boxes, box]);
    setSelectedId(box.id);
    setJustAdded(box.id);
    setAnnouncement(ied.selected(label, box.x, box.y));
    setDirty(true);
    setMessage(null);
  }

  function remove(box: LayoutBox) {
    setBoxes((all) => all.filter((b) => b.id !== box.id));
    setSelectedId(null);
    setAnnouncement(ied.removed(labelOf(box.field)));
    setDirty(true);
    setMessage(null);
  }

  function onKeyDown(event: React.KeyboardEvent, box: LayoutBox) {
    const step = event.shiftKey ? FAST_STEP : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const x = box.x + move[0];
      const y = box.y + move[1];
      change(box.id, { x, y });
      setAnnouncement(ied.moved(x, y));
    } else if (event.key === "Delete") {
      event.preventDefault();
      remove(box);
    }
  }

  /**
   * The typed name becomes the box's field: a field of that name that already exists is reused, else a new one is
   * made (see `newField`). A field left without a box disappears with its last box.
   */
  function nameField(box: LayoutBox, typed: string): boolean {
    const field = newField(typed, labels);
    if (!field) return false;
    setLabels((l) => ({ ...l, [field.key]: l[field.key] ?? field.label }));
    setBoxes((all) => all.map((b) => (b.id === box.id ? { ...b, field: field.key } : b)));
    setDirty(true);
    setMessage(null);
    return true;
  }

  async function save() {
    if (missing.length > 0) return setMessage({ kind: "danger", text: ied.saveBlockedMissingFont });
    setSaving(true);
    setMessage(null);
    try {
      const used = Object.fromEntries(boxes.map((b) => [b.field, labelOf(b.field)]));
      const result = await call(imageIpc.saveImageLayout, {
        id: templateId,
        layout: { version: IMAGE_LAYOUT_VERSION, boxes },
        labels: used,
      });
      if (result.ok) {
        setDirty(false);
        setMessage({ kind: "success", text: ied.saved });
      } else setMessage({ kind: "danger", text: result.message });
    } catch {
      setMessage({ kind: "danger", text: ied.loadFailed });
    }
    setSaving(false);
  }

  const fieldCount = new Set(boxes.map((b) => b.field)).size;

  return (
    <section
      aria-label={loaded ? ied.title(loaded.name) : ied.back}
      className="px-[44px] py-6 max-[819px]:px-4"
    >
      <header className="mb-4 flex flex-wrap items-center gap-3">
        {leaving ? (
          <div className="flex items-center gap-2" role="group">
            <span className="font-semibold">{ied.leaveUnsaved}</span>
            <Button variant="danger" size="sm" onClick={onBack}>
              {ied.discard}
            </Button>
            <Button variant="secondary" size="sm" autoFocus onClick={() => setLeaving(false)}>
              {ied.stay}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => (dirty ? setLeaving(true) : onBack())}>
            {ied.back}
          </Button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">
          {loaded ? ied.title(loaded.name) : ied.back}
        </h1>
        {loaded ? (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={addBox} disabled={boxes.length >= MAX_BOXES}>
              {ied.addText}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? ied.saving : ied.save}
            </Button>
          </div>
        ) : null}
      </header>

      {loadError ? <Status kind="danger">{loadError}</Status> : null}
      {!loaded && !loadError ? <p className="text-muted">{ied.loading}</p> : null}

      {loaded ? (
        <>
          {missing.length > 0 ? (
            <div data-testid="missing-font" className="mb-3">
              <Status kind="warning">{ied.missingFont(missing)}</Status>
            </div>
          ) : null}
          {flagged.size > 0 ? (
            <div data-testid="outside-banner" className="mb-3">
              <Status kind="warning">{ied.outsideBanner(flagged.size)}</Status>
            </div>
          ) : null}
          <div className="mb-3 flex min-h-6 items-center gap-3 text-sm" aria-live="off">
            {message ? <Status kind={message.kind}>{message.text}</Status> : null}
            {!message && dirty ? <span className="text-muted">{ied.unsaved}</span> : null}
            <span className="text-muted">{ied.fieldCount(fieldCount)}</span>
          </div>
          <div className="flex gap-6 max-[1099px]:flex-col">
            <div className="flex min-w-0 flex-1 justify-center rounded-dialog border border-line bg-panel p-2">
              <div style={{ height: "calc(100vh - 260px)", minHeight: 300 }} className="w-full">
                <EditorCanvas
                  background={loaded.bitmap}
                  boxes={boxes}
                  labels={labels}
                  selectedId={selectedId}
                  flaggedIds={flagged}
                  onSelect={select}
                  onChange={change}
                />
              </div>
            </div>
            <aside className="flex w-72 shrink-0 flex-col gap-4 max-[1099px]:w-full">
              <p className="text-sm text-muted">{ied.hint}</p>
              {boxes.length === 0 ? <p>{ied.empty}</p> : null}
              <ul aria-label={ied.listLabel} className="m-0 flex list-none flex-col gap-1 p-0">
                {boxes.map((box, index) => (
                  <li key={box.id}>
                    <button
                      type="button"
                      data-testid="box-item"
                      aria-pressed={box.id === selectedId}
                      onClick={() => select(box.id)}
                      onKeyDown={(e) => onKeyDown(e, box)}
                      className={`w-full rounded-control border px-3 py-2 text-left ${box.id === selectedId ? "border-accent bg-panel" : "border-line"}`}
                    >
                      <span className="block font-semibold">
                        {ied.boxName(labelOf(box.field), index + 1)}
                        {flagged.has(box.id) ? (
                          <span data-testid="box-outside" className="ml-2 text-sm text-warning">
                            {ied.outsideBadge}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-sm text-muted" data-testid="box-position">
                        {ied.position(box.x, box.y, box.width)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected ? (
                <div className="flex flex-col gap-3 rounded-dialog border border-line p-3">
                  <Field label={ied.fieldNumber(orderedFields.indexOf(selected.field) + 1)}>
                    {(props) => (
                      <FieldNameInput
                        {...props}
                        key={selected.id}
                        label={labelOf(selected.field)}
                        autoFocus={selected.id === justAdded}
                        onCommit={(typed) => nameField(selected, typed)}
                      />
                    )}
                  </Field>
                  <p className="text-sm text-muted">
                    {ied.fieldColumnHint(orderedFields.indexOf(selected.field) + 1)}
                  </p>
                  <BoxInspector
                    box={selected}
                    fonts={fonts ?? []}
                    onChange={(patch: InspectorChange) => change(selected.id, patch)}
                    onDelete={() => remove(selected)}
                  />
                </div>
              ) : (
                <p className="rounded-dialog border border-line p-3 text-muted">{ied.selectBox}</p>
              )}
            </aside>
          </div>
          <p role="status" aria-live="polite" className="sr-only" data-testid="editor-live">
            {announcement}
          </p>
        </>
      ) : null}
    </section>
  );
}
