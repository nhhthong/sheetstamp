// Fonts and image render for the window. The canvas library lives only in the worker thread, so a
// crash or a slow render never blocks main. One worker, started on first use; export uses its own pool.
import { join } from "node:path";
import type { FontFamilyInfo, RenderRequest, RenderResponse } from "../../shared/ipc/images";
import type { ImageInit, ImageJob, ImageReply } from "../../worker/image-job";
import { WorkerPool } from "../../worker/pool";

export const imageWorkerFileIn = (directory: string) => join(directory, "image-worker.js");

type Pool = Pick<WorkerPool<ImageJob, ImageReply>, "run" | "terminate">;

export class ImageService {
  #pool: Pool | undefined;

  constructor(private readonly start: () => Pool) {}

  #run(job: ImageJob): Promise<ImageReply> {
    this.#pool ??= this.start();
    return this.#pool.run(job);
  }

  /** Rescan the font folders, then list the families with the styles they really have. */
  async listFonts(): Promise<FontFamilyInfo[]> {
    const reply = await this.#run({ kind: "fonts" });
    if (reply.kind !== "fonts") throw new Error("unexpected reply");
    return reply.families;
  }

  /** The window regained focus: pick up fonts installed meanwhile. Does nothing before the first use. */
  rescanIfStarted(): void {
    if (this.#pool) void this.#run({ kind: "fonts" }).catch(() => {});
  }

  /** The PNG the export would draw for this row. A row-level failure is a result with a code. */
  async render({ background, boxes, values }: RenderRequest): Promise<RenderResponse> {
    // A worker that dies rejects: that is not a row-level failure and is not hidden as one.
    const reply = await this.#run({ kind: "render", template: { background, boxes }, values });
    if (reply.kind !== "render") throw new Error("unexpected reply");
    return reply.ok
      ? { ok: true, png: reply.png }
      : {
          ok: false,
          code: reply.code,
          ...(reply.field === undefined ? {} : { field: reply.field }),
        };
  }

  async close(): Promise<void> {
    const pool = this.#pool;
    this.#pool = undefined;
    await pool?.terminate();
  }
}

export function createImageService(workerFile: string, init: ImageInit): ImageService {
  return new ImageService(() => new WorkerPool<ImageJob, ImageReply>(workerFile, 1, init));
}
