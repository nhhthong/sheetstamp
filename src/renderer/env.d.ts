import type { SheetstampBridge } from "../shared/ipc";

declare global {
  interface Window {
    sheetstamp: SheetstampBridge;
  }
}
