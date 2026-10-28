import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { vi } from "../../strings/vi";

type ToastApi = { show: (message: string) => void };
const ToastContext = createContext<ToastApi>({ show: () => undefined });

export const TOAST_MS = 2500;

/**
 * Short confirmations at the bottom centre for about 2.5 s. The region is a polite live region, so screen
 * readers announce each message.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-label={vi.toast.region}
        className="pointer-events-none fixed right-0 bottom-6 left-0 flex justify-center"
      >
        {message ? (
          <p className="rounded-control bg-text px-4 py-2 text-bg shadow-lg">{message}</p>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
