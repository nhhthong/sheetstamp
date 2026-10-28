/**
 * Pass at most one call per `interval` ms. The first call always passes; `flush` passes the latest value that was
 * held back, so the last state is never lost. For 4,000 rows this turns 4,000 progress events into about ten a second.
 */
export function throttle<T>(
  send: (value: T) => void,
  interval = 100,
  now: () => number = Date.now,
): { (value: T): void; flush: () => void } {
  let last = Number.NEGATIVE_INFINITY;
  let held: { value: T } | undefined;
  const push = (value: T) => {
    last = now();
    held = undefined;
    send(value);
  };
  const throttled = (value: T) => {
    if (now() - last >= interval) push(value);
    else held = { value };
  };
  throttled.flush = () => {
    if (held) push(held.value);
  };
  return throttled;
}
