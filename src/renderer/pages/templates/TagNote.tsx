import { tpl } from "../../strings/templates";

const demo = tpl.dialog.tagDemo;

/** Word templates: the tag text should equal the header of the data file, so the columns match at once. */
export function TagNote() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted">{tpl.dialog.tagNote}</p>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          {tpl.dialog.tagExample}
        </summary>
        <div
          role="img"
          aria-label={demo.label}
          className="mt-2 flex flex-col gap-3 rounded-control border border-line bg-panel p-3"
        >
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-control border border-line bg-line">
            {demo.headers.map((header) => (
              <span key={header} className="ss-demo-head bg-raised px-2 py-1 font-semibold">
                {header}
              </span>
            ))}
            {demo.values.map((value) => (
              <span key={value} className="bg-raised px-2 py-1 text-muted">
                {value}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-control bg-raised p-3 shadow-card">
            {demo.lines.map((line, i) => (
              <p key={line} className="flex items-baseline gap-2">
                <span>{line}</span>
                <span className="ss-demo-slot">
                  <span className="ss-demo-tag">{`{{${demo.headers[i]}}}`}</span>
                  <span className="ss-demo-value">{demo.values[i]}</span>
                </span>
              </p>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
