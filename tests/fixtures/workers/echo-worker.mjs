// Test double for generate-worker: same message protocol, no libraries.
import { parentPort, threadId, workerData } from "node:worker_threads";

parentPort.on("message", async ({ id, job }) => {
  if (job.delay) await new Promise((resolve) => setTimeout(resolve, job.delay));
  if (job.crash) process.exit(3);
  if (job.fail) return parentPort.postMessage({ id, ok: false, code: job.fail });
  const text = `${workerData?.prefix ?? ""}${job.values.ten ?? ""}|${threadId}`;
  const bytes = new TextEncoder().encode(text);
  parentPort.postMessage({ id, ok: true, result: bytes }, [bytes.buffer]);
});
