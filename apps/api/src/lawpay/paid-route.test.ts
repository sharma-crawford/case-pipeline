import { describe, it, expect } from "vitest";
import { paidRoute } from "./paid-route.js";

describe("paidRoute", () => {
  it("Master hearings → Court Cases, litigation → Litigations, without Prescheduling", () => {
    expect(paidRoute(["Master (c)"])).toEqual({ kind: "skip", board: "Court Cases" });
    expect(paidRoute(["Detained Master (c)"])).toEqual({ kind: "skip", board: "Court Cases" });
    for (const t of ["Habeas", "Mandamus", "Litigation", "Federal Litigation"]) {
      expect(paidRoute([t])).toEqual({ kind: "skip", board: "Litigations" });
    }
  });

  it("bonds → Motions, with or without a Master hearing; the old Contract for… labels too", () => {
    expect(paidRoute(["Bond MTN  (c)"])).toEqual({ kind: "bond", board: "Motions" });
    expect(paidRoute(["Emergency Bond MTN (c)"])).toEqual({ kind: "bond", board: "Motions" });
    expect(paidRoute(["Bond", "Master"])).toEqual({ kind: "bond", board: "Motions" });
    expect(paidRoute(["Detained Master"])).toEqual({ kind: "skip", board: "Court Cases" });
  });

  it("anything else, nothing, or two different boards → Prescheduling", () => {
    expect(paidRoute([])).toEqual({ kind: "prescheduling" });
    expect(paidRoute(["I-130 - Petition for Alien Relative"])).toEqual({ kind: "prescheduling" });
    expect(paidRoute(["Master (c)", "I-589 - Defensive Asylum  (c)"])).toEqual({ kind: "prescheduling" });
    expect(paidRoute(["Master (c)", "Habeas"])).toEqual({ kind: "prescheduling" });
    expect(paidRoute(["Motion (c)"])).toEqual({ kind: "prescheduling" });
  });
});
