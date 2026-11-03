import { describe, it, expect } from "vitest";
import { SCHEDULED_STAGE, needsReminder, parseSendBy, planScheduledSend, scheduleRejection, sendDateLabel } from "./scheduled.js";

const live = (sendBy: string | null, stage: string | null = SCHEDULED_STAGE) => ({ stage, sendBy });

describe("parseSendBy", () => {
  it("reads the mirror's date, the earliest when several are linked", () => {
    expect(parseSendBy("2026-11-05")).toBe("2026-11-05");
    expect(parseSendBy("2026-12-01, 2026-11-05")).toBe("2026-11-05");
    expect(parseSendBy("")).toBeNull();
    expect(parseSendBy(null)).toBeNull();
  });
});

describe("planScheduledSend", () => {
  it("sends on the date and after it", () => {
    expect(planScheduledSend(live("2026-11-05"), "2026-11-05")).toEqual({ action: "send", sendBy: "2026-11-05" });
    expect(planScheduledSend(live("2026-11-01"), "2026-11-05").action).toBe("send");
  });
  it("waits before the date or without one", () => {
    expect(planScheduledSend(live("2026-11-06"), "2026-11-05").action).toBe("wait");
    expect(planScheduledSend(live(null), "2026-11-05").action).toBe("wait");
  });
  it("cancels when the stage moved or the Fee K is gone", () => {
    expect(planScheduledSend(live("2026-11-01", "Atty Reviewing"), "2026-11-05")).toEqual({
      action: "cancel", reason: 'the Contract Stage is now "Atty Reviewing"',
    });
    expect(planScheduledSend(live("2026-11-01", null), "2026-11-05").action).toBe("cancel");
    expect(planScheduledSend(null, "2026-11-05").action).toBe("cancel");
  });
});

describe("needsReminder / scheduleRejection", () => {
  it("reminds only on a SCHEDULED Fee K whose date has come", () => {
    expect(needsReminder(live("2026-11-05"), "2026-11-05")).toBe("2026-11-05");
    expect(needsReminder(live("2026-11-06"), "2026-11-05")).toBeNull();
    expect(needsReminder(live("2026-11-01", "New"), "2026-11-05")).toBeNull();
  });
  it("schedules only with a date that hasn't passed", () => {
    expect(scheduleRejection(live("2026-11-05", "New"), "2026-11-05")).toBeNull();
    expect(scheduleRejection(live(null, "New"), "2026-11-05")).toMatch(/no Send Fee K By date/);
    expect(scheduleRejection(live("2026-11-04", "New"), "2026-11-05")).toMatch(/has passed/);
    expect(scheduleRejection(null, "2026-11-05")).toMatch(/could not be read/);
  });
  it("labels the date without a time-zone shift", () => {
    expect(sendDateLabel("2026-11-05")).toBe("Thursday, Nov 5");
  });
});
