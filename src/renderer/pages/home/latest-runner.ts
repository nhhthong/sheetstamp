/**
 * Runs `task` for the newest input only, never two at once: while one is running, later inputs replace each
 * other and the last one starts when the running one ends. `onDone` gets the result of the newest input only.
 */
export function createLatestRunner<In, Out>(
  task: (input: In) => Promise<Out>,
  onDone: (result: { ok: true; value: Out } | { ok: false }) => void,
) {
  let running = false;
  let waiting: { input: In } | null = null;
  let stopped = false;

  async function start(input: In) {
    running = true;
    let result: { ok: true; value: Out } | { ok: false };
    try {
      result = { ok: true, value: await task(input) };
    } catch {
      result = { ok: false };
    }
    running = false;
    const next = waiting;
    waiting = null;
    if (stopped) return;
    if (next) return start(next.input);
    onDone(result);
  }

  return {
    run(input: In) {
      if (stopped) return;
      if (running) waiting = { input };
      else void start(input);
    },
    stop() {
      stopped = true;
      waiting = null;
    },
  };
}
