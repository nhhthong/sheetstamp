import { beforeEach, describe, expect, it } from "vitest";
import { flow, stepStatus } from "./flow";

const status = (id: Parameters<typeof stepStatus>[1]) => stepStatus(flow.getState(), id);

describe("flow", () => {
  beforeEach(() => flow.reset());

  it("starts with step 1 active and the rest locked", () => {
    expect(["data", "template", "mapping", "export"].map((id) => status(id as "data"))).toEqual([
      "active",
      "locked",
      "locked",
      "locked",
    ]);
  });

  it("completes a step, moves to the next and keeps its summary", () => {
    flow.complete("data", { summary: "a.csv, 2 dòng, 3 cột", result: { rows: 2 } });
    expect(status("data")).toBe("done");
    expect(status("template")).toBe("active");
    expect(flow.getState().summaries.data).toBe("a.csv, 2 dòng, 3 cột");
    expect(flow.result("data")).toEqual({ rows: 2 });
    expect(flow.getState().revision.data).toBe(1);
  });

  it("does not open a locked step", () => {
    flow.reopen("mapping");
    expect(status("data")).toBe("active");
  });

  it("reopens a done step and keeps later choices; finishing returns to the first step still to do", () => {
    flow.complete("data", { summary: "d" });
    flow.complete("template", { summary: "t" });
    flow.reopen("data");
    expect(status("data")).toBe("active");
    expect(status("template")).toBe("done");
    flow.complete("data", { summary: "d2" });
    expect(status("mapping")).toBe("active");
    expect(status("template")).toBe("done");
    expect(flow.getState().revision.data).toBe(2);
  });

  it("invalidates a step", () => {
    flow.complete("data", { summary: "d" });
    flow.invalidate("data");
    expect(status("data")).toBe("locked");
    expect(flow.getState().summaries.data).toBeUndefined();
  });
});
