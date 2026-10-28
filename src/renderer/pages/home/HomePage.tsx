import { Page } from "../../components/page-header";
import { vi } from "../../strings/vi";

// The four-step export flow is built by tickets T-19 to T-23 in this folder.
export function HomePage() {
  return <Page title={vi.pages.home.title} subtitle={vi.pages.home.subtitle} />;
}
