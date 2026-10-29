import { afterEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../../shared/i18n";

afterEach(() => {
  setLang("vi");
  vi.resetModules();
});

/** The English tables pick their text when the module loads, so load them after switching language. */
async function english() {
  vi.resetModules();
  setLang("en");
  const [mapping, exporting, templates] = await Promise.all([
    import("./home-mapping"),
    import("./home-export"),
    import("./templates"),
  ]);
  return {
    mapping: mapping.homeMapping,
    exporting: exporting.homeExport,
    templates: templates.tpl,
  };
}

describe("English counts agree with their number", () => {
  it("mapping step", async () => {
    const { mapping } = await english();
    expect(mapping.needWork(1)).toBe("1 field needs a column from you.");
    expect(mapping.needWork(2)).toBe("2 fields need a column from you.");
    expect(mapping.allDone(1)).toBe("The field is matched.");
    expect(mapping.showMatched(1)).toBe("Show 1 matched field");
    expect(mapping.summary(3)).toBe("3 fields matched");
  });

  it("templates", async () => {
    const { templates } = await english();
    expect(templates.fieldsCount(1)).toBe("1 field");
    expect(templates.fieldsCount(5)).toBe("5 fields");
  });

  it("export step", async () => {
    const { exporting } = await english();
    expect(exporting.export(1)).toBe("Export 1 file");
    expect(exporting.export(4)).toBe("Export 4 files");
    expect(exporting.done.failedRows(1)).toBe("1 row failed");
  });
});
