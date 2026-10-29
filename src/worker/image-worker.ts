import { parentPort, workerData } from "node:worker_threads";
import { createImageJobs, type ImageInit, type ImageJob } from "./image-job";

const port = parentPort;
if (!port) throw new Error("image-worker must run in a worker thread");

const run = createImageJobs(workerData as ImageInit);

port.on("message", async ({ id, job }: { id: number; job: ImageJob }) => {
  try {
    const result = await run(job);
    if (result.kind === "render" && result.ok) {
      // `renderImage` returns a fresh copy, so its buffer can be transferred.
      port.postMessage({ id, ok: true, result }, [result.png.buffer as ArrayBuffer]);
    } else {
      port.postMessage({ id, ok: true, result });
    }
  } catch {
    port.postMessage({ id, ok: false, code: "render-failed" });
  }
});
