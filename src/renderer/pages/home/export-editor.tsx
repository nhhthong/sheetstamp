import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import type { ExportField, PatternProblemView } from "../../../shared/ipc/export";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Status } from "../../components/ui/status";
import { cn } from "../../lib/cn";
import { homeExport as t } from "../../strings/home-export";
import type { Chip } from "./export-pattern";

export const problemText = (problem: PatternProblemView): string => {
  switch (problem.kind) {
    case "empty":
      return t.problem.empty;
    case "path-characters":
      return t.problem.pathCharacters(problem.text);
    case "unknown-field":
      return t.problem.unknownField(problem.key);
  }
};

/** One piece of the pattern. Fields are blue, fixed text is neutral; both can be removed. The kind is also in the text. */
function PatternChip({
  chip,
  label,
  onRemove,
}: {
  chip: Chip;
  label: string;
  onRemove: () => void;
}) {
  const field = chip.type === "field";
  return (
    <li
      data-testid="pattern-chip"
      data-kind={chip.type}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border py-1 pr-1 pl-3",
        field ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-text",
      )}
    >
      <span className="sr-only">
        {field ? t.editor.fieldChip(label) : t.editor.textChip(label)}
      </span>
      <span aria-hidden="true" className="min-w-0 break-words whitespace-pre-wrap">
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.editor.remove(label)}
        className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-line"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

/**
 * The filename editor of step 4: the pattern as chips, "+ field" buttons, fixed text, the diacritics option and
 * "Lưu mẫu tên này vào mẫu". It only edits the chips; the example name and the problems come from main.
 */
export function ExportEditor({
  chips,
  fields,
  problems,
  removeDiacritics,
  saveState,
  onChips,
  onDiacritics,
  onSave,
  onDone,
}: {
  chips: readonly Chip[];
  fields: readonly ExportField[];
  problems: readonly PatternProblemView[];
  removeDiacritics: boolean;
  saveState: "idle" | "saved" | "failed";
  onChips: (chips: Chip[]) => void;
  onDiacritics: (value: boolean) => void;
  onSave: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const labelOf = new Map(fields.map((f) => [f.key, f.label]));

  const addText = () => {
    if (text === "") return;
    onChips([...chips, { type: "text", value: text }]);
    setText("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addText();
    }
  };

  return (
    <section
      aria-label={t.editor.label}
      data-testid="filename-editor"
      className="flex flex-col gap-4 rounded-control border border-line bg-panel p-4"
    >
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t.editor.patternLabel}</span>
        {chips.length === 0 ? (
          <p className="text-muted">{t.editor.chipsEmpty}</p>
        ) : (
          <ul aria-label={t.editor.patternLabel} className="m-0 flex list-none flex-wrap gap-2 p-0">
            {chips.map((chip, index) => (
              <PatternChip
                key={index}
                chip={chip}
                label={chip.type === "field" ? (labelOf.get(chip.key) ?? chip.key) : chip.value}
                onRemove={() => onChips(chips.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t.editor.add}</span>
        {fields.map((field) => (
          <Button
            key={field.key}
            variant="secondary"
            size="sm"
            aria-label={t.editor.addFieldLabel(field.label)}
            onClick={() => onChips([...chips, { type: "field", key: field.key }])}
          >
            {t.editor.addField(field.label)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="export-fixed-text" className="font-semibold">
          {t.editor.textLabel}
        </label>
        <div className="flex gap-2">
          <Input
            id="export-fixed-text"
            value={text}
            placeholder={t.editor.textPlaceholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKey}
            className="max-w-xs"
          />
          <Button variant="secondary" disabled={text === ""} onClick={addText}>
            {t.editor.textAdd}
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={removeDiacritics}
          onChange={(event) => onDiacritics(event.target.checked)}
          className="size-5 accent-[var(--accent)]"
        />
        {t.editor.removeDiacritics}
      </label>

      {problems.length > 0 ? (
        <ul
          role="alert"
          data-testid="pattern-problems"
          className="m-0 flex list-none flex-col gap-1 p-0"
        >
          {problems.map((problem, index) => (
            <li key={index}>
              <Status kind="danger">{problemText(problem)}</Status>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="secondary" disabled={problems.length > 0} onClick={onDone}>
          {t.editor.done}
        </Button>
        <button
          type="button"
          onClick={onSave}
          disabled={problems.length > 0}
          className="rounded-control px-2 py-1 font-semibold text-accent underline hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.editor.savePattern}
        </button>
        <span role="status" className="text-sm">
          {saveState === "saved" ? (
            <Status kind="success">{t.editor.saved}</Status>
          ) : saveState === "failed" ? (
            <Status kind="danger">{t.editor.saveFailed}</Status>
          ) : null}
        </span>
      </div>
    </section>
  );
}
