import { FileOutput, FileText, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { HomePage } from "../pages/home/HomePage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { TemplatesPage } from "../pages/templates/TemplatesPage";
import { vi } from "../strings/vi";

export type PageId = "home" | "templates" | "settings";

export type PageEntry = {
  id: PageId;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  Page: ComponentType;
};

/** The three sidebar destinations, and nothing else. */
export const PAGES: readonly PageEntry[] = [
  { id: "home", label: vi.nav.home, icon: FileOutput, Page: HomePage },
  { id: "templates", label: vi.nav.templates, icon: FileText, Page: TemplatesPage },
  { id: "settings", label: vi.nav.settings, icon: Settings, Page: SettingsPage },
];
