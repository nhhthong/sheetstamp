import type { ComponentType } from "react";
import { home } from "../../strings/home";
import type { StepId } from "./flow";
import { StepData } from "./StepData";
import { StepExport } from "./StepExport";
import { StepMapping } from "./StepMapping";
import { StepTemplate } from "./StepTemplate";

export type StepDefinition = {
  id: StepId;
  title: string;
  /** The body shown while the step is active. Each ticket owns the file of its step. */
  Component: ComponentType;
};

/** The four steps of the export flow, in order. */
export const STEPS: readonly StepDefinition[] = [
  { id: "data", title: home.steps.data, Component: StepData },
  { id: "template", title: home.steps.template, Component: StepTemplate },
  { id: "mapping", title: home.steps.mapping, Component: StepMapping },
  { id: "export", title: home.steps.export, Component: StepExport },
];
