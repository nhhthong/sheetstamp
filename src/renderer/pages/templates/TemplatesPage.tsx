import { Page } from "../../components/page-header";
import { vi } from "../../strings/vi";

// The template library is built by tickets T-17 and T-18 in this folder.
export function TemplatesPage() {
  return <Page title={vi.pages.templates.title} subtitle={vi.pages.templates.subtitle} />;
}
