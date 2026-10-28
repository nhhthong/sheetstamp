import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { home } from "../../strings/home";
import type { StepStatus } from "./flow";

export type StepperItem = {
  id: string;
  title: string;
  status: StepStatus;
  /** One line shown when the step is done. */
  summary?: string;
  /** The "Đổi" link of a done step. */
  onChange?: () => void;
  /** Shown only while the step is active. */
  children?: ReactNode;
};

const STATE_TEXT: Record<StepStatus, string> = {
  active: home.stepper.stateActive,
  done: home.stepper.stateDone,
  locked: home.stepper.stateLocked,
};

/** Round marker: the step number, or a green check once done. State is also written as text next to it. */
function Marker({ number, status }: { number: number; status: StepStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-semibold",
        status === "active" && "border-accent bg-accent text-on-accent",
        status === "done" && "border-success text-success",
        status === "locked" && "border-line text-muted",
      )}
    >
      {status === "done" ? <Check className="size-5" /> : number}
    </span>
  );
}

/**
 * A vertical list of steps separated by thin lines. Active: expanded. Done: one summary line and a
 * "Đổi" link. Locked: greyed title only, not focusable. Put the primary button of a step in `StepFooter`.
 */
export function Stepper({ items }: { items: readonly StepperItem[] }) {
  return (
    <ol aria-label={home.stepper.label} className="m-0 list-none border-b border-line p-0">
      {items.map((item, index) => {
        const number = index + 1;
        const { status } = item;
        return (
          <li
            key={item.id}
            data-step={item.id}
            data-status={status}
            aria-current={status === "active" ? "step" : undefined}
            className="border-t border-line py-5"
          >
            <div className="flex items-center gap-4">
              <Marker number={number} status={status} />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className={cn("text-xl font-semibold", status === "locked" && "text-muted")}>
                  <span className="sr-only">{home.stepper.stepPrefix(number)}</span>
                  {item.title}
                </h2>
                <span
                  className={cn("text-sm text-muted", status === "active" && "sr-only")}
                  data-testid={`state-${item.id}`}
                >
                  {STATE_TEXT[status]}
                </span>
                {status === "done" && item.summary ? (
                  <span className="min-w-0 break-words text-text">{item.summary}</span>
                ) : null}
              </div>
              {status === "done" && item.onChange ? (
                <button
                  type="button"
                  onClick={item.onChange}
                  aria-label={`${home.stepper.change}: ${item.title}`}
                  className="shrink-0 rounded-control px-2 py-1 font-semibold text-accent underline hover:bg-panel"
                >
                  {home.stepper.change}
                </button>
              ) : null}
            </div>
            {status === "active" && item.children ? (
              <div className="mt-4 pl-12 max-[819px]:pl-0">{item.children}</div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Bottom of a step's content: the one primary button, always on the left. */
export function StepFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-start gap-3">{children}</div>;
}
