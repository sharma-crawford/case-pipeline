import { describe, expect, test } from "vitest";
import { intakeAlertText, intakeRunError, parseIntakeOutput } from "./drive-intake-alert.js";

const TOTALS =
  "[drive] 12 file(s) since 2026-10-08 · to SharePoint 9 · to Monday 9 · already there 0 · waiting for a folder 0 · for review 1 · failed 2";

describe("Drive intake alert", () => {
  test("a crash quotes its reason", () => {
    const f = parseIntakeOutput(
      [
        "[drive] APPLY — files uploaded since 2026-10-08",
        '[drive] FATAL Drive 500: { "error": { "code": 500, "message": "Unknown Error." } }',
      ].join("\n"),
    );
    expect(f.fatal).toMatch(/^Drive 500: .*Unknown Error/);
    expect(intakeRunError(1, f)).toBe(f.fatal);
    const text = intakeAlertText(1, f, null);
    expect(text).toContain("It stopped early: Drive 500");
    expect(text).toContain("aren't being copied");
  });

  test("failed files are listed with their client, five at most", () => {
    const failed = Array.from({ length: 7 }, (_, i) => `  FAILED  doc${i}.pdf → Test Client ${i}: SharePoint 503`);
    const f = parseIntakeOutput(["  copied  ok.pdf", ...failed, TOTALS].join("\n"));
    expect(f.files[0]).toBe("doc0.pdf → Test Client 0: SharePoint 503");
    expect(intakeRunError(1, f)).toBe("7 file(s) failed");
    const text = intakeAlertText(1, f, null);
    expect(text).toContain("7 file(s) didn't go through:");
    expect(text).toContain("• doc4.pdf → Test Client 4");
    expect(text).not.toContain("doc5.pdf");
    expect(text).toContain("…and 2 more.");
    expect(text).toContain("Run: 12 file(s) since 2026-10-08");
    expect(text).toContain("retried on the next run");
  });

  test("a folder-link failure counts too", () => {
    const f = parseIntakeOutput("  FAILED  folder link → Test Client: Monday 500");
    expect(f.files).toEqual(["folder link → Test Client: Monday 500"]);
  });

  test("an exit nothing explains falls back to the last error line", () => {
    const f = parseIntakeOutput("DRIVE_INTAKE_ROOT_ID is not set.");
    expect(intakeRunError(1, f)).toBe("exit code 1");
    expect(intakeAlertText(1, f, "DRIVE_INTAKE_ROOT_ID is not set.")).toContain("Last error: DRIVE_INTAKE_ROOT_ID is not set.");
  });

  test("long reasons are clipped", () => {
    const f = parseIntakeOutput(`[drive] FATAL ${"x".repeat(500)}`);
    expect(f.fatal!.length).toBe(200);
  });
});
