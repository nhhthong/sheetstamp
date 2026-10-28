/**
 * Typed IPC contract. A feature declares its channels in `src/shared/ipc/<feature>.ts`
 * with a `parse` function that validates the argument; main runs `parse` on every call,
 * so nothing from the renderer is trusted. The renderer and main both import the same
 * channel object, so request and response types cannot drift apart.
 */
export type Channel<Req, Res> = {
  readonly name: string;
  readonly parse: (value: unknown) => Req;
  /** Phantom field that carries the response type. Never set at run time. */
  readonly response?: Res;
};

export function channel<Req, Res>(name: string, parse: (value: unknown) => Req): Channel<Req, Res> {
  return { name, parse };
}

/** A message pushed from main to the renderer, such as export progress. */
export type EventChannel<Payload> = { readonly name: string; readonly payload?: Payload };

export function eventChannel<Payload>(name: string): EventChannel<Payload> {
  return { name };
}

export type RequestOf<C> = C extends Channel<infer Req, unknown> ? Req : never;
export type ResponseOf<C> = C extends Channel<unknown, infer Res> ? Res : never;

/** Raised by `parse` functions; main turns it into a rejected promise in the renderer. */
export class IpcValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "IpcValidationError";
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function record(value: unknown, what = "request"): Record<string, unknown> {
  if (!isRecord(value)) throw new IpcValidationError(`${what} must be an object`);
  return value;
}

export function string(
  value: unknown,
  what: string,
  options: { max?: number; min?: number } = {},
): string {
  if (typeof value !== "string") throw new IpcValidationError(`${what} must be a string`);
  if (value.length > (options.max ?? 10_000)) throw new IpcValidationError(`${what} is too long`);
  if (value.length < (options.min ?? 0)) throw new IpcValidationError(`${what} is too short`);
  return value;
}

export function integer(
  value: unknown,
  what: string,
  options: { min?: number; max?: number } = {},
): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new IpcValidationError(`${what} must be an integer`);
  if (
    value < (options.min ?? Number.MIN_SAFE_INTEGER) ||
    value > (options.max ?? Number.MAX_SAFE_INTEGER)
  ) {
    throw new IpcValidationError(`${what} is out of range`);
  }
  return value;
}

export function oneOf<T extends string>(value: unknown, what: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new IpcValidationError(`${what} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

export function arrayOf<T>(
  value: unknown,
  what: string,
  item: (v: unknown, index: number) => T,
  max = 10_000,
): T[] {
  if (!Array.isArray(value)) throw new IpcValidationError(`${what} must be an array`);
  if (value.length > max) throw new IpcValidationError(`${what} has too many items`);
  return value.map(item);
}

export function bytes(value: unknown, what: string, maxBytes: number): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new IpcValidationError(`${what} must be bytes`);
  if (value.byteLength > maxBytes) throw new IpcValidationError(`${what} is too large`);
  return value;
}

/** For channels that take no argument. */
export const nothing = (value: unknown): undefined => {
  if (value !== undefined && value !== null)
    throw new IpcValidationError("this command takes no argument");
  return undefined;
};
