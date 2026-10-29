import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutBox } from "../../../../shared/image-layout";
import { IMAGE_LAYOUT_VERSION } from "../../../../shared/image-layout";
import * as imageIpc from "../../../../shared/ipc/images";
import { MAX_BOXES } from "../../../../shared/ipc/images";
import { Button } from "../../../components/ui/button";
import { Field, Input, Select } from "../../../components/ui/input";
import { Status } from "../../../components/ui/status";
import { call } from "../../../lib/ipc";
import { ied } from "../../../strings/image-editor";
import { type BoxChange, EditorCanvas } from "./EditorCanvas";
import { dictionaryFields, type FieldOption, newField, sampleText } from "./fields";
import { newBox } from "./new-box";

const NEW_FIELD = "__new__";
const STEP = 1;
const FAST_STEP = 10;

type Loaded = { name: string; bitmap: ImageBitmap };

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
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedField, setTypedField] = useState("");
  const [typedError, setTypedError] = useState("");
  const counter = useRef(0);

  useEffect(() => {
    let live = true;
    let bitmap: ImageBitmap | undefined;
    void (async () => {
      try {
        const [opened, fonts] = await Promise.all([
          call(imageIpc.openImageEditor, { id: templateId }),
          call(imageIpc.listFonts).catch(() => []),
        ]);
        if (!live) return;
        if (!opened.ok) return setLoadError(opened.message);
        // Decoded in the renderer from the bytes main sent: no URL, so the CSP needs no blob: source.
        bitmap = await createImageBitmap(new Blob([opened.value.background.slice()]));
        if (!live) return bitmap.close();
        const first = fonts[0];
        if (first) setFontFamily(first.family);
        setBoxes(opened.value.layout.boxes);
        setLabels(opened.value.labels);
        counter.current = opened.value.layout.boxes.length;
        setLoaded({ name: opened.value.name, bitmap });
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
  const labelOf = useCallback((field: string) => labels[field] ?? field, [labels]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setTyping(false);
      const box = boxes.find((b) => b.id === id);
      setAnnouncement(box ? ied.selected(labelOf(box.field), box.x, box.y) : ied.none);
    },
    [boxes, labelOf],
  );

  const change = useCallback((id: string, patch: BoxChange) => {
    setBoxes((all) => all.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setDirty(true);
    setMessage(null);
  }, []);

  function addBox() {
    if (!loaded || boxes.length >= MAX_BOXES) return;
    const used = new Set(boxes.map((b) => b.field));
    const field =
      (dictionaryFields.find((f) => !used.has(f.key)) ?? dictionaryFields[0])?.key ?? "ten";
    counter.current += 1;
    const box = newBox(
      field,
      boxes.length,
      { imageWidth: loaded.bitmap.width, imageHeight: loaded.bitmap.height, fontFamily },
      `box-${Date.now().toString(36)}-${counter.current}`,
    );
    const label = labels[field] ?? dictionaryFields.find((f) => f.key === field)?.label ?? field;
    setLabels((l) => ({ ...l, [field]: l[field] ?? label }));
    setBoxes([...boxes, box]);
    setSelectedId(box.id);
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

  function chooseField(box: LayoutBox, value: string) {
    if (value === NEW_FIELD) {
      setTyping(true);
      setTypedField("");
      setTypedError("");
      return;
    }
    setTyping(false);
    setBoxes((all) => all.map((b) => (b.id === box.id ? { ...b, field: value } : b)));
    setDirty(true);
    setMessage(null);
  }

  function addTypedField(box: LayoutBox) {
    const field = newField(typedField, labels);
    if (!field) return setTypedError(ied.fieldInvalid);
    setLabels((l) => ({ ...l, [field.key]: field.label }));
    setBoxes((all) => all.map((b) => (b.id === box.id ? { ...b, field: field.key } : b)));
    setTyping(false);
    setDirty(true);
    setMessage(null);
  }

  async function save() {
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

  const options: FieldOption[] = [
    ...dictionaryFields,
    ...Object.entries(labels)
      .filter(([key]) => !dictionaryFields.some((f) => f.key === key))
      .map(([key, label]) => ({ key, label })),
  ];
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
                  <Field label={ied.field}>
                    {(props) => (
                      <Select
                        {...props}
                        value={typing ? NEW_FIELD : selected.field}
                        onChange={(e) => chooseField(selected, e.target.value)}
                      >
                        {options.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                        <option value={NEW_FIELD}>{ied.newField}</option>
                      </Select>
                    )}
                  </Field>
                  {typing ? (
                    <div className="flex flex-col gap-2">
                      <Field label={ied.newFieldName} error={typedError}>
                        {(props) => (
                          <Input
                            {...props}
                            value={typedField}
                            onChange={(e) => setTypedField(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addTypedField(selected)}
                          />
                        )}
                      </Field>
                      <Button variant="secondary" size="sm" onClick={() => addTypedField(selected)}>
                        {ied.addField}
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-sm text-muted">{sampleText(selected.field, labels)}</p>
                  <Button variant="danger" size="sm" onClick={() => remove(selected)}>
                    {ied.deleteBox}
                  </Button>
                </div>
              ) : null}
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
