import { renderAsync } from "docx-preview";
import { useEffect, useMemo, useRef, useState } from "react";
import { fill } from "../../shared/ipc/preview";
import { Status } from "../components/ui/status";
import { call } from "../lib/ipc";
import { preview as strings } from "../strings/preview";
import { applyMarkers, markedText } from "./markers";
import "./preview.css";

export type WordPreviewProps = {
  /** The template file. */
  template: Uint8Array;
  /** The row's values keyed by tag key. An empty string shows `(trống)`. */
  values: Readonly<Record<string, string>>;
  /** Tag keys without a column; they show `(thiếu)`. A tag missing from `values` counts as unmapped too. */
  unmapped?: readonly string[];
  className?: string;
};

type View =
  | { kind: "loading" }
  | { kind: "pages" }
  | { kind: "text"; text: string }
  | { kind: "failed" };

/** docx-preview draws one `section.docx` per page; none means it drew nothing useful. */
const drewPages = (host: HTMLElement) => host.querySelector("section.docx") !== null;

/** A link in the document must never move the window: drop the target, keep the text. */
function disarmLinks(host: HTMLElement) {
  for (const a of host.querySelectorAll("a")) {
    a.removeAttribute("href");
    a.removeAttribute("target");
  }
}

/**
 * The filled Word document as pages, with filled values highlighted, `(trống)` in red for an empty value and
 * `(thiếu)` for a tag without a column. The main process fills the template; this draws the bytes.
 */
export function WordPreview({ template, values, unmapped = [], className }: WordPreviewProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLPreElement>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  // Callers often build `values` on every render; key the work on its content instead.
  const key = useMemo(() => JSON.stringify([values, unmapped]), [values, unmapped]);

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const filled = await call(fill, {
          docx: template,
          values: { ...values },
          unmapped: [...unmapped],
        });
        if (!current) return;
        // Draw off screen, then swap, so the old page stays until the new one is ready.
        const next = document.createElement("div");
        let drawn = false;
        try {
          await renderAsync(filled.docx, next, undefined, {
            inWrapper: true,
            renderHeaders: true,
            renderFooters: true,
            ignoreLastRenderedPageBreak: true,
            // CSP: blob: images and fonts are not allowed, data: images are. Embedded fonts are skipped.
            useBase64URL: true,
            ignoreFonts: true,
          });
          drawn = drewPages(next);
        } catch {
          drawn = false;
        }
        if (!current) return;
        if (drawn) {
          applyMarkers(next);
          disarmLinks(next);
          pagesRef.current?.replaceChildren(...next.childNodes);
          setView({ kind: "pages" });
        } else {
          setView({ kind: "text", text: filled.text });
        }
      } catch {
        if (current) setView({ kind: "failed" });
      }
    })();
    return () => {
      current = false;
    };
  }, [template, key]);

  // The plain text fallback is built with DOM nodes (no HTML string), so a value cannot inject markup.
  useEffect(() => {
    if (view.kind === "text") textRef.current?.replaceChildren(markedText(view.text));
  }, [view]);

  return (
    <section aria-label={strings.label} className={`ss-preview ${className ?? ""}`}>
      {view.kind === "loading" && <p className="p-4 text-muted">{strings.loading}</p>}
      {view.kind === "failed" && <Status kind="danger">{strings.failed}</Status>}
      {view.kind === "text" && (
        <>
          <Status kind="warning" className="mb-2">
            {strings.fallbackNotice}
          </Status>
          <pre
            ref={textRef}
            aria-label={strings.fallbackLabel}
            className="whitespace-pre-wrap rounded-control border border-line bg-white p-4 font-sans text-[#15181d]"
          />
        </>
      )}
      {/* Always mounted: React must not own the children docx-preview writes. */}
      <div
        ref={pagesRef}
        onClickCapture={(event) =>
          event.target instanceof Element && event.target.closest("a") && event.preventDefault()
        }
        hidden={view.kind !== "pages"}
      />
    </section>
  );
}
