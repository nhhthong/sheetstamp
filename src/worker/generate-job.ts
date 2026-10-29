import { EasyTemplateXEngine } from "../main/template-engine/easy-template-x-engine";
import { type ImageInit, rescanFonts } from "./image-job";
import { JobError } from "./pool";
import { renderImage } from "./render/render";
import { type ImageTemplate, type OutputFormat, RenderError } from "./render/types";

/** What each worker is started with: the template, sent once per batch. */
export type GenerateInit =
  | { kind: "word"; template: Uint8Array }
  | { kind: "image"; template: ImageTemplate; format: OutputFormat; fonts?: ImageInit };

/** One row's values, keyed by tag key. */
export type GenerateJob = { values: Record<string, string> };

/** Build the function a worker runs for each row. Failures become `JobError` with a code only. */
export function createGenerator(init: GenerateInit): (job: GenerateJob) => Promise<Uint8Array> {
  if (init.kind === "word") {
    const engine = new EasyTemplateXEngine();
    return async ({ values }) => {
      try {
        const { data, missing } = await engine.render(init.template, values);
        if (missing.length > 0) throw new JobError("missing-tag");
        return data;
      } catch (error) {
        throw error instanceof JobError ? error : new JobError("render-failed");
      }
    };
  }
  // Fonts installed since the process started are not known to a new worker until the folders are scanned again.
  if (init.fonts) rescanFonts(init.fonts);
  return async ({ values }) => {
    try {
      return (await renderImage(init.template, values, init.format)).data;
    } catch (error) {
      if (error instanceof RenderError) throw new JobError(error.code);
      throw new JobError("render-failed");
    }
  };
}
