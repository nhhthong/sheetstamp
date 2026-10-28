/** IPC contract shared by main, preload and renderer. Every argument is validated in main. */
export const IPC = {
  ping: "app:ping",
} as const;

export type PingRequest = { message: string };
export type PingResponse = { message: string; version: string };

export const MAX_PING_LENGTH = 200;

export function parsePingRequest(value: unknown): PingRequest {
  if (typeof value !== "object" || value === null) throw new TypeError("Invalid ping request");
  const { message } = value as { message?: unknown };
  if (typeof message !== "string" || message.length > MAX_PING_LENGTH) {
    throw new TypeError("Invalid ping message");
  }
  return { message };
}

export interface SheetstampApi {
  ping(request: PingRequest): Promise<PingResponse>;
}
