/**
 * Pass at most one call per `interval` ms. The first call always passes; the ones in between are dropped (the final
 * state reaches the renderer with the export result). For 4,000 rows this turns 4,000 progress events into about
 * ten a second.
 */
export function throttle<T>(
  send: (value: T) => void,
  interval = 100,
  now: () => number = Date.now,
): (value: T) => void {
  let last = Number.NEGATIVE_INFINITY;
  return (value: T) => {
    if (now() - last < interval) return;
    last = now();
    send(value);
  };
}
