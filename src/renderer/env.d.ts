import type { SheetstampApi } from "../shared/ipc";

declare global {
  interface Window {
    sheetstamp: SheetstampApi;
  }
}
