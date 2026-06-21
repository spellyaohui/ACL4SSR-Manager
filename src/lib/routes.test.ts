import { describe, expect, it } from "vitest";

import { publicBaseUrl } from "./routes";

describe("publicBaseUrl", () => {
  it("uses the forwarded public host and protocol when behind a proxy", () => {
    const request = new Request("http://127.0.0.1:3000/api/profiles/1/preview", {
      headers: {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "acl4ssr.wjtjyy.top",
        "x-forwarded-proto": "https",
      },
    });

    expect(publicBaseUrl(request)).toBe("https://acl4ssr.wjtjyy.top");
  });

  it("falls back to the request host when no forwarded headers exist", () => {
    const request = new Request("http://localhost:3000/health/live", {
      headers: { host: "localhost:3000" },
    });

    expect(publicBaseUrl(request)).toBe("http://localhost:3000");
  });
});
