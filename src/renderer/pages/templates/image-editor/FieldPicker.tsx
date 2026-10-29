import { useId, useState } from "react";
import { fieldKeyOf } from "../../../../shared/image-layout/field-key";
import { stripDiacritics } from "../../../../shared/text/diacritics";
import { ied } from "../../../strings/image-editor";
import type { FieldOption } from "./fields";

const MAX_SUGGESTIONS = 6;

/** Lowercase text without diacritics, so "ngay" finds "Ngày sinh" and "NGAY_SINH". */
const plain = (text: string) => stripDiacritics(text.normalize("NFC")).toLowerCase();

type Item = { kind: "field"; option: FieldOption } | { kind: "create"; text: string };

/** Fields that match what was typed, best first: names that start with it, then names that contain it. */
export function suggest(options: readonly FieldOption[], typed: string): FieldOption[] {
  const q = plain(typed).trim();
  if (q === "") return [];
  const rank = (o: FieldOption): number => {
    const names = [plain(o.label), o.key];
    if (names.some((n) => n.startsWith(q))) return 0;
    if (names.some((n) => n.split(/[\s_]+/).some((word) => word.startsWith(q)))) return 1;
    return names.some((n) => n.includes(q)) ? 2 : 3;
  };
  return options
    .map((option) => ({ option, rank: rank(option) }))
    .filter((x) => x.rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_SUGGESTIONS)
    .map((x) => x.option);
}

/**
 * The field of a text box: a text input that shows the chosen field. Nothing is listed until the user types; then
 * the matching fields appear (never the whole dictionary), and a typed name no field has can be added as a new one.
 */
export function FieldPicker({
  id,
  value,
  labelOf,
  options,
  onPick,
  onCreate,
  ...aria
}: {
  id: string;
  value: string;
  labelOf: (key: string) => string;
  options: readonly FieldOption[];
  onPick: (key: string) => void;
  /** Adds the typed name as a new field and uses it; false when the name has no letter or digit. */
  onCreate: (typed: string) => boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const listId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const typed = draft?.trim() ?? "";
  const matches = suggest(options, typed);
  const key = fieldKeyOf(typed);
  const exists = options.some((o) => o.key === key || plain(o.label) === plain(typed));
  const items: Item[] = matches.map((option) => ({ kind: "field", option }));
  if (typed !== "" && key !== "" && !exists) items.push({ kind: "create", text: typed });
  const invalid = typed !== "" && key === "";
  const open = items.length > 0;
  const current = Math.min(active, Math.max(0, items.length - 1));

  function choose(item: Item | undefined) {
    if (!item) return;
    if (item.kind === "field") onPick(item.option.key);
    else if (!onCreate(item.text)) return;
    setDraft(null);
  }

  return (
    <div className="relative">
      <input
        {...aria}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${current}` : undefined}
        aria-invalid={invalid || aria["aria-invalid"]}
        autoComplete="off"
        spellCheck={false}
        placeholder={ied.fieldHint}
        value={draft ?? labelOf(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(0);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && items.length > 0) {
            e.preventDefault();
            setActive((current + 1) % items.length);
          } else if (e.key === "ArrowUp" && items.length > 0) {
            e.preventDefault();
            setActive((current - 1 + items.length) % items.length);
          } else if (e.key === "Enter" && draft !== null) {
            e.preventDefault();
            choose(items[current]);
          } else if (e.key === "Escape" && draft !== null) {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
        className="w-full rounded-control border border-line bg-bg px-3 py-2 text-text placeholder:text-muted"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ied.field}
          className="absolute inset-x-0 top-full z-10 m-0 mt-1 flex list-none flex-col overflow-hidden rounded-control border border-line bg-bg p-1 shadow-lg"
        >
          {items.map((item, i) => (
            <li
              key={item.kind === "field" ? item.option.key : "create"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              // mousedown, not click: the input would lose focus first and close the list.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-control px-2 py-1.5 ${i === current ? "bg-panel font-semibold" : ""}`}
            >
              {item.kind === "field" ? (
                <>
                  {item.option.label}
                  <span className="ml-2 text-sm text-muted">{item.option.key}</span>
                </>
              ) : (
                ied.fieldCreate(item.text)
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {invalid ? (
        <p role="status" className="mt-1 text-sm text-danger">
          {ied.fieldInvalid}
        </p>
      ) : null}
    </div>
  );
}
