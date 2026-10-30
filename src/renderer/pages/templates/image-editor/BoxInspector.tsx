import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";
import { useEffect, useState } from "react";
import type { LayoutBox } from "../../../../shared/image-layout";
import type { FontFamilyInfo, FontStyle } from "../../../../shared/ipc/images";
import { Button } from "../../../components/ui/button";
import { Field, Input, Select } from "../../../components/ui/input";
import { cn } from "../../../lib/cn";
import { ied } from "../../../strings/image-editor";
import {
  FONT_STYLES,
  isHexColor,
  pickerColor,
  styleAfterFamilyChange,
  styleAvailable,
} from "./inspector";

export type InspectorChange = Partial<
  Pick<LayoutBox, "fontFamily" | "fontSize" | "color" | "style" | "align" | "maxLines" | "overflow">
>;

const ALIGNS = ["left", "center", "right"] as const;
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;

/** Bold and italic as two toggles: the four stored styles are their combinations. */
const STYLE_OF = {
  "false,false": "normal",
  "true,false": "bold",
  "false,true": "italic",
  "true,true": "bolditalic",
} as const;
const isBold = (s: FontStyle) => s === "bold" || s === "bolditalic";
const isItalic = (s: FontStyle) => s === "italic" || s === "bolditalic";

/** A number input that keeps what the user types and applies only a whole number in range. */
function NumberField({
  label,
  value,
  min,
  max,
  error,
  onValid,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  error: string;
  onValid: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(String(value));
    setBad(false);
  }, [value]);
  return (
    <Field label={label} error={bad ? error : undefined}>
      {(props) => (
        <Input
          {...props}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            const ok = e.target.value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
            setBad(!ok);
            if (ok) onValid(n);
          }}
          onBlur={() => {
            setDraft(String(value));
            setBad(false);
          }}
        />
      )}
    </Field>
  );
}

/** Colour picker plus hex. An invalid hex keeps the last valid colour and says why. */
function ColorField({ value, onValid }: { value: string; onValid: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(value);
    setBad(false);
  }, [value]);
  return (
    <Field label={ied.colorHex} error={bad ? ied.colorInvalid(value) : undefined}>
      {(props) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={ied.colorPicker}
            value={pickerColor(value)}
            onChange={(e) => onValid(e.target.value)}
            className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-line bg-bg p-1"
          />
          <Input
            {...props}
            value={draft}
            spellCheck={false}
            onChange={(e) => {
              const text = e.target.value.trim();
              setDraft(e.target.value);
              const ok = isHexColor(text);
              setBad(!ok);
              if (ok) onValid(text.toLowerCase());
            }}
            onBlur={() => {
              setDraft(value);
              setBad(false);
            }}
          />
        </div>
      )}
    </Field>
  );
}

const iconButton = (on: boolean) =>
  cn(
    "flex size-9 cursor-pointer items-center justify-center rounded-control border shadow-card focus-visible:outline-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
    on ? "border-accent bg-panel text-accent" : "border-line bg-raised text-text hover:bg-panel",
  );

/** Icon radio group (alignment). The label text stays for screen readers and as a tooltip. */
function IconChoice({
  legend,
  name,
  options,
  value,
  onPick,
}: {
  legend: string;
  name: string;
  options: readonly { value: (typeof ALIGNS)[number]; label: string }[];
  value: (typeof ALIGNS)[number];
  onPick: (value: (typeof ALIGNS)[number]) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 font-semibold">{legend}</legend>
      <div className="flex gap-1">
        {options.map((o) => {
          const Icon = ALIGN_ICONS[o.value];
          return (
            <label key={o.value} title={o.label} className={iconButton(o.value === value)}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={o.value === value}
                onChange={() => onPick(o.value)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-5" />
              <span className="sr-only">{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The inspector of the selected box: everything but the field choice. Changes go up one patch at a time. */
export function BoxInspector({
  box,
  fonts,
  onChange,
  onDelete,
}: {
  box: LayoutBox;
  fonts: readonly FontFamilyInfo[];
  onChange: (patch: InspectorChange) => void;
  onDelete: () => void;
}) {
  const installed = fonts.some((f) => f.family === box.fontFamily);
  const bold = isBold(box.style);
  const italic = isItalic(box.style);
  const styleFor = (nextBold: boolean, nextItalic: boolean): FontStyle =>
    STYLE_OF[`${nextBold},${nextItalic}`];
  const canBold = styleAvailable(fonts, box.fontFamily, styleFor(!bold, italic));
  const canItalic = styleAvailable(fonts, box.fontFamily, styleFor(bold, !italic));
  const lacking = FONT_STYLES.some((s: FontStyle) => !styleAvailable(fonts, box.fontFamily, s));
  return (
    <>
      <Field label={ied.font} hint={ied.fontNote}>
        {(props) => (
          <Select
            {...props}
            value={box.fontFamily}
            onChange={(e) =>
              onChange({
                fontFamily: e.target.value,
                style: styleAfterFamilyChange(fonts, e.target.value, box.style),
              })
            }
          >
            {installed ? null : (
              <option value={box.fontFamily} disabled>
                {ied.fontMissingOption(box.fontFamily)}
              </option>
            )}
            {fonts.map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <NumberField
        label={ied.fontSize}
        value={box.fontSize}
        min={1}
        max={1000}
        error={ied.fontSizeInvalid}
        onValid={(fontSize) => onChange({ fontSize })}
      />
      <ColorField value={box.color} onValid={(color) => onChange({ color })} />
      <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <legend className="mb-1 p-0 font-semibold">{ied.fontStyle}</legend>
        <div className="flex gap-1">
          <button
            type="button"
            title={ied.styles.bold}
            aria-label={ied.styles.bold}
            aria-pressed={bold}
            disabled={!canBold}
            onClick={() => onChange({ style: styleFor(!bold, italic) })}
            className={cn(iconButton(bold), "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <Bold aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            title={ied.styles.italic}
            aria-label={ied.styles.italic}
            aria-pressed={italic}
            disabled={!canItalic}
            onClick={() => onChange({ style: styleFor(bold, !italic) })}
            className={cn(iconButton(italic), "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <Italic aria-hidden="true" className="size-5" />
          </button>
        </div>
      </fieldset>
      {lacking ? <p className="text-sm text-muted">{ied.styleMissing}</p> : null}
      <IconChoice
        legend={ied.align}
        name={`align-${box.id}`}
        options={ALIGNS.map((a) => ({ value: a, label: ied.aligns[a] }))}
        value={box.align}
        onPick={(align) => onChange({ align })}
      />
      <Button variant="danger" size="sm" onClick={onDelete}>
        {ied.deleteBox}
      </Button>
    </>
  );
}
