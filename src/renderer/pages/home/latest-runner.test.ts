import { describe, expect, it } from "vitest";
import { createLatestRunner } from "./latest-runner";

function deferred() {
  let resolve!: (v: string) => void;
  const promise = new Promise<string>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createLatestRunner", () => {
  it("never runs two at once and finishes with the newest input", async () => {
    const gates = new Map<number, ReturnType<typeof deferred>>();
    const started: number[] = [];
    let active = 0;
    let most = 0;
    const done: unknown[] = [];
    const runner = createLatestRunner(
      async (n: number) => {
        started.push(n);
        active++;
        most = Math.max(most, active);
        const gate = deferred();
        gates.set(n, gate);
        const value = await gate.promise;
        active--;
        return value;
      },
      (r) => done.push(r),
    );
    runner.run(1);
    runner.run(2);
    runner.run(3);
    expect(started).toEqual([1]);
    gates.get(1)?.resolve("one");
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toEqual([1, 3]);
    gates.get(3)?.resolve("three");
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toEqual([{ ok: true, value: "three" }]);
    expect(most).toBe(1);
  });

  it("reports a failure and keeps going", async () => {
    const done: unknown[] = [];
    const runner = createLatestRunner(
      async (n: number) => {
        if (n === 1) throw new Error("x");
        return n;
      },
      (r) => done.push(r),
    );
    runner.run(1);
    await new Promise((r) => setTimeout(r, 0));
    runner.run(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toEqual([{ ok: false }, { ok: true, value: 2 }]);
  });

  it("says nothing after stop", async () => {
    const done: unknown[] = [];
    const runner = createLatestRunner(
      async (n: number) => n,
      (r) => done.push(r),
    );
    runner.run(1);
    runner.stop();
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toEqual([]);
  });
});
