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
  hideCancel = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Drop the generic "Hủy" button when the footer already closes the dialog. */
  hideCancel?: boolean;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/30 backdrop-blur-[6px]" />
        <BaseDialog.Popup className="fixed top-1/2 left-1/2 max-h-[calc(100vh-32px)] w-[min(520px,calc(100vw-32px))] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-dialog glass-strong p-6">
          <BaseDialog.Title className="mb-4 text-xl font-semibold">{title}</BaseDialog.Title>
          <div className="flex flex-col gap-4">{children}</div>
          <div className="mt-6 flex justify-start gap-3">
            {footer}
            {hideCancel ? null : (
              <BaseDialog.Close render={<Button variant="secondary">{vi.common.cancel}</Button>} />
            )}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
