import { useState } from "react";
import { Page } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { home } from "../../strings/home";
import { vi } from "../../strings/vi";
import { exportRun, useExportRun } from "./export-run";
import { flow, stepStatus, useFlow } from "./flow";
import { Stepper } from "./Stepper";
import { STEPS } from "./steps";

/** The export flow: four steps, one expanded at a time. The flow state is in ./flow.ts. */
export function HomePage() {
  const state = useFlow();
  const run = useExportRun();
  const [asking, setAsking] = useState(false);
  // Nothing to discard on a fresh page, and a running export has its own Cancel.
  const started = state.active !== "data" || state.done.data;
  return (
    <Page
      title={vi.pages.home.title}
      subtitle={vi.pages.home.subtitle}
      actions={
        started && run.kind !== "running" ? (
          <Button variant="secondary" size="sm" onClick={() => setAsking(true)}>
            {home.startOver.button}
          </Button>
        ) : null
      }
    >
      <Stepper
        items={STEPS.map(({ id, title, Component }) => ({
          id,
          title,
          status: stepStatus(state, id),
          summary: state.summaries[id],
          onChange: () => flow.reopen(id),
          children: <Component />,
        }))}
      />
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        title={home.startOver.title}
        footer={
          <Button
            variant="danger"
            onClick={() => {
              setAsking(false);
              void exportRun.newBatch();
            }}
          >
            {home.startOver.confirm}
          </Button>
        }
      >
        <p>{home.startOver.body}</p>
      </Dialog>
    </Page>
  );
}
