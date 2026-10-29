import { homedir } from "node:os";
import { type FontFamily, listFamilies, refreshFonts, systemFontFolders } from "./render/fonts";
import { renderImage } from "./render/render";
import {
  type ImageTemplate,
  type OutputFormat,
  RenderError,
  type RenderErrorCode,
} from "./render/types";

/** What the image worker is started with. */
export type ImageInit = {
  /** Folders rescanned for fonts, besides the system ones. */
  fontFolders: string[];
  /** Rescan the operating system's font folders too. False only in the e2e build. */
  systemFonts: boolean;
};

export type ImageJob =
  | { kind: "fonts" }
  | { kind: "render"; template: ImageTemplate; values: Record<string, string> }
  | {
      kind: "sample";
      template: ImageTemplate;
      rows: Record<string, string>[];
      format: OutputFormat;
    };

export type ImageReply =
  | { kind: "fonts"; families: FontFamily[] }
  | { kind: "render"; ok: true; png: Uint8Array }
  | { kind: "render"; ok: false; code: RenderErrorCode; field?: string }
  /** Bytes of each sample row that could be drawn; a row that fails is left out. */
  | { kind: "sample"; sizes: number[] };

/** Scan the system font folders (when asked) and the extra ones. Loading a folder twice does not duplicate faces. */
export function rescanFonts(init: ImageInit): number {
  return refreshFonts([
    ...(init.systemFonts ? systemFontFolders(process.env, process.platform, homedir()) : []),
    ...init.fontFolders,
  ]);
}

/**
 * Build the function the image worker runs for each job. Fonts are rescanned at start and on every `fonts` job,
 * so a font installed while the app runs shows up without a restart. A row-level render failure is a reply, not a throw.
 */
export function createImageJobs(init: ImageInit): (job: ImageJob) => Promise<ImageReply> {
  const rescan = () => rescanFonts(init);
  rescan();
  return async (job) => {
    if (job.kind === "fonts") {
      rescan();
      return { kind: "fonts", families: listFamilies() };
    }
    if (job.kind === "sample") {
      const sizes: number[] = [];
      for (const values of job.rows) {
        try {
          sizes.push((await renderImage(job.template, values, job.format)).data.length);
        } catch (error) {
          if (!(error instanceof RenderError)) throw error;
        }
      }
      return { kind: "sample", sizes };
    }
    try {
      const { data } = await renderImage(job.template, job.values);
      return { kind: "render", ok: true, png: data };
    } catch (error) {
      if (error instanceof RenderError)
        return { kind: "render", ok: false, code: error.code, field: error.field };
      throw error;
    }
  };
}
