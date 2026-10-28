// Spike T-2 driver (removed once the decision is recorded).
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { app, utilityProcess } from "electron";

type Outcome = { mode: string; ok: boolean; error?: string; result?: unknown };

const within = <T>(promise: Promise<T>, ms: number, label: string) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);

function fontDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "test-fonts")
    : join(app.getAppPath(), "tests/fixtures/fonts");
}

async function viaWorker(file: string): Promise<Outcome> {
  const worker = new Worker(file, { workerData: { fontDir: fontDir() } });
  try {
    const message = await within(
      new Promise<{ ok: boolean; result?: unknown; error?: string }>((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      }),
      20_000,
      "worker",
    );
    return { mode: "worker_thread", ...message };
  } catch (error) {
    return { mode: "worker_thread", ok: false, error: String(error) };
  } finally {
    await worker.terminate();
  }
}

async function viaUtility(file: string, mode = "utilityProcess"): Promise<Outcome> {
  const child = utilityProcess.fork(
    file,
    mode === "utilityProcess" ? [fontDir()] : [fontDir(), "system"],
  );
  try {
    const message = await within(
      new Promise<{ ok: boolean; result?: unknown; error?: string }>((resolve, reject) => {
        child.once("message", resolve);
        child.once("exit", (code) => reject(new Error(`exited with ${code}`)));
      }),
      20_000,
      "utilityProcess",
    );
    return { mode, ...message };
  } catch (error) {
    return { mode, ok: false, error: String(error) };
  } finally {
    child.kill();
  }
}

export async function runProbe(outFile: string): Promise<void> {
  const file = join(import.meta.dirname, "canvas-probe.js");
  console.error("probe: worker");
  const first = await viaWorker(file);
  console.error("probe: utility", JSON.stringify(first).slice(0, 200));
  const outcomes = [first, await viaUtility(file), await viaUtility(file, "systemFontsAtRuntime")];
  await writeFile(
    outFile,
    JSON.stringify(
      { platform: process.platform, packaged: app.isPackaged, file, outcomes },
      null,
      2,
    ),
  );
}
