import { useEffect, useState } from "react";
import type { LayoutBox } from "../../../../shared/image-layout";
import type { FontFamilyInfo, FontStyle } from "../../../../shared/ipc/images";
import { Button } from "../../../components/ui/button";
import { Field, Input, Select } from "../../../components/ui/input";
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
const OVERFLOWS = ["shrink", "wrap", "truncate", "error"] as const;

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

function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onPick,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-1 rounded-control border px-2 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${o.value === value ? "border-accent bg-panel font-semibold" : "border-line"} ${o.disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              disabled={o.disabled}
              onChange={() => onPick(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
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
  const styleOptions = FONT_STYLES.map((s: FontStyle) => ({
    value: s,
    label: ied.styles[s],
    disabled: !styleAvailable(fonts, box.fontFamily, s),
  }));
  const lacking = styleOptions.some((o) => o.disabled);
  const radioName = `style-${box.id}`;
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
      <Segmented
        legend={ied.fontStyle}
        name={radioName}
        options={styleOptions}
        value={box.style}
        onPick={(style) => onChange({ style })}
      />
      {lacking ? <p className="text-sm text-muted">{ied.styleMissing}</p> : null}
      <Segmented
        legend={ied.align}
        name={`align-${box.id}`}
        options={ALIGNS.map((a) => ({ value: a, label: ied.aligns[a] }))}
        value={box.align}
        onPick={(align) => onChange({ align })}
      />
      <details className="flex flex-col gap-3">
        <summary className="cursor-pointer font-semibold">{ied.advanced}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <NumberField
            label={ied.maxLines}
            value={box.maxLines}
            min={1}
            max={100}
            error={ied.maxLinesInvalid}
            onValid={(maxLines) => onChange({ maxLines })}
          />
          <Field label={ied.overflow}>
            {(props) => (
              <Select
                {...props}
                value={box.overflow}
                onChange={(e) => {
                  const overflow = OVERFLOWS.find((o) => o === e.target.value);
                  if (overflow) onChange({ overflow });
                }}
              >
                {OVERFLOWS.map((o) => (
                  <option key={o} value={o}>
                    {ied.overflows[o]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </details>
      <Button variant="danger" size="sm" onClick={onDelete}>
        {ied.deleteBox}
      </Button>
    </>
  );
}
