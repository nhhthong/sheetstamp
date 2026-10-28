import { beforeEach, describe, expect, it } from "vitest";
import { exportRun, viewVersion } from "./export-run";

const view = (pattern: string, keys: string[]) => ({
  pattern,
  fields: keys.map((key) => ({ key, label: key })),
});
const draftFor = (version: string) => ({
  templateId: "t1",
  version,
  chips: [],
  removeDiacritics: true,
});

describe("export draft", () => {
  beforeEach(() => exportRun.setDraft(undefined));

  it("resumes (with the diacritics choice) while the template is as it was", () => {
    const version = viewVersion(view("{{ten}}", ["ten", "ma"]));
    exportRun.setDraft(draftFor(version));
    expect(exportRun.resume("t1", version)).toMatchObject({ removeDiacritics: true });
  });

  it("drops the draft when the saved pattern changed meanwhile", () => {
    exportRun.setDraft(draftFor(viewVersion(view("{{ten}}", ["ten"]))));
    expect(exportRun.resume("t1", viewVersion(view("{{ma}}_{{ten}}", ["ten"])))).toBeUndefined();
    expect(exportRun.resume("t1", viewVersion(view("{{ten}}", ["ten"])))).toBeUndefined(); // gone for good
  });

  it("drops the draft when the field list changed", () => {
    exportRun.setDraft(draftFor(viewVersion(view("{{ten}}", ["ten"]))));
    expect(exportRun.resume("t1", viewVersion(view("{{ten}}", ["ten", "ma"])))).toBeUndefined();
  });

  it("drops the draft of another template", () => {
    const version = viewVersion(view("{{ten}}", ["ten"]));
    exportRun.setDraft(draftFor(version));
    expect(exportRun.resume("t2", version)).toBeUndefined();
  });
});
