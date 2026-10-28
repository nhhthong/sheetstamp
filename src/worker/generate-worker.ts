import { parentPort, workerData } from "node:worker_threads";
import { createGenerator, type GenerateInit, type GenerateJob } from "./generate-job";
import { JobError } from "./pool";

const port = parentPort;
if (!port) throw new Error("generate-worker must run in a worker thread");

const generate = createGenerator(workerData as GenerateInit);

port.on("message", async ({ id, job }: { id: number; job: GenerateJob }) => {
  try {
    const data = await generate(job);
    const copy = new Uint8Array(data); // a fresh buffer that can be transferred
    port.postMessage({ id, ok: true, result: copy }, [copy.buffer]);
  } catch (error) {
    port.postMessage({
      id,
      ok: false,
      code: error instanceof JobError ? error.code : "render-failed",
    });
  }
});
