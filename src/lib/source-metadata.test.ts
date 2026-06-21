import { describe, expect, it } from "vitest";

import { parseSubscriptionUserInfo } from "./source-metadata";

describe("parseSubscriptionUserInfo", () => {
  it("parses usage, total and expire fields from subscription headers", () => {
    const parsed = parseSubscriptionUserInfo("upload=1024; download=2048; total=4096; expire=1782098947");

    expect(parsed).toEqual({
      upload: 1024,
      download: 2048,
      total: 4096,
      expire: 1782098947,
    });
  });

  it("returns null when required traffic fields are missing", () => {
    expect(parseSubscriptionUserInfo("expire=1782098947")).toBeNull();
  });
});
