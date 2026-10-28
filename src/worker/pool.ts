import { Worker } from "node:worker_threads";

/** A job that failed with a code the caller can report (never contains source data). */
export class JobError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "JobError";
  }
}

type Reply = { id: number; ok: true; result: unknown } | { id: number; ok: false; code: string };

type Pending = { resolve: (value: never) => void; reject: (error: unknown) => void };

type Slot = { worker: Worker; busy: Map<number, Pending> };

/**
 * Fixed-size pool of worker threads that all run the same script, started with the same `init` data.
 * One job per worker at a time. A worker that dies fails its job and is replaced.
 */
export class WorkerPool<Job, Result> {
  private readonly slots: Slot[] = [];
  private readonly queue: Array<{
    id: number;
    job: Job;
    transfer: ArrayBuffer[];
    pending: Pending;
  }> = [];
  private nextId = 1;
  private closed = false;

  constructor(
    private readonly file: string | URL,
    readonly size: number,
    private readonly init?: unknown,
  ) {
    for (let i = 0; i < Math.max(1, size); i++) this.slots.push(this.spawn());
  }

  private spawn(): Slot {
    const worker = new Worker(this.file, { workerData: this.init });
    const slot: Slot = { worker, busy: new Map() };
    worker.on("message", (reply: Reply) => {
      const pending = slot.busy.get(reply.id);
      slot.busy.delete(reply.id);
      if (!pending) return;
      if (reply.ok) pending.resolve(reply.result as never);
      else pending.reject(new JobError(reply.code));
      this.drain();
    });
    const died = (error: unknown) => {
      for (const pending of slot.busy.values()) pending.reject(error);
      slot.busy.clear();
      if (!this.closed) {
        const index = this.slots.indexOf(slot);
        if (index >= 0) this.slots[index] = this.spawn();
        this.drain();
      }
    };
    worker.on("error", died);
    worker.on("exit", (code) => died(new JobError(`worker-exit-${code}`)));
    return slot;
  }

  private drain(): void {
    for (const slot of this.slots) {
      if (this.queue.length === 0) return;
      if (slot.busy.size > 0) continue;
      const next = this.queue.shift();
      if (!next) return;
      slot.busy.set(next.id, next.pending);
      slot.worker.postMessage({ id: next.id, job: next.job }, next.transfer);
    }
  }

  run(job: Job, transfer: ArrayBuffer[] = []): Promise<Result> {
    if (this.closed) return Promise.reject(new JobError("pool-closed"));
    return new Promise<Result>((resolve, reject) => {
      this.queue.push({
        id: this.nextId++,
        job,
        transfer,
        pending: { resolve, reject } as Pending,
      });
      this.drain();
    });
  }

  /** Stop all workers now. Jobs not finished are rejected. */
  async terminate(): Promise<void> {
    this.closed = true;
    for (const next of this.queue.splice(0)) next.pending.reject(new JobError("pool-closed"));
    await Promise.all(
      this.slots.map(async (slot) => {
        for (const pending of slot.busy.values()) pending.reject(new JobError("pool-closed"));
        slot.busy.clear();
        await slot.worker.terminate();
      }),
    );
  }
}
