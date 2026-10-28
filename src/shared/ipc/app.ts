import { channel, nothing, record, string } from "./define";

export type PingRequest = { message: string };
export type PingResponse = { message: string; version: string };

export const ping = channel<PingRequest, PingResponse>("app:ping", (value) => {
  const raw = record(value, "ping request");
  return { message: string(raw.message, "message", { max: 200 }) };
});

export const appInfo = channel<undefined, { name: string; version: string; electron: string }>(
  "app:info",
  nothing,
);

export const channels = [ping, appInfo] as const;
export const events = [] as const;
