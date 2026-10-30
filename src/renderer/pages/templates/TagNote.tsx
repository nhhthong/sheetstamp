import example from "../../assets/tags-example.webp?inline";
import { tpl } from "../../strings/templates";

/** Word templates: the tag text should equal the header of the data file, so the columns match at once. */
export function TagNote() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted">{tpl.dialog.tagNote}</p>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          {tpl.dialog.tagExample}
        </summary>
        <img
          src={example}
          alt={tpl.dialog.tagExampleAlt}
          loading="lazy"
          className="mt-2 w-full rounded-control border border-line"
        />
      </details>
    </div>
  );
}
