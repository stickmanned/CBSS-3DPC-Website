import { describe, expect, it } from "vitest";
import {
  privateStatusUrl,
  statusCookieName,
  statusRoutePath,
} from "@/app/lib/queue/status-access";

describe("private status access", () => {
  it("keeps the bearer in a URL fragment instead of the HTTP path or query", () => {
    const token = "a".repeat(43);
    const url = new URL(privateStatusUrl("https://queue.example.test", "CBSS-0042", token));

    expect(url.pathname).toBe("/status/CBSS-0042");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#${token}`);
    expect(url.pathname).not.toContain(token);
  });

  it("uses a narrow route path and request-specific cookie name", () => {
    expect(statusRoutePath("cbss-0042")).toBe("/status/CBSS-0042");
    expect(statusCookieName("CBSS-0042")).toBe("cbss_status_cbss_0042");
  });
});
