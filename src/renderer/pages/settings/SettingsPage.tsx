import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { get, setTheme, THEMES, type Theme } from "../../../shared/ipc/settings";
import { Page } from "../../components/page-header";
import { Status } from "../../components/ui/status";
import { cn } from "../../lib/cn";
import { call } from "../../lib/ipc";
import { applyTheme } from "../../lib/theme";
import { settingsStrings } from "../../strings/settings";
import { vi } from "../../strings/vi";

// About (version, licence, notices) is a separate ticket.
export function SettingsPage() {
  const [theme, setCurrent] = useState<Theme | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void call(get).then(({ theme: saved }) => live && setCurrent(saved));
    return () => {
      live = false;
    };
  }, []);

  async function choose(next: Theme) {
    setFailed(false);
    try {
      const saved = await call(setTheme, { theme: next });
      setCurrent(saved.theme);
      applyTheme(saved.theme);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Page title={vi.pages.settings.title} subtitle={vi.pages.settings.subtitle}>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-lg font-bold">{settingsStrings.appearance.legend}</legend>
        <div className="inline-flex self-start overflow-hidden rounded-control border border-line">
          {THEMES.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-4 py-2 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent",
                theme === option ? "bg-accent text-on-accent" : "text-text hover:bg-panel",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={theme === option}
                onChange={() => void choose(option)}
                className="sr-only"
              />
              {theme === option ? <Check aria-hidden="true" className="size-4" /> : null}
              {settingsStrings.appearance[option]}
            </label>
          ))}
        </div>
        {failed ? <Status kind="danger">{settingsStrings.saveFailed}</Status> : null}
      </fieldset>
    </Page>
  );
}
