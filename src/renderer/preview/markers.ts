import { MARK_CLOSE, MARK_MISSING, MARK_OPEN } from "../../shared/ipc/preview";
import { preview as strings } from "../strings/preview";

const MARKERS = /[]/;

/**
 * Turn the marker characters in the text nodes under `root` into highlights:
 * a value becomes `<mark class="ss-filled">`, an empty value `(trống)` and a tag without a value `(thiếu)`.
 * A value with a line break spreads over several runs, so the "inside a value" state carries from node to node.
 */
export function applyMarkers(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

  let inside = false;
  let missing = false;
  let key = "";
  let hasText = false;

  const mark = (className: string, text: string, title?: string) => {
    const el = document.createElement("mark");
    el.className = className;
    el.textContent = text;
    if (title) el.title = title;
    return el;
  };

  for (const node of nodes) {
    const text = node.nodeValue ?? "";
    if (!inside && !MARKERS.test(text)) continue;
    const out = document.createDocumentFragment();
    let chunk = "";
    const flush = () => {
      if (!chunk) return;
      if (inside && !missing) {
        out.append(mark("ss-filled", chunk));
        hasText = true;
      } else if (inside) key += chunk;
      else out.append(chunk);
      chunk = "";
    };
    for (const ch of text) {
      if (ch === MARK_OPEN) {
        flush();
        inside = true;
        missing = false;
        key = "";
        hasText = false;
      } else if (ch === MARK_MISSING && inside && !hasText && !key) {
        flush();
        missing = true;
      } else if (ch === MARK_CLOSE) {
        flush();
        if (missing) out.append(mark("ss-missing", strings.missing, strings.missingTitle(key)));
        else if (!hasText) out.append(mark("ss-empty", strings.empty));
        inside = false;
        missing = false;
      } else chunk += ch;
    }
    flush();
    node.replaceWith(out);
  }
}

/** The same highlighting for the plain text fallback: returns nodes to put in a `<pre>`. */
export function markedText(text: string): DocumentFragment {
  const holder = document.createElement("div");
  holder.append(text);
  applyMarkers(holder);
  const fragment = document.createDocumentFragment();
  fragment.append(...holder.childNodes);
  return fragment;
}
