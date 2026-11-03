// =============================================================================
// Where a fully paid Fee K goes next, by its Fee K Type (firm rule 2026-11-03)
// =============================================================================
// Most cases go through Prescheduling: "Paid needs action" → Paid Fee Ks.
// Two kinds don't, and staff used to route them by hand before LawPay marked
// every paid Fee K "Paid needs action" (2026-10-16):
//
//   skip  — Master hearings and litigation need no Prescheduling: PS Stage
//           "Completed" + Contract Stage "Create Project", which Monday turns
//           into Closed Fee Ks + the item on the case's board.
//   bond  — bond motions: "Paid needs action" (Monday then opens the Court
//           Cases item), but into the Fee Ks board's "Bond Motions" group (the
//           bond hearing's Prescheduling) rather than Paid Fee Ks.
//
// Kept apart from the Fee K Types table's `prescheduling` flag: that one says
// whether the client owes documents (the Buzón list), and a Master hearing
// does — it just doesn't wait for them in Prescheduling.
// =============================================================================

export type PaidRoute =
  | { kind: "prescheduling" }
  | { kind: "skip"; board: string }
  | { kind: "bond"; board: string };

/** Fee K Type (or the older "Contract for…" label) → its board, by route. */
const SKIP: Record<string, string> = {
  "master": "Court Cases",
  "detained master": "Court Cases",
  "habeas": "Litigations",
  "mandamus": "Litigations",
  "litigation": "Litigations",
  "federal litigation": "Litigations",
};
const BOND = new Set(["bond", "emergency bond"]);

/** "Bond MTN  (c)" → "bond": no court marker, no "MTN", any case or spacing. */
const key = (t: string) => t.replace(/\(c\)/gi, "").replace(/\bmtn\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * A Fee K with several types skips Prescheduling only when every one of them
 * does; a bond with a Master hearing is a bond. Any other type, or none:
 * Prescheduling, as before.
 */
export function paidRoute(feeKTypes: string[]): PaidRoute {
  const keys = feeKTypes.map(key).filter(Boolean);
  if (keys.length === 0 || keys.some((k) => !(k in SKIP) && !BOND.has(k))) return { kind: "prescheduling" };
  if (keys.some((k) => BOND.has(k))) return { kind: "bond", board: "Motions" };
  const boards = [...new Set(keys.map((k) => SKIP[k]!))];
  // A Master hearing with a habeas: no single board to open, so leave it to staff.
  return boards.length === 1 ? { kind: "skip", board: boards[0]! } : { kind: "prescheduling" };
}
