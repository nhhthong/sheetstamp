import { Page } from "../../components/page-header";
import { vi } from "../../strings/vi";
import { flow, stepStatus, useFlow } from "./flow";
import { Stepper } from "./Stepper";
import { STEPS } from "./steps";

/** The export flow: four steps, one expanded at a time. The flow state is in ./flow.ts. */
export function HomePage() {
  const state = useFlow();
  return (
    <Page title={vi.pages.home.title} subtitle={vi.pages.home.subtitle}>
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
    </Page>
  );
}
