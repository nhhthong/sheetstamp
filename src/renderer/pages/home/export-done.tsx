import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type ExportDone, reveal } from "../../../shared/ipc/export";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { call } from "../../lib/ipc";
import { homeExport as t } from "../../strings/home-export";
import { exportRun } from "./export-run";
import { StepFooter } from "./Stepper";

/**
 * The end of the flow: a large green check with the text "Đã tạo n file", where the ZIP is, "Mở thư mục" (the folder
 * opens with the ZIP selected), a warning with a link to the CSV report when rows failed, and "Tạo đợt mới".
 */
export function ExportFinished({ result, onBack }: { result: ExportDone; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => heading.current?.focus(), []);
  const none = result.written === 0;

  async function open(what: "zip" | "report") {
    setProblem("");
    const opened = await call(reveal, { what }).catch(() => ({ ok: false }));
    if (!opened.ok) setProblem(t.done.openFailed);
  }

  return (
    <div className="flex flex-col items-start gap-4" data-testid="export-done">
      <div className="flex items-center gap-4">
        {none ? (
          <CircleAlert aria-hidden="true" className="size-14 shrink-0 text-danger" />
        ) : (
          <CheckCircle2 aria-hidden="true" className="size-14 shrink-0 text-success" />
        )}
        <h3 ref={heading} tabIndex={-1} className="text-2xl font-semibold" data-testid="done-title">
          {none ? t.done.titleNone : t.done.title(result.written)}
        </h3>
      </div>

      {result.zipPath ? (
        <p className="m-0 flex flex-col gap-1">
          <span className="text-sm text-muted">{t.done.zipLabel}</span>
          <span data-testid="zip-path" className="break-all font-mono text-sm">
            {result.zipPath}
          </span>
        </p>
      ) : null}

      {result.failed > 0 ? (
        <div className="flex flex-col gap-1" data-testid="failed-rows">
          <Status kind="warning">{t.done.failedRows(result.failed)}</Status>
          <p className="m-0 pl-7 text-muted">{t.done.failedRowsHint}</p>
          {result.hasReport ? (
            <button
              type="button"
              onClick={() => void open("report")}
              className="self-start rounded-control px-2 py-1 font-semibold text-accent underline hover:bg-panel"
            >
              {t.done.report}
            </button>
          ) : null}
        </div>
      ) : null}

      {problem ? <Status kind="danger">{problem}</Status> : null}

      <StepFooter>
        {result.zipPath ? (
          <Button size="lg" onClick={() => void open("zip")}>
            {t.done.open}
          </Button>
        ) : (
          <Button size="lg" onClick={onBack}>
            {t.done.back}
          </Button>
        )}
        <button
          type="button"
          onClick={() => void exportRun.newBatch()}
          className="rounded-control px-2 py-1 font-semibold text-accent underline hover:bg-panel"
        >
          {t.done.newBatch}
        </button>
      </StepFooter>
    </div>
  );
}
