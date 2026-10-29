import * as app from "./app";
import * as data from "./data";
import * as exportFlow from "./export";
import * as mapping from "./mapping";
import * as preview from "./preview";
import * as settings from "./settings";
import * as storage from "./storage";
import * as templates from "./templates";

// One line per feature module, kept in step with src/shared/ipc/registry.ts.
export function registerIpc(): void {
  for (const feature of [app, data, exportFlow, mapping, preview, settings, storage, templates])
    feature.register();
}
