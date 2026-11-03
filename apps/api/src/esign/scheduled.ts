// =============================================================================
// Scheduled Adobe Sign sends — a contract that goes out on a later date
// =============================================================================
// Monday already says when: a Fee K with Contract Stage "SCHEDULED - fee k to
// be sent" (label 103) and "Send Fee K By:" (lookup_mm55y7zr, a mirror of the
// Calendaring item's "Send Fee K On:"). The PDF can only be made in the browser
// (M22, the user's Microsoft 365), so staff prepare it ahead: Preview → **Send
// on scheduled date** keeps that exact PDF on the server (esign_agreements,
// status 'scheduled'). Then, every run, each scheduled Fee K is re-read from
// Monday:
//
//   stage no longer SCHEDULED → canceled (someone took it by hand), with a note
//   no "Send Fee K By:" date  → waits
//   date after today          → waits (the date may move in Calendaring; the
//                               live one is what counts)
//   date today or past        → sent, exactly like Send for signature
//
// A SCHEDULED Fee K whose date came with no contract prepared gets one note
// per date, so the Fee K doesn't sit there unnoticed.
//
// Pure rules here (unit-tested); routes/esign.ts applies them.
// docs/features/esign-zapier.md → "Scheduled sends".
// =============================================================================

/** Contract Stage label 103 on the Fee Ks board. */
export const SCHEDULED_STAGE = "SCHEDULED - fee k to be sent";
/** "(c) Send Fee K By:" — mirror of Calendaring's "Send Fee K On:" (date_mm55r8zb). */
export const SEND_BY_COLUMN = "lookup_mm55y7zr";

/** A Fee K as Monday has it right now; null = gone (deleted, archived or no access). */
export interface LiveFeeK {
  stage: string | null;
  /** YYYY-MM-DD, or null when empty. */
  sendBy: string | null;
}

export type ScheduledSendPlan =
  | { action: "send"; sendBy: string }
  | { action: "wait"; reason: string }
  | { action: "cancel"; reason: string };

/**
 * The mirror's display_value → YYYY-MM-DD. Linked to several Calendaring items
 * it lists each date ("2026-11-05, 2026-12-01"); the earliest wins.
 */
export function parseSendBy(display: string | null | undefined): string | null {
  const dates = (display ?? "").match(/\d{4}-\d{2}-\d{2}/g);
  return dates ? [...dates].sort()[0]! : null;
}

const sameStage = (stage: string | null) => !!stage && stage.trim().toLowerCase() === SCHEDULED_STAGE.toLowerCase();

export function planScheduledSend(live: LiveFeeK | null, today: string): ScheduledSendPlan {
  if (!live) return { action: "cancel", reason: "the Fee K is no longer on Monday" };
  if (!sameStage(live.stage)) return { action: "cancel", reason: `the Contract Stage is now "${live.stage?.trim() || "No stage"}"` };
  if (!live.sendBy) return { action: "wait", reason: "no Send Fee K By date" };
  if (live.sendBy > today) return { action: "wait", reason: `sends on ${live.sendBy}` };
  return { action: "send", sendBy: live.sendBy };
}

/** A SCHEDULED Fee K with no prepared contract: remind once its date has come. */
export function needsReminder(live: LiveFeeK | null, today: string): string | null {
  if (!live || !sameStage(live.stage) || !live.sendBy || live.sendBy > today) return null;
  return live.sendBy;
}

/** Can staff schedule this Fee K now? Its "Send Fee K By:" date is what it waits for. */
export function scheduleRejection(live: LiveFeeK | null, today: string): string | null {
  if (!live) return "This Fee K could not be read from Monday — try again in a minute";
  if (!live.sendBy) return "This Fee K has no Send Fee K By date. Set Send Fee K On on its Calendaring item first.";
  if (live.sendBy < today) return `The Send Fee K By date (${live.sendBy}) has passed — use Send for signature instead`;
  return null;
}

/** "2026-11-05" → "Thursday, Nov 5" for notes and messages. */
export function sendDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}
