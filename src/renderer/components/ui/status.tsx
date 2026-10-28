import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

const KINDS = {
  success: { icon: CheckCircle2, text: "text-success" },
  warning: { icon: AlertTriangle, text: "text-warning" },
  danger: { icon: CircleAlert, text: "text-danger" },
  info: { icon: Info, text: "text-muted" },
} as const;

/**
 * A status is never shown by colour alone: it always has an icon and text.
 * `alert` announces at once even for info (a notice that appears after an action); `focusOnMount` moves focus to the
 * notice when it appears, for the case where the control the user had focused has just gone away.
 */
export function Status({
  kind,
  children,
  className,
  alert = false,
  focusOnMount = false,
}: {
  kind: keyof typeof KINDS;
  children: ReactNode;
  className?: string;
  alert?: boolean;
  focusOnMount?: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  const { icon: Icon, text } = KINDS[kind];
  // Problems are announced at once; success and info wait their turn.
  const role = alert || kind === "danger" || kind === "warning" ? "alert" : "status";
  return (
    <p
      ref={ref}
      role={role}
      tabIndex={focusOnMount ? -1 : undefined}
      className={cn("flex items-start gap-2", text, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
