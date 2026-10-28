import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JobError, WorkerPool } from "./pool";

const ECHO = join(import.meta.dirname, "../../tests/fixtures/workers/echo-worker.mjs");
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("WorkerPool", () => {
  it("runs jobs and passes the init data to every worker", async () => {
    const pool = new WorkerPool<{ values: { ten: string } }, Uint8Array>(ECHO, 2, { prefix: "X-" });
    const out = await Promise.all(["a", "b", "c", "d"].map((ten) => pool.run({ values: { ten } })));
    expect(out.map((o) => text(o).split("|")[0])).toEqual(["X-a", "X-b", "X-c", "X-d"]);
    await pool.terminate();
  });

  it("spreads work over the workers", async () => {
    const pool = new WorkerPool<{ values: { ten: string }; delay: number }, Uint8Array>(ECHO, 3);
    const out = await Promise.all(
      Array.from({ length: 9 }, () => pool.run({ values: { ten: "x" }, delay: 30 })),
    );
    const threads = new Set(out.map((o) => text(o).split("|")[1]));
    expect(threads.size).toBe(3);
    await pool.terminate();
  });

  it("rejects a failed job with its code and keeps working", async () => {
    const pool = new WorkerPool<Record<string, unknown>, Uint8Array>(ECHO, 1);
    await expect(pool.run({ values: {}, fail: "missing-tag" })).rejects.toMatchObject({
      code: "missing-tag",
    });
    expect(text(await pool.run({ values: { ten: "ok" } })).startsWith("ok")).toBe(true);
    await pool.terminate();
  });

  it("replaces a worker that dies and fails only its job", async () => {
    const pool = new WorkerPool<Record<string, unknown>, Uint8Array>(ECHO, 1);
    await expect(pool.run({ values: {}, crash: true })).rejects.toBeInstanceOf(JobError);
    expect(text(await pool.run({ values: { ten: "again" } })).startsWith("again")).toBe(true);
    await pool.terminate();
  });

  it("rejects pending and later jobs after terminate", async () => {
    const pool = new WorkerPool<Record<string, unknown>, Uint8Array>(ECHO, 1);
    const slow = pool.run({ values: {}, delay: 500 });
    const queued = pool.run({ values: {} });
    const settled = Promise.allSettled([slow, queued]);
    await pool.terminate();
    expect((await settled).map((r) => r.status)).toEqual(["rejected", "rejected"]);
    await expect(pool.run({ values: {} })).rejects.toMatchObject({ code: "pool-closed" });
  });
});
