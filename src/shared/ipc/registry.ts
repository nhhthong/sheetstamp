import * as app from "./app";
import * as data from "./data";
import type { Channel, EventChannel } from "./define";
import * as exportFlow from "./export";
import * as images from "./images";
import * as mapping from "./mapping";
import * as preview from "./preview";
import * as settings from "./settings";
import * as storage from "./storage";
import * as templates from "./templates";

// One line per feature module. A feature adds channels inside its own file, not here.
const modules = [app, data, exportFlow, images, mapping, preview, settings, storage, templates];

export const ALL_CHANNELS: ReadonlyArray<Channel<unknown, unknown>> = modules.flatMap((m) => [
  ...m.channels,
]);
export const ALL_EVENTS: ReadonlyArray<EventChannel<unknown>> = modules.flatMap((m) => [
  ...m.events,
]);

export const CHANNEL_NAMES: ReadonlySet<string> = new Set(ALL_CHANNELS.map((c) => c.name));
export const EVENT_NAMES: ReadonlySet<string> = new Set(ALL_EVENTS.map((e) => e.name));
