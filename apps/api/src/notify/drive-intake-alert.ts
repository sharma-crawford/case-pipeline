// =============================================================================
// Drive intake failure alert — what went wrong, read from the run's output
// =============================================================================
// scripts/drive-intake.ts prints one `  FAILED  <file> → <client>: <why>` line
// per file it couldn't copy, a `[drive] … failed N` totals line, and on a crash
// one `[drive] FATAL <why>` line. The alert quotes those, so staff can tell a
// Google blip from a stuck client without opening the API log.
// =============================================================================

const MAX_FILES = 5;
const MAX_REASON = 200;

const clip = (s: string) => (s.length > MAX_REASON ? `${s.slice(0, MAX_REASON - 1)}…` : s);

export interface IntakeFailure {
  /** Why the run stopped, when it crashed rather than finishing. */
  fatal: string | null;
  /** `<file> → <client>: <why>`, in the order they failed. */
  files: string[];
  /** The `N file(s) since … · failed N` line, without its `[drive]` prefix. */
  totals: string | null;
}

export function parseIntakeOutput(output: string): IntakeFailure {
  const lines = output.split(/\r?\n/);
  const fatal = lines.findLast((l) => l.startsWith("[drive] FATAL "))?.slice("[drive] FATAL ".length).trim() ?? null;
  const files = lines.filter((l) => l.trimStart().startsWith("FAILED  ")).map((l) => l.trim().slice("FAILED  ".length).trim());
  const totals = lines.findLast((l) => /^\[drive\] \d+ file\(s\) since /.test(l))?.slice("[drive] ".length).trim() ?? null;
  return { fatal: fatal && clip(fatal), files: files.map(clip), totals };
}

/** One line for Settings → Workflows. */
export function intakeRunError(code: number | null, f: IntakeFailure): string {
  if (f.fatal) return f.fatal;
  if (f.files.length) return `${f.files.length} file(s) failed`;
  return `exit code ${code}`;
}

/** The Slack ops message. `lastLine` is the run's last stderr line, for exits nothing above explains. */
export function intakeAlertText(code: number | null, f: IntakeFailure, lastLine: string | null): string {
  const out = [`Drive intake failed (exit code ${code}).`];
  if (f.fatal) out.push(`It stopped early: ${f.fatal}`);
  if (f.files.length) {
    out.push(`${f.files.length} file(s) didn't go through:`);
    for (const file of f.files.slice(0, MAX_FILES)) out.push(`• ${file}`);
    if (f.files.length > MAX_FILES) out.push(`…and ${f.files.length - MAX_FILES} more.`);
  }
  if (!f.fatal && !f.files.length && lastLine) out.push(`Last error: ${clip(lastLine)}`);
  if (f.totals) out.push(`Run: ${f.totals}`);
  out.push(
    f.fatal || !f.files.length
      ? "Client uploads aren't being copied to SharePoint until a run succeeds."
      : "The rest went through. These are retried on the next run.",
  );
  return out.join("\n");
}
