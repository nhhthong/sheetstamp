import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { WordPreview } from "./WordPreview";

type Show = (docx: Uint8Array, values: Record<string, string>, unmapped: string[]) => void;

declare global {
  interface Window {
    /** Test hook: show a template with a row of values. */
    previewDemo?: { show: Show };
  }
}

function Demo() {
  const [state, setState] = useState<{
    docx: Uint8Array;
    values: Record<string, string>;
    unmapped: string[];
  } | null>(null);
  window.previewDemo = { show: (docx, values, unmapped) => setState({ docx, values, unmapped }) };
  return state ? (
    <WordPreview template={state.docx} values={state.values} unmapped={state.unmapped} />
  ) : null;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<Demo />);
