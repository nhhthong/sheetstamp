import { useEffect, useId, useRef, useState } from "react";
import { type FieldMapping, MAX_FIXED_TEXT } from "../../../shared/ipc/mapping";
import { isResolved } from "../../../shared/mapping/values";
import { Input, Select } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { cn } from "../../lib/cn";
import { homeMapping as t } from "../../strings/home-mapping";

/** Typing fixed text updates the preview and the saved mapping after this pause (and when the box loses focus). */
export const FIXED_TEXT_DELAY_MS = 250;

const FIXED = "fixed";
const EMPTY = "empty";
const columnValue = (index: number) => `c:${index}`;

function selectValue(entry: FieldMapping | undefined, columns: readonly string[]): string {
  if (!entry) return "";
  if (entry.kind === "fixed") return FIXED;
  if (entry.kind === "empty") return EMPTY;
  const index = columns.indexOf(entry.column);
  return index < 0 ? "" : columnValue(index);
}

export type FieldRowProps = {
  label: string;
  entry: FieldMapping | undefined;
  columns: readonly string[];
  /** The field had no column when the step opened: once settled it shows "Đã chọn" and stays in place. */
  pinned: boolean;
  /** The first data row's cell for the chosen column; undefined when the field has no column. */
  value?: string;
  /** Another field took this field's column and the user has not chosen again. */
  taken?: boolean;
  onChange: (entry: FieldMapping | null) => void;
};

/** One field: its label, a dropdown for the column, and the text box for fixed text. */
export function FieldRow({ label, entry, columns, pinned, value, taken, onChange }: FieldRowProps) {
  const id = useId();
  const resolved = isResolved(entry);
  const open = !resolved;
  const [text, setText] = useState(entry?.kind === "fixed" ? entry.text : "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => () => clearTimeout(timer.current), []);

  function choose(value: string) {
    clearTimeout(timer.current);
    if (value === "") return onChange(null);
    if (value === EMPTY) return onChange({ kind: "empty" });
    if (value === FIXED) {
      setText("");
      return onChange({ kind: "fixed", text: "" });
    }
    const column = columns[Number(value.slice(2))];
    if (column !== undefined) onChange({ kind: "column", column });
  }

  function type(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => latest.current({ kind: "fixed", text: next }),
      FIXED_TEXT_DELAY_MS,
    );
  }

  function commitNow() {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    if (entry?.kind === "fixed" && entry.text !== text) onChange({ kind: "fixed", text });
  }

  return (
    <li
      data-testid="mapping-row"
      data-field={label}
      data-state={open ? "unresolved" : "resolved"}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-control border px-3 py-3",
        open ? "border-warning bg-warning-bg" : "glass",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="min-w-0 truncate font-semibold" title={label}>
          {label}
        </label>
        {open ? <Status kind="warning">{t.unmatchedMarker}</Status> : null}
        {!open && pinned ? <Status kind="success">{t.resolvedMarker}</Status> : null}
      </div>
      <Select
        id={id}
        aria-label={t.columnFor(label)}
        value={selectValue(entry, columns)}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="">{t.choose}</option>
        <optgroup label={t.columnsGroup}>
          {columns.map((column, index) => (
            <option key={index} value={columnValue(index)}>
              {column}
            </option>
          ))}
        </optgroup>
        <option value={FIXED}>{t.fixedOption}</option>
        <option value={EMPTY}>{t.emptyOption}</option>
      </Select>
      {value !== undefined ? (
        <p data-testid="first-value" className="text-sm text-muted">
          {t.firstValue(value === "" ? t.emptyCell : value)}
        </p>
      ) : null}
      {entry?.kind === "fixed" ? (
        <Input
          value={text}
          maxLength={MAX_FIXED_TEXT}
          aria-label={t.fixedLabel(label)}
          placeholder={t.fixedPlaceholder}
          onChange={(event) => type(event.target.value)}
          onBlur={commitNow}
        />
      ) : null}
      {taken ? (
        <Status kind="warning" alert>
          {t.takenAlert}
        </Status>
      ) : open ? (
        <p className="text-sm text-muted">{t.explanation(label)}</p>
      ) : null}
    </li>
  );
}
