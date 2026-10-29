import { useState } from "react";
import { fieldKeyOf } from "../../../../shared/image-layout/field-key";
import { ied } from "../../../strings/image-editor";

/**
 * The field of a text box, typed as free text with no suggestions. The name is used when the user presses Enter or
 * leaves the input; a name with no letter or digit is refused and the input keeps showing the field it had.
 */
export function FieldNameInput({
  id,
  label,
  autoFocus,
  onCommit,
  ...aria
}: {
  id: string;
  /** The label of the box's current field. */
  label: string;
  autoFocus?: boolean;
  /** Uses the typed name for the box's field; false when the name has no letter or digit. */
  onCommit: (typed: string) => boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== "" && fieldKeyOf(draft.trim()) === "";

  function commit() {
    if (draft === null) return;
    const typed = draft.trim();
    if (typed === "" || typed === label || onCommit(typed)) setDraft(null);
  }

  return (
    <div>
      <input
        {...aria}
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={ied.fieldHint}
        value={draft ?? label}
        aria-invalid={invalid || aria["aria-invalid"]}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape" && draft !== null) {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
        className="w-full rounded-control border border-line bg-bg px-3 py-2 text-text placeholder:text-muted"
      />
      {invalid ? (
        <p role="status" className="mt-1 text-sm text-danger">
          {ied.fieldInvalid}
        </p>
      ) : null}
    </div>
  );
}
