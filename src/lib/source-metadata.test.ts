import { describe, expect, it } from "vitest";

import { buildSubscriptionUserInfoHeader, parseSubscriptionUserInfo } from "./source-metadata";

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

describe("buildSubscriptionUserInfoHeader", () => {
  it("aggregates traffic and uses the earliest expire time", () => {
    const header = buildSubscriptionUserInfoHeader([
      {
        lastStatus: JSON.stringify({
          ok: true,
          checkedAt: "2026-06-22T00:00:00.000Z",
          userInfo: { upload: 100, download: 200, total: 1000, expire: 1784690947 },
        }),
      },
      {
        lastStatus: JSON.stringify({
          ok: true,
          checkedAt: "2026-06-22T00:00:00.000Z",
          userInfo: { upload: 50, download: 75, total: 500, expire: 1782098947 },
        }),
      },
    ]);

    expect(header).toBe("upload=150; download=275; total=1500; expire=1782098947");
  });

  it("returns null when no stored metadata is available", () => {
    expect(buildSubscriptionUserInfoHeader([{ lastStatus: null }])).toBeNull();
  });
});
