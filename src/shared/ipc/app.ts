import { channel, nothing } from "./define";

export const appInfo = channel<undefined, { name: string; version: string; electron: string }>(
  "app:info",
  nothing,
);

export const channels = [appInfo] as const;
export const events = [] as const;
