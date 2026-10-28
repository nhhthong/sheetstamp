import type { Channel, EventChannel, RequestOf, ResponseOf } from "../../shared/ipc";

/** Call a main-process command. The argument is validated again in main. */
export function call<C extends Channel<unknown, unknown>>(
  target: C,
  ...request: RequestOf<C> extends undefined ? [] : [RequestOf<C>]
): Promise<ResponseOf<C>> {
  return window.sheetstamp.invoke(target.name, request[0]) as Promise<ResponseOf<C>>;
}

/** Subscribe to a main-to-renderer event; returns the unsubscribe function. */
export function listen<P>(target: EventChannel<P>, listener: (payload: P) => void): () => void {
  return window.sheetstamp.on(target.name, (payload) => listener(payload as P));
}
