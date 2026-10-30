import { createContext, useContext, useEffect, useState } from "react";
import logo from "../assets/icon.png?inline";
import { ToastProvider } from "../components/ui/toast";
import { cn } from "../lib/cn";
import { STAY_ON_SETTINGS } from "../lib/stay-on-settings";
import { vi } from "../strings/vi";
import { PAGES, type PageId } from "./pages";

type Navigation = { go: (page: PageId) => void; current: PageId };
const NavigationContext = createContext<Navigation>({ go: () => undefined, current: "home" });
export const useNavigation = () => useContext(NavigationContext);

function firstPage(): PageId {
  try {
    if (sessionStorage.getItem(STAY_ON_SETTINGS) === "1") return "settings";
  } catch {
    // Storage not available: start on the first page.
  }
  return "home";
}

/**
 * The shell: a left sidebar of about 224 px with the three destinations. Below about 820 px it becomes a
 * top bar. The sidebar holds nothing else.
 */
export function App() {
  const [current, setCurrent] = useState<PageId>(firstPage);
  useEffect(() => {
    try {
      sessionStorage.removeItem(STAY_ON_SETTINGS);
    } catch {
      // Nothing to clear.
    }
  }, []);
  const active = PAGES.find((p) => p.id === current) ?? PAGES[0];
  const Active = active?.Page;

  return (
    <ToastProvider>
      <NavigationContext.Provider value={{ go: setCurrent, current }}>
        <div className="flex h-full max-[819px]:flex-col">
          <nav
            aria-label={vi.nav.label}
            className="flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-panel p-4 max-[819px]:w-full max-[819px]:flex-row max-[819px]:items-center max-[819px]:gap-2 max-[819px]:border-r-0 max-[819px]:border-b"
          >
            <p className="mb-4 flex items-center gap-2 px-3 text-lg font-bold max-[819px]:mb-0">
              <img src={logo} alt="" className="size-7" />
              {vi.app.name}
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 max-[819px]:flex-row">
              {PAGES.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={id === current ? "page" : undefined}
                    onClick={() => setCurrent(id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left font-semibold",
                      id === current
                        ? "bg-raised text-accent shadow-card"
                        : "text-text hover:bg-raised/60",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <main className="relative min-w-0 flex-1 overflow-y-auto">
            {Active ? <Active /> : null}
          </main>
        </div>
      </NavigationContext.Provider>
    </ToastProvider>
  );
}
