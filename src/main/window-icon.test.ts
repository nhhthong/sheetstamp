import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { windowIconPath } from "./window-icon";

describe("windowIconPath", () => {
  it("reads resources/icon.png when packaged and build/icon.png otherwise", () => {
    expect(windowIconPath("linux", true, "/opt/Sheetstamp/resources", "/x")).toBe(
      join("/opt/Sheetstamp/resources", "icon.png"),
    );
    expect(windowIconPath("win32", false, "/r", "/repo")).toBe(join("/repo", "build", "icon.png"));
  });
  it("gives macOS no icon, the bundle has it", () => {
    expect(windowIconPath("darwin", true, "/r", "/a")).toBeUndefined();
  });
  it("points at a file that exists in the checkout", () => {
    const path = windowIconPath("linux", false, "", join(import.meta.dirname, "../.."));
    expect(path && existsSync(path)).toBe(true);
  });
});
