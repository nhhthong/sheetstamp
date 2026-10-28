import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const KINDS = {
  success: { icon: CheckCircle2, text: "text-success" },
  warning: { icon: AlertTriangle, text: "text-warning" },
  danger: { icon: CircleAlert, text: "text-danger" },
  info: { icon: Info, text: "text-muted" },
} as const;

/** A status is never shown by colour alone: it always has an icon and text. */
export function Status({
  kind,
  children,
  className,
}: {
  kind: keyof typeof KINDS;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, text } = KINDS[kind];
  return (
    <p className={cn("flex items-start gap-2", text, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
