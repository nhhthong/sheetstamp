import { useEffect, useMemo, useRef, useState } from "react";
import { render } from "../../../shared/ipc/images";
import type { ImageSource } from "../../../shared/ipc/mapping";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { homeMapping as t } from "../../strings/home-mapping";
import { createLatestRunner } from "./latest-runner";

type Source = Extract<ImageSource, { ok: true }>;
type Shown = { kind: "busy" } | { kind: "image"; url: string } | { kind: "error"; message: string };

const toDataUrl = (png: Uint8Array) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([png.slice()], { type: "image/png" }));
  });

async function draw(
  source: Source,
  values: Record<string, string>,
  labelOf: (key: string) => string,
): Promise<Shown> {
  const result = await call(render, {
    background: source.background,
    boxes: source.boxes,
    values,
  });
  if (result.ok) return { kind: "image", url: await toDataUrl(result.png) };
  if (result.code === "font-missing")
    return { kind: "error", message: t.fontMissing(result.field ?? "") };
  if (result.code === "text-too-long")
    return { kind: "error", message: t.textTooLong(labelOf(result.field ?? "")) };
  return { kind: "error", message: t.badBackground };
}

export type ImagePreviewProps = {
  source: Source;
  /** Values of the current row by field key; a field in `unmapped` has no value and draws nothing. */
  values: Record<string, string>;
  unmapped: readonly string[];
  labelOf: (key: string) => string;
};

/**
 * The real image for the current row, drawn by `image:render`. One render runs at a time; changes that arrive
 * meanwhile collapse into the newest one. An empty value and an unmapped field draw nothing (the engine skips a
 * missing key); the unmapped ones are listed under the image so the gap is not a surprise.
 */
export function ImagePreview({ source, values, unmapped, labelOf }: ImagePreviewProps) {
  const [shown, setShown] = useState<Shown>({ kind: "busy" });
  const runner = useRef<ReturnType<typeof createLatestRunner<Record<string, string>, Shown>>>(null);
  const latest = useRef(values);
  latest.current = values;
  const labelRef = useRef(labelOf);
  labelRef.current = labelOf;

  useEffect(() => {
    const r = createLatestRunner(
      (v: Record<string, string>) => draw(source, v, (key) => labelRef.current(key)),
      (result) => setShown(result.ok ? result.value : { kind: "error", message: t.renderFailed }),
    );
    runner.current = r;
    r.run(latest.current);
    // A font installed meanwhile: the main process rescans on focus, so draw again.
    const onFocus = () => r.run(latest.current);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      r.stop();
      runner.current = null;
    };
  }, [source]);

  const signature = useMemo(() => JSON.stringify(values), [values]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    runner.current?.run(latest.current);
  }, [signature]);

  return (
    <div className="flex flex-col gap-2 p-2">
      {shown.kind === "error" ? <Status kind="danger">{shown.message}</Status> : null}
      {shown.kind === "image" ? (
        <img
          src={shown.url}
          alt={t.imageAlt}
          data-testid="mapping-image"
          className="max-w-full self-start"
        />
      ) : null}
      {shown.kind === "busy" ? <p className="text-muted">{t.drawing}</p> : null}
      {unmapped.length > 0 ? (
        <p data-testid="image-unmapped" className="text-sm text-muted">
          {t.imageUnmapped(unmapped.map(labelOf))}
        </p>
      ) : null}
    </div>
  );
}
