import { describe, expect, it } from "vitest";
import { appInfo } from "./app";
import {
  arrayOf,
  bytes,
  IpcValidationError,
  integer,
  nothing,
  oneOf,
  record,
  string,
} from "./define";
import { CHANNEL_NAMES } from "./registry";

describe("validators", () => {
  it("accepts app:info only without an argument", () => {
    expect(appInfo.parse(undefined)).toBeUndefined();
    for (const bad of [1, "x", {}, { message: 1 }, []]) {
      expect(() => appInfo.parse(bad)).toThrow(IpcValidationError);
    }
  });

  it("checks each primitive", () => {
    expect(() => record([])).toThrow(IpcValidationError);
    expect(() => string(1, "x")).toThrow();
    expect(() => string("", "x", { min: 1 })).toThrow();
    expect(() => integer(1.5, "x")).toThrow();
    expect(() => integer(5, "x", { max: 4 })).toThrow();
    expect(oneOf("a", "x", ["a", "b"] as const)).toBe("a");
    expect(() => oneOf("c", "x", ["a", "b"] as const)).toThrow();
    expect(arrayOf([1, 2], "x", (v) => integer(v, "i"))).toEqual([1, 2]);
    expect(() => arrayOf([1, 2, 3], "x", (v) => v, 2)).toThrow();
    expect(() => bytes(new Uint8Array(5), "x", 4)).toThrow();
    expect(nothing(undefined)).toBeUndefined();
    expect(() => nothing(1)).toThrow();
  });

  it("registers every channel once", () => {
    expect(CHANNEL_NAMES.has("app:info")).toBe(true);
  });
});
