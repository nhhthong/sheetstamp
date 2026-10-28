import { Page } from "../../components/page-header";
import { vi } from "../../strings/vi";

// The full Settings screen (theme, About) is Phase 2.
export function SettingsPage() {
  return <Page title={vi.pages.settings.title} subtitle={vi.pages.settings.subtitle} />;
}
