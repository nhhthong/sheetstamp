import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { vi } from "../../strings/vi";
import { Button } from "./button";

/** Modal dialog (about 520 px wide) built on Base UI: focus is trapped and Escape closes it. */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/40" />
        <BaseDialog.Popup className="fixed top-1/2 left-1/2 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-dialog border border-line bg-bg p-6 shadow-lg">
          <BaseDialog.Title className="mb-4 text-xl font-semibold">{title}</BaseDialog.Title>
          <div className="flex flex-col gap-4">{children}</div>
          <div className="mt-6 flex justify-start gap-3">
            {footer}
            <BaseDialog.Close render={<Button variant="secondary">{vi.common.cancel}</Button>} />
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
