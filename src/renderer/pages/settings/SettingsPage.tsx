import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { getLang, LANGS, type Lang } from "../../../shared/i18n";
import { type About, about, DOWNLOAD_PAGE_URL, openDownloadPage } from "../../../shared/ipc/app";
import { get, setLanguage, setTheme, THEMES, type Theme } from "../../../shared/ipc/settings";
import { Page } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Status } from "../../components/ui/status";
import { cn } from "../../lib/cn";
import { formatIsoDay } from "../../lib/date";
import { call } from "../../lib/ipc";
import { STAY_ON_SETTINGS } from "../../lib/stay-on-settings";
import { applyTheme } from "../../lib/theme";
import { settingsStrings } from "../../strings/settings";
import { vi } from "../../strings/vi";

function AboutSection() {
  const [info, setInfo] = useState<About | null>(null);
  const [failed, setFailed] = useState<"load" | "open" | null>(null);

  useEffect(() => {
    let live = true;
    call(about).then(
      (loaded) => live && setInfo(loaded),
      () => live && setFailed("load"),
    );
    return () => {
      live = false;
    };
  }, []);

  async function checkUpdate() {
    setFailed(null);
    try {
      await call(openDownloadPage);
    } catch {
      setFailed("open");
    }
  }

  return (
    <section
      aria-labelledby="about-title"
      className="mt-8 flex flex-col gap-4 border-t border-line pt-8"
    >
      <h2 id="about-title" className="text-lg font-bold">
        {settingsStrings.about.legend}
      </h2>
      {info ? (
        <>
          <p className="m-0 font-semibold">{settingsStrings.about.version(info.version)}</p>
          <p className="m-0">{settingsStrings.about.localLine}</p>
          {info.electronEndOfSupport ? (
            <p className="m-0">
              {settingsStrings.about.electronEnd(formatIsoDay(info.electronEndOfSupport))}
            </p>
          ) : null}
          <p className="m-0">
            {settingsStrings.about.downloadPage}: {DOWNLOAD_PAGE_URL}
          </p>
          <div>
            <Button variant="secondary" onClick={() => void checkUpdate()}>
              {settingsStrings.about.checkUpdate}
            </Button>
          </div>
        </>
      ) : null}
      {failed ? (
        <Status kind="danger">
          {failed === "load" ? settingsStrings.about.loadFailed : settingsStrings.about.openFailed}
        </Status>
      ) : null}
    </section>
  );
}

export function SettingsPage() {
  const [theme, setCurrent] = useState<Theme | null>(null);
  const [failed, setFailed] = useState(false);
  const [langFailed, setLangFailed] = useState(false);
  const language = getLang();

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

  /** Saved in main, then the page reloads: every string is picked once per page load. */
  async function chooseLanguage(next: Lang) {
    if (next === language) return;
    setLangFailed(false);
    try {
      await call(setLanguage, { language: next });
      try {
        sessionStorage.setItem(STAY_ON_SETTINGS, "1");
      } catch {
        // The page then reloads onto the first page.
      }
      window.location.reload();
    } catch {
      setLangFailed(true);
    }
  }

  return (
    <Page title={vi.pages.settings.title} subtitle={vi.pages.settings.subtitle}>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-lg font-bold">{settingsStrings.appearance.legend}</legend>
        <div className="inline-flex gap-0.5 self-start rounded-control glass p-0.5">
          {THEMES.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[8px] px-4 py-1.5 font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                theme === option ? "bg-raised text-text shadow-card" : "text-muted hover:text-text",
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
      <fieldset className="m-0 mt-8 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-lg font-bold">{settingsStrings.language.legend}</legend>
        <div className="inline-flex gap-0.5 self-start rounded-control glass p-0.5">
          {LANGS.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[8px] px-4 py-1.5 font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                language === option
                  ? "bg-raised text-text shadow-card"
                  : "text-muted hover:text-text",
              )}
            >
              <input
                type="radio"
                name="language"
                value={option}
                checked={language === option}
                onChange={() => void chooseLanguage(option)}
                className="sr-only"
              />
              {language === option ? <Check aria-hidden="true" className="size-4" /> : null}
              {settingsStrings.language[option]}
            </label>
          ))}
        </div>
        {langFailed ? <Status kind="danger">{settingsStrings.language.saveFailed}</Status> : null}
      </fieldset>
      <AboutSection />
    </Page>
  );
}
