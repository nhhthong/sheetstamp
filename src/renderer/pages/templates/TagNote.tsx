import { tpl } from "../../strings/templates";

const demo = tpl.dialog.tagDemo;
const INDEXES = [0, 1, 2] as const;
// The two-column picture is drawn on a 1000 x 140 grid: header centres along the table top, line centres in the contract.
const HEAD_X = [83, 250, 417] as const;
const LINE_Y = [26, 54, 82] as const;

/** Word templates: the tag text should equal the header of the data file, so the columns match at once. */
export function TagNote() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted">{tpl.dialog.tagNote}</p>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          {tpl.dialog.tagExample}
        </summary>
        <div role="img" aria-label={demo.label} className="ss-demo mt-2">
          <div className="ss-demo-stage">
            <p className="ss-demo-cap">{demo.data}</p>
            <div className="ss-demo-table">
              {INDEXES.map((i) => (
                <span key={demo.headers[i]} className="ss-demo-head">
                  <span className={`ss-demo-hl ss-i${i}`} />
                  {demo.headers[i]}
                </span>
              ))}
              {INDEXES.map((i) => (
                <span key={demo.values[i]} className="ss-demo-cell">
                  {demo.values[i]}
                </span>
              ))}
            </div>
            <p className="ss-demo-cap">{demo.contract}</p>
            <div className="ss-demo-paper">
              {INDEXES.map((i) => (
                <p key={demo.lines[i]} className="ss-demo-line">
                  <span className="text-muted">{demo.lines[i]}</span>
                  <span className="ss-demo-slot">
                    <span className={`ss-demo-tag ss-i${i}`}>{`{{${demo.headers[i]}}}`}</span>
                    <span className={`ss-demo-value ss-i${i}`}>{demo.values[i]}</span>
                  </span>
                </p>
              ))}
            </div>
            <svg
              aria-hidden="true"
              className="ss-demo-arrows"
              viewBox="0 0 1000 140"
              preserveAspectRatio="none"
            >
              {INDEXES.map((i) => (
                <path
                  key={i}
                  className={`ss-arrow ss-i${i}`}
                  pathLength={1}
                  d={`M ${HEAD_X[i]} 40 C ${HEAD_X[i]} 4 410 ${LINE_Y[i]} 550 ${LINE_Y[i]}`}
                />
              ))}
            </svg>
            {INDEXES.map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`ss-demo-tip ss-i${i}`}
                style={{ top: `calc(${LINE_Y[i]}rem / 16 - 5px)` }}
              />
            ))}
            {INDEXES.map((i) => (
              <span key={i} aria-hidden="true" className={`ss-demo-chip ss-i${i}`}>
                {demo.headers[i]}
              </span>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
