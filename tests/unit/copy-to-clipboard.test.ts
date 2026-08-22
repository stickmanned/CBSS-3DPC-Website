import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "@/app/components/copy-to-clipboard";

const ADDRESS = "080-wwen@sd43.bc.ca";

function stubDocument(execCommand: () => boolean) {
  const node = {
    value: "",
    style: {} as Record<string, string>,
    setAttribute: vi.fn(),
    select: vi.fn(),
  };
  vi.stubGlobal("document", {
    createElement: () => node,
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    execCommand,
  });
  return node;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyToClipboard", () => {
  it("uses the Clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyToClipboard(ADDRESS)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
  });

  // Managed school browsers are the reason this path exists at all: the async
  // Clipboard API is frequently refused by policy there.
  it("falls back to execCommand when the Clipboard API is refused", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const node = stubDocument(() => true);

    await expect(copyToClipboard(ADDRESS)).resolves.toBe(true);
    expect(node.value).toBe(ADDRESS);
  });

  it("falls back when the Clipboard API is missing entirely", async () => {
    vi.stubGlobal("navigator", {});
    const node = stubDocument(() => true);

    await expect(copyToClipboard(ADDRESS)).resolves.toBe(true);
    expect(node.value).toBe(ADDRESS);
  });

  // Reporting false is what makes the button say "Select it above" instead of
  // claiming a copy that never happened.
  it("reports failure rather than claiming a copy that did not happen", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => false);

    await expect(copyToClipboard(ADDRESS)).resolves.toBe(false);
  });

  it("reports failure when the fallback itself throws", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => {
      throw new Error("blocked");
    });

    await expect(copyToClipboard(ADDRESS)).resolves.toBe(false);
  });

  it("never leaves the scratch node attached to the page", async () => {
    vi.stubGlobal("navigator", {});
    const removeChild = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({
        value: "",
        style: {} as Record<string, string>,
        setAttribute: vi.fn(),
        select: vi.fn(),
      }),
      body: { appendChild: vi.fn(), removeChild },
      execCommand: () => true,
    });

    await copyToClipboard(ADDRESS);
    expect(removeChild).toHaveBeenCalledOnce();
  });
});
