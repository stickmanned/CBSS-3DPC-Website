import { describe, expect, it } from "vitest";
import {
  DECLINED_REASON_COPY,
  NEEDS_CHANGES_REASON_COPY,
  PRINT_FAILED_REASON_COPY,
  firstName,
  renderApprovedEmail,
  renderDeclinedEmail,
  renderNeedsChangesEmail,
  renderPickedUpEmail,
  renderPrintFailedEmail,
  renderPrintingEmail,
  renderReadyForPickupEmail,
  renderSubmittedEmail,
  renderUncollectedEmail,
  type EmailTemplate,
  type QueueEmailTokens,
} from "../../app/lib/email-templates";
import {
  DECLINED_REASON_KEYS,
  NEEDS_CHANGES_REASON_KEYS,
  PRINT_FAILED_REASON_KEYS,
} from "../../app/lib/queue/domain";

const tokens: QueueEmailTokens = {
  first_name: "Alex",
  ref: "CBSS-0042",
  model_name: "robot-arm.stl",
  material: "petg",
  colors: ["Navy", "Signal Yellow"],
  quantity: 3,
  bbox: [120, 80, 45],
  status_url: "https://example.test/request/CBSS-0042?t=opaque",
};

function allEmails(): EmailTemplate[] {
  return [
    renderSubmittedEmail(tokens),
    renderApprovedEmail(tokens),
    renderPrintingEmail(tokens),
    renderReadyForPickupEmail(tokens),
    renderUncollectedEmail(tokens),
    ...PRINT_FAILED_REASON_KEYS.map((reason) => renderPrintFailedEmail(tokens, reason)),
    ...NEEDS_CHANGES_REASON_KEYS.map((reason) => renderNeedsChangesEmail(tokens, reason)),
    ...DECLINED_REASON_KEYS.map((reason) => renderDeclinedEmail(tokens, reason)),
  ];
}

describe("queue email templates", () => {
  it("renders all required tokens and club's choice", () => {
    const approved = renderApprovedEmail(tokens);
    expect(approved.subject).toBe("Your print is approved — CBSS-0042");
    expect(approved.text).toContain("Hi Alex,");
    expect(approved.text).toContain("robot-arm.stl");
    expect(approved.text).toContain("Material: PETG");
    expect(approved.text).toContain("Colors: Navy, Signal Yellow");
    expect(approved.text).toContain("Copies: 3");
    expect(renderApprovedEmail({ ...tokens, colors: [] }).text).toContain(
      "Colors: club's choice",
    );
    expect(firstName("  Alex Smith ")).toBe("Alex");
  });

  it("renders every stable reason without unresolved placeholders", () => {
    for (const email of allEmails()) {
      expect(email.text).not.toMatch(/{{[^}]+}}/);
      expect(email.text).toContain("CBSS 3D Printing Club");
    }
    expect(renderPrintFailedEmail(tokens, "warped").text).toContain("PETG is prone");
    expect(renderNeedsChangesEmail(tokens, "too_large").text).toContain("120 × 80 × 45 mm");
    expect(renderDeclinedEmail(tokens, "too_big_a_job").text).toContain("At 3 copies");
    expect(Object.keys(PRINT_FAILED_REASON_COPY)).toEqual([...PRINT_FAILED_REASON_KEYS]);
    expect(Object.keys(NEEDS_CHANGES_REASON_COPY)).toEqual([...NEEDS_CHANGES_REASON_KEYS]);
    expect(Object.keys(DECLINED_REASON_COPY)).toEqual([...DECLINED_REASON_KEYS]);
  });

  it("contains no turnaround or date-duration promise", () => {
    const forbidden = [
      /\bturnaround\b/i,
      /\bwithin\s+\d+/i,
      /\bin\s+\d+\s+(?:business\s+)?(?:hours?|days?|weeks?)\b/i,
      /\bready\s+(?:in|by)\b/i,
      /\bcompleted?\s+by\b/i,
      /\b(?:today|tomorrow|tonight)\b/i,
    ];
    for (const email of allEmails()) {
      for (const pattern of forbidden) expect(email.text).not.toMatch(pattern);
    }
  });

  it("sends no picked-up email", () => {
    expect(renderPickedUpEmail()).toBeNull();
  });
});
