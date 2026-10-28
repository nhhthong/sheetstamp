import { describe, expect, it } from "vitest";
import { MAX_PING_LENGTH, parsePingRequest } from "./ipc";

describe("parsePingRequest", () => {
  it("accepts a message", () => {
    expect(parsePingRequest({ message: "xin chào" })).toEqual({ message: "xin chào" });
  });

  it.each([
    null,
    undefined,
    1,
    "x",
    {},
    { message: 1 },
    { message: "a".repeat(MAX_PING_LENGTH + 1) },
  ])("rejects %j", (value) => {
    expect(() => parsePingRequest(value)).toThrow(TypeError);
  });
});
