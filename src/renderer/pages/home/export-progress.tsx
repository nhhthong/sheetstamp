import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { homeExport as t } from "../../strings/home-export";
import { exportRun, type Run } from "./export-run";
import { StepFooter } from "./Stepper";

/**
 * While files are made: "Đang tạo file… 5/12", a bar, and "Hủy". The bar is not the only signal: the text above it
 * says the same, the bar has `aria-valuenow` and `aria-valuetext`, and a hidden live region announces every 10%
 * (not every row, which would flood a screen reader with thousands of messages).
 */
export function ExportProgress({ run }: { run: Extract<Run, { kind: "running" }> }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const { done, total, failed, canceling } = run;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const bucket = Math.floor(percent / 10) * 10;
  return (
    <div className="flex flex-col gap-4" data-testid="export-running">
      <h3
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold"
        data-testid="export-progress-text"
      >
        {t.running.title(done, total)}
      </h3>
      <div
        role="progressbar"
        aria-label={t.running.barLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={t.running.barText(done, total)}
        className="h-4 w-full max-w-xl overflow-hidden rounded-full border border-line bg-panel"
      >
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <span role="status" className="sr-only">
        {t.running.announce(bucket)}
      </span>
      {failed > 0 ? <Status kind="warning">{t.running.failedSoFar(failed)}</Status> : null}
      <p className="text-muted">{t.running.keepOpen}</p>
      <StepFooter>
        <Button
          variant="secondary"
          size="lg"
          disabled={canceling}
          onClick={() => void exportRun.cancel()}
        >
          {canceling ? t.running.canceling : t.running.cancel}
        </Button>
      </StepFooter>
    </div>
  );
}
