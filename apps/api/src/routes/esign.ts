// =============================================================================
// Contracts out for signature in Adobe Sign, through Zapier (P14 → M22)
// =============================================================================
// The firm's Adobe Sign is reachable only through Zapier, so the app talks to
// three Zaps (docs/features/esign-zapier.md has every field):
//
//   app ──POST──▶ Zap 1 (Catch Hook → Upload Document → Create Agreement,
//                 attorney order 1, client order 2 → POST "sent" back)
//   Zap 2 (Agreement State Changed) ──POST──▶ /api/webhooks/zapier/:secret
//   Zap 3 (Signed by All → PDF of Signed Agreement) ──POST "signed_pdf"──▶ same
//
// POST /api/contracts/:localId/esign — the browser already made the PDF (M22,
//   the user's Microsoft 365). Raw PDF body + ?attorneyEmail=&clientEmail=.
//   The PDF waits under data/esign/ behind a random link Zap 1 downloads from
//   (GET /api/esign/files/:token, no login — the token is the key, valid 3
//   days). Then the step "sent for signature" (Atty Reviewing) and a note.
//   With ?schedule=1 the PDF is kept instead and goes out on the Fee K's "Send
//   Fee K By:" date (stage → SCHEDULED; esign/scheduled.ts has the rules):
//   runScheduledEsign, every 15 minutes, sends it — or cancels it when the
//   stage was moved off SCHEDULED. GET / DELETE …/esign/scheduled shows or
//   cancels one from M22.
// POST /api/webhooks/zapier/:secret — every Adobe event. events.ts decides;
//   this applies: the CONTRACT_STEPS write (stage + date), a note on the Fee K,
//   and for signed / rejected / expired / recalled a Monday notification to
//   whoever sent it + Slack. Every note also lands in the client PROFILE's
//   Emails & Activities as a "Contract note" (since 2026-10-14), so the
//   contract's history shows on the client's timeline. The signed PDF goes onto the Fee K's (else the
//   client profile's) file column.
//
// Off unless ZAPIER_ESIGN_HOOK_URL, ZAPIER_ESIGN_SECRET and API_URL are set.
// Writes made for an Adobe event go under the sender's Monday token (shared
// token as the net), like every other write-back.
// =============================================================================

import express from "express";
import type { Express, Request } from "express";
import type BetterSqlite3 from "better-sqlite3";
type DatabaseInstance = BetterSqlite3.Database;
import fs from "node:fs";
import path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { requireAuth } from "../auth/middleware.js";
import { auditFromReq, recordAudit } from "../audit/log.js";
import { dataSource } from "../data-source/index.js";
import { withTokenFallback } from "../write-auth.js";
import type { TokenFallbackOptions } from "../write-auth.js";
import type { WriteTokenOptions } from "../write-token.js";
import { enqueueWrite } from "../write-queue/processor.js";
import { getUserMondayToken, markMondayTokenRejected } from "./monday-oauth.js";
import { executeContractStep } from "./contract-step.js";
import { CONTRACT_NOTE_ACTIVITY_ID } from "./profile-write.js";
import { DATA_DIR } from "../paths.js";
import { usersDb } from "../db/users-db.js";
import { makeMondayUserByLogin } from "../contract-info.js";
import { getBoardColumnsFor } from "@case-pipeline/query";
import {
  OPEN_STATUSES, PAY_METHOD_LABELS, agreementNameOf, classifyEsignEvent, esignRefOf, payMethodFrom, planEsignEvent,
  signedDocumentName, type EsignStatus, type PayMethod,
} from "../esign/events.js";
import { notifyMonday, notifySlack } from "../esign/notify.js";
import { fileSignedContract } from "../esign/efile.js";
import {
  SCHEDULED_STAGE, SEND_BY_COLUMN, needsReminder, parseSendBy, planScheduledSend, scheduleRejection, sendDateLabel,
  type LiveFeeK,
} from "../esign/scheduled.js";
import { CONTRACT_STEPS, FEE_K_COLUMN_IDS } from "@case-pipeline/query";
import { FIRM_TIMEZONE } from "../firm.js";

const ESIGN_DIR = "esign";
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const FILE_LINK_HOURS = 72;
const MONDAY_ACCOUNT_URL = "https://scaltheclinic.monday.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export interface EsignConfig {
  hookUrl: string;
  secret: string;
  publicUrl: string;
}

/** Scheduled sends (Send on scheduled date + the job): off unless ESIGN_SCHEDULED=on, on top of esignConfig. */
export function scheduledSendsOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ESIGN_SCHEDULED === "on" && !!esignConfig(env);
}

/** Null = the feature is off (one of the three settings missing). */
export function esignConfig(env: NodeJS.ProcessEnv = process.env): EsignConfig | null {
  const hookUrl = env.ZAPIER_ESIGN_HOOK_URL?.trim();
  const secret = env.ZAPIER_ESIGN_SECRET?.trim();
  const publicUrl = env.API_URL?.trim().replace(/\/+$/, "");
  return hookUrl && secret && publicUrl ? { hookUrl, secret, publicUrl } : null;
}

interface AgreementRow {
  id: number;
  contract_local_id: string;
  contract_monday_id: string;
  profile_monday_id: string | null;
  client_name: string;
  client_email: string;
  attorney_email: string;
  agreement_id: string | null;
  file_token: string;
  status: EsignStatus;
  sent_by_oid: string | null;
  sent_by_name: string | null;
  sent_by_monday_id: string | null;
  document_name: string | null;
  send_on: string | null;
  sent_at: string | null;
  created_at: string;
}

function secretMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|#%&{}$!'@+`=]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "contract";

export interface EsignDeps {
  db: DatabaseInstance;
  mondayApiToken: string | undefined;
  writeTokenOptions: WriteTokenOptions;
}

/** Routes Zapier calls (no Azure login). Register BEFORE the /api/ requireAuth catch-all. */
export function registerEsignPublicRoutes(app: Express, deps: EsignDeps): void {
  const { db, mondayApiToken: MONDAY_API_TOKEN } = deps;

  // The PDF for Zap 1's "Upload a Document". The file name segment is cosmetic
  // (Adobe names the document after it).
  app.get("/api/esign/files/:token/:name", (req, res) => {
    const token = String(req.params.token);
    // A scheduled contract isn't served until it is sent; the 3 days run from then.
    const row = TOKEN_RE.test(token)
      ? (db.prepare("SELECT id, COALESCE(sent_at, created_at) AS sent FROM esign_agreements WHERE file_token = ? AND status NOT IN ('scheduled', 'canceled')").get(token) as { id: number; sent: string } | undefined)
      : undefined;
    const ageHours = row ? (Date.now() - Date.parse(`${row.sent.replace(" ", "T")}Z`)) / 3_600_000 : Infinity;
    const file = path.join(DATA_DIR, ESIGN_DIR, `${token}.pdf`);
    if (!row || ageHours > FILE_LINK_HOURS || !fs.existsSync(file)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.type("application/pdf").sendFile(file);
  });

  // Every event from Zaps 1–3.
  app.post("/api/webhooks/zapier/:secret", async (req, res) => {
    const config = esignConfig();
    if (!config) {
      res.status(503).json({ error: "Adobe Sign via Zapier is not configured" });
      return;
    }
    if (!secretMatches(String(req.params.secret ?? ""), config.secret)) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null);
    const kind = classifyEsignEvent(b.event);
    const agreementId = str(b.agreementId);
    const ref = esignRefOf(b.ref, b.agreementName);

    const row = (ref != null
      ? db.prepare("SELECT * FROM esign_agreements WHERE id = ?").get(ref)
      : agreementId
        ? db.prepare("SELECT * FROM esign_agreements WHERE agreement_id = ?").get(agreementId)
        : undefined) as AgreementRow | undefined;
    if (!row) {
      // Not one of ours (an agreement sent by hand from Adobe) — acknowledge so Zapier doesn't retry.
      res.json({ ok: true, ignored: "no matching contract" });
      return;
    }
    try {
      const result = await applyEvent(db, row, kind, {
        agreementId, participantEmail: str(b.participantEmail), pdfUrl: str(b.pdfUrl), rawEvent: str(b.event),
        agreementName: str(b.agreementName),
        // Zap 3's "Find Form Field Data" (the client's Credit / Debit / Cash pick).
        formData: b.formData ?? b.payMethod ?? null,
      }, MONDAY_API_TOKEN);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[esign] event failed:", err);
      db.prepare("UPDATE esign_agreements SET last_error = ?, updated_at = datetime('now') WHERE id = ?")
        .run(err instanceof Error ? err.message.slice(0, 500) : "error", row.id);
      // 500 → Zapier shows the step as errored and the run can be replayed.
      res.status(500).json({ error: "Could not apply the event" });
    }
  });
}

/** Token options for a write made on the sender's behalf, outside any request. */
function senderTokenOptions(row: AgreementRow, shared: string | undefined): TokenFallbackOptions {
  const oid = row.sent_by_oid ?? "";
  return {
    userToken: oid ? getUserMondayToken(oid) : null,
    sharedToken: shared,
    onPersonalTokenRejected: (reason) => oid && markMondayTokenRejected(oid, reason),
  };
}

/** The note as an update on the Fee K, and as a "Contract note" in the client profile's E&A. */
async function postNote(
  db: DatabaseInstance,
  n: { feeKItemId: string; profileItemId: string | null; title: string; body: string; localId: string },
  tokenOptions: TokenFallbackOptions,
  authorOid: string | null,
) {
  try {
    await withTokenFallback((token) => dataSource.postUpdate(n.feeKItemId, n.body, token), tokenOptions);
  } catch (err) {
    console.error("[esign] note failed; queueing:", err);
    enqueueWrite(db, { opType: "create_update", targetTable: "contracts", targetLocalId: n.localId, mondayItemId: n.feeKItemId, authorOid, payload: { body: n.body } });
  }
  if (!n.profileItemId) return;
  const activity = { itemId: n.profileItemId, title: n.title, customActivityId: CONTRACT_NOTE_ACTIVITY_ID, content: n.body };
  try {
    await withTokenFallback((token) => dataSource.createTimelineItem(activity, token), tokenOptions);
  } catch (err) {
    console.error("[esign] profile E&A entry failed; queueing:", err);
    enqueueWrite(db, { opType: "create_timeline_item", targetTable: "profiles", mondayItemId: n.profileItemId, authorOid, payload: { ...activity } });
  }
}

async function applyEvent(
  db: DatabaseInstance,
  row: AgreementRow,
  kind: ReturnType<typeof classifyEsignEvent>,
  ev: {
    agreementId: string | null; participantEmail: string | null; pdfUrl: string | null; rawEvent: string | null;
    agreementName: string | null; formData?: unknown;
  },
  sharedToken: string | undefined,
): Promise<Record<string, unknown>> {
  const tokenOptions = senderTokenOptions(row, sharedToken);
  const audit = (action: string, metadata: Record<string, unknown>) =>
    recordAudit({
      actor: { userId: null, email: "zapier:adobe-sign" }, action,
      targetType: "contract", targetId: row.contract_local_id, targetMondayId: row.contract_monday_id,
      metadata: { agreement: row.id, ...metadata },
    });

  db.prepare("UPDATE esign_agreements SET last_event = ?, agreement_id = COALESCE(agreement_id, ?), updated_at = datetime('now') WHERE id = ?")
    .run(ev.rawEvent, ev.agreementId, row.id);

  const pick = payMethodFrom(ev.formData);
  if (pick) await recordPayMethod(db, row, pick, tokenOptions, audit);

  if (kind === "signed_pdf") {
    const documentName = safeFileName(signedDocumentName(ev.agreementName, row.client_name));
    const result = await attachSignedPdf(db, row, ev.pdfUrl, documentName, tokenOptions, audit);
    fileInEfile(db, row, documentName, tokenOptions, audit);
    return result;
  }

  const plan = planEsignEvent(row, kind, ev.participantEmail);
  if (!plan.status) return { applied: false, kind };

  db.prepare("UPDATE esign_agreements SET status = ?, last_error = NULL, updated_at = datetime('now') WHERE id = ?").run(plan.status, row.id);

  const stepResults: Record<string, unknown> = {};
  for (const step of plan.steps) {
    const r = await executeContractStep(db, row.contract_local_id, { step }, {
      tokenOptions, authorOid: row.sent_by_oid,
      audit: (action, opts) => recordAudit({ actor: { userId: null, email: "zapier:adobe-sign" }, action, ...opts }),
    });
    // A stage someone moved by hand stays as they left it; the note still goes.
    stepResults[step] = r.ok ? r.data.stage : r.body.error;
  }
  if (plan.note) {
    await postNote(db, {
      feeKItemId: row.contract_monday_id, profileItemId: row.profile_monday_id,
      title: plan.title ?? "Contract update", body: plan.note, localId: row.contract_local_id,
    }, tokenOptions, row.sent_by_oid);
  }
  if (plan.notify) {
    const boardId = getBoardColumnsFor(db, "fee_ks")?.mondayBoardId;
    const link = boardId ? `${MONDAY_ACCOUNT_URL}/boards/${boardId}/pulses/${row.contract_monday_id}` : null;
    await Promise.all([
      notifyMonday(row.sent_by_monday_id, row.contract_monday_id, plan.notify, sharedToken),
      notifySlack(plan.notify, link),
    ]);
  }
  audit("esign.event", { kind, status: plan.status, steps: stepResults });
  return { applied: true, kind, status: plan.status, steps: stepResults };
}

/** The signed copy → the Fee K's file column, else the client profile's "Files". */
async function attachSignedPdf(
  db: DatabaseInstance,
  row: AgreementRow,
  pdfUrl: string | null,
  documentName: string,
  tokenOptions: TokenFallbackOptions,
  audit: (action: string, metadata: Record<string, unknown>) => void,
): Promise<Record<string, unknown>> {
  if (!pdfUrl || !/^https:\/\//i.test(pdfUrl)) throw new Error("signed_pdf needs an https pdfUrl");
  const res = await fetch(pdfUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Downloading the signed PDF failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES) throw new Error("Signed PDF is empty or too large");

  const rel = path.join(ESIGN_DIR, `signed-${row.id}.pdf`);
  fs.mkdirSync(path.join(DATA_DIR, ESIGN_DIR), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, rel), bytes, { mode: 0o600 });
  db.prepare("UPDATE esign_agreements SET signed_pdf_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(row.id);

  const feeKFile = getBoardColumnsFor(db, "fee_ks")?.columns.find((c) => c.type === "file");
  const profileFiles = getBoardColumnsFor(db, "profiles")?.columns.find((c) => c.type === "file" && c.title.trim().toLowerCase() === "files");
  const target = feeKFile
    ? { itemId: row.contract_monday_id, columnId: feeKFile.columnId, table: "contracts", localId: row.contract_local_id }
    : profileFiles && row.profile_monday_id
      ? { itemId: row.profile_monday_id, columnId: profileFiles.columnId, table: "profiles", localId: null }
      : null;
  if (!target) {
    audit("esign.signed_pdf", { attached: false, reason: "no file column" });
    return { attached: false, saved: true };
  }
  const fileName = `${documentName}.pdf`;
  try {
    await withTokenFallback(
      (token) => dataSource.addFile(target.itemId, target.columnId, fileName, new Uint8Array(bytes), "application/pdf", token),
      tokenOptions,
    );
  } catch (err) {
    console.error("[esign] attaching the signed PDF failed; queueing:", err);
    enqueueWrite(db, {
      opType: "add_file", targetTable: target.table, targetLocalId: target.localId, mondayItemId: target.itemId,
      authorOid: row.sent_by_oid, payload: { columnId: target.columnId, filePath: rel, fileName, contentType: "application/pdf" },
    });
  }
  audit("esign.signed_pdf", { attached: true, on: target.table });
  return { attached: true, on: target.table };
}

const PAY_METHOD_COLUMN = "dropdown_mm7v5eeb"; // fee_ks.payment_method
const PAY_METHOD_WORDS: Record<PayMethod, string> = { credit: "credit card", debit: "debit card", cash: "cash" };

/**
 * The client's Credit / Debit / Cash pick → the Fee K's Payment Method, when
 * it's empty (a label staff set, e.g. SPLIT PAYMENTS, stays). Credit also sets
 * off the Fee K auto-fill's 3% surcharge columns. A note tells staff the
 * payment links are ready to e-mail (M21) — once, whatever Zapier repeats.
 */
async function recordPayMethod(
  db: DatabaseInstance,
  row: AgreementRow,
  pick: PayMethod,
  tokenOptions: TokenFallbackOptions,
  audit: (action: string, metadata: Record<string, unknown>) => void,
): Promise<void> {
  const label = PAY_METHOD_LABELS[pick];
  const current = db.prepare(
    "SELECT json_extract(raw_column_values, '$.payment_method.labels[0]') AS m FROM contracts WHERE local_id = ?",
  ).get(row.contract_local_id) as { m: string | null } | undefined;
  if (current?.m === label) return; // already recorded (a repeated event)
  const boardId = getBoardColumnsFor(db, "fee_ks")?.mondayBoardId;
  let written = false;
  if (!current?.m && boardId) {
    const value = { labels: [label] };
    try {
      await withTokenFallback(
        (token) => dataSource.setColumnValues(boardId, row.contract_monday_id, { [PAY_METHOD_COLUMN]: value }, token),
        tokenOptions,
      );
    } catch (err) {
      console.error("[esign] payment method write failed; queueing:", err);
      enqueueWrite(db, {
        opType: "change_column_json", targetTable: "contracts", targetLocalId: row.contract_local_id,
        mondayItemId: row.contract_monday_id, authorOid: row.sent_by_oid,
        payload: { boardId, columnId: PAY_METHOD_COLUMN, value },
      });
    }
    db.prepare("UPDATE contracts SET raw_column_values = json_set(COALESCE(raw_column_values, '{}'), '$.payment_method', json(?)) WHERE local_id = ?")
      .run(JSON.stringify({ labels: [label] }), row.contract_local_id);
    written = true;
  }
  audit("esign.pay_method", { pick, written, kept: written ? null : current?.m ?? null });
  const next = pick === "cash"
    ? "No payment links: the client pays in cash during lobby hours."
    : "Payment links are ready: Contracts → ⋯ → Payment links → Email links to client.";
  const body = written
    ? `💳 In the contract, ${row.client_name} chose to pay by ${PAY_METHOD_WORDS[pick]}. ${next}`
    : `💳 In the contract, ${row.client_name} chose to pay by ${PAY_METHOD_WORDS[pick]}, but the Fee K's Payment Method says "${current?.m}" — left as it is. Check with the client before sending links.`;
  await postNote(db, {
    feeKItemId: row.contract_monday_id, profileItemId: null, title: "Payment method", body, localId: row.contract_local_id,
  }, tokenOptions, row.sent_by_oid);
}

/**
 * The signed copy (already in data/esign/) → the client's E-File (else consult folder), FEE Ks folder.
 * Background: the outcome becomes a note on the Fee K, so staff see where it
 * went — or that it needs filing by hand.
 */
function fileInEfile(
  db: DatabaseInstance,
  row: AgreementRow,
  documentName: string,
  tokenOptions: TokenFallbackOptions,
  audit: (action: string, metadata: Record<string, unknown>) => void,
): void {
  const running = fileSignedContract(row.id, documentName);
  if (!running) return;
  void running.then(async (r) => {
    audit("esign.efile", r.ok ? { filed: true, folder: r.folder, already: !!r.already } : { filed: false, reason: r.reason });
    if (r.ok && r.already) return;
    const body = r.ok
      ? `📁 Signed contract saved in the client's ${r.where === "Consult File" ? "consult folder (no E-File yet)" : "E-File"}: ${r.folder} / ${r.name}\n${r.webUrl}`
      : `⚠️ The signed contract could not be saved in the client's E-File or consult folder (${r.reason}). It is attached here — please file it by hand.`;
    await postNote(db, {
      feeKItemId: row.contract_monday_id, profileItemId: null,
      title: "Signed contract filed", body, localId: row.contract_local_id,
    }, tokenOptions, row.sent_by_oid);
  }).catch((err) => console.error("[esign] E-File filing failed:", err));
}

/** The send itself (signed-in staff). */
export function registerEsignRoutes(app: Express, deps: EsignDeps): void {
  const { db, mondayApiToken: MONDAY_API_TOKEN, writeTokenOptions } = deps;

  const mondayUser = makeMondayUserByLogin(MONDAY_API_TOKEN, usersDb);
  async function mondayUserIdOf(req: Request): Promise<string | null> {
    try {
      const hit = await mondayUser(String(req.user?.preferred_username ?? req.user?.email ?? ""), String(req.user?.name ?? ""));
      return hit ? String(hit.id) : null;
    } catch (err) {
      console.error("[esign] could not resolve the sender to a Monday user:", err);
      return null;
    }
  }

  app.get("/api/esign/status", requireAuth, (_req, res) => {
    const enabled = !!esignConfig() && !!MONDAY_API_TOKEN;
    res.json({ data: { enabled, scheduling: enabled && scheduledSendsOn() } });
  });

  app.post(
    "/api/contracts/:localId/esign",
    requireAuth,
    express.raw({ type: "application/pdf", limit: MAX_PDF_BYTES }),
    async (req, res) => {
      const config = esignConfig();
      if (!config || !MONDAY_API_TOKEN) {
        res.status(503).json({ error: "Sending for signature is not set up on this server" });
        return;
      }
      const schedule = req.query.schedule === "1";
      if (schedule && !scheduledSendsOn()) {
        res.status(503).json({ error: "Scheduled sending is not turned on on this server" });
        return;
      }
      const pdf = req.body as unknown;
      if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
        res.status(400).json({ error: "Send the contract PDF as the request body" });
        return;
      }
      const attorneyEmail = String(req.query.attorneyEmail ?? "").trim();
      const clientEmail = String(req.query.clientEmail ?? "").trim();
      if (!EMAIL_RE.test(attorneyEmail) || !EMAIL_RE.test(clientEmail)) {
        res.status(400).json({ error: "The attorney's and the client's e-mail are both needed" });
        return;
      }
      if (attorneyEmail.toLowerCase() === clientEmail.toLowerCase()) {
        res.status(400).json({ error: "The attorney and the client need different e-mails" });
        return;
      }
      const documentName = safeFileName(String(req.query.documentName ?? "")).replace(/^contract$/, "") || null;
      const localId = String(req.params.localId);
      const contract = db.prepare(`
        SELECT c.monday_item_id AS mondayId, COALESCE(p.name, c.name) AS clientName, p.monday_item_id AS profileMondayId
          FROM contracts c LEFT JOIN profiles p ON p.local_id = c.profile_local_id
         WHERE c.local_id = ? AND c.deleted_at IS NULL
      `).get(localId) as { mondayId: string | null; clientName: string; profileMondayId: string | null } | undefined;
      if (!contract) {
        res.status(404).json({ error: "Contract not found" });
        return;
      }
      if (!contract.mondayId) {
        res.status(400).json({ error: "This contract has not synced to Monday yet — try again after the next sync" });
        return;
      }
      const open = db.prepare(
        `SELECT id, status, send_on FROM esign_agreements WHERE contract_monday_id = ? AND status IN (${OPEN_STATUSES.map(() => "?").join(",")}, 'scheduled')`,
      ).get(contract.mondayId, ...OPEN_STATUSES) as { id: number; status: string; send_on: string | null } | undefined;
      if (open) {
        res.status(409).json({
          error: open.status === "scheduled"
            ? `This contract is already scheduled to send${open.send_on ? ` (Send Fee K By ${open.send_on})` : ""}. Cancel the scheduled send first.`
            : "This contract is already out for signature in Adobe Sign. Recall it in Adobe first to send a new one.",
        });
        return;
      }

      // Scheduling: the date and the stage come from Monday as it is now.
      let live: LiveFeeK | null = null;
      if (schedule) {
        try {
          live = (await readLiveFeeKs([contract.mondayId])).get(contract.mondayId) ?? null;
        } catch (err) {
          console.error("[esign] reading the Fee K for a scheduled send failed:", err);
        }
        const refusal = scheduleRejection(live, firmToday())
          ?? (live && !CONTRACT_STEPS.sent_for_signature.from.includes(live.stage?.trim() || null)
            ? `Can't schedule from the "${live.stage}" stage`
            : null);
        if (refusal) {
          res.status(live ? 409 : 502).json({ error: refusal });
          return;
        }
      }

      const token = randomBytes(24).toString("base64url");
      fs.mkdirSync(path.join(DATA_DIR, ESIGN_DIR), { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, ESIGN_DIR, `${token}.pdf`), pdf, { mode: 0o600 });
      const senderName = req.user?.name ?? null;
      const id = Number(db.prepare(`
        INSERT INTO esign_agreements
          (contract_local_id, contract_monday_id, profile_monday_id, client_name, client_email, attorney_email, file_token, status,
           sent_by_oid, sent_by_name, sent_by_monday_id, document_name, send_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        localId, contract.mondayId, contract.profileMondayId, contract.clientName, clientEmail, attorneyEmail, token,
        schedule ? "scheduled" : "sending", req.user?.oid ?? null, senderName, await mondayUserIdOf(req),
        documentName, live?.sendBy ?? null,
      ).lastInsertRowid);

      if (schedule && live?.sendBy) {
        const stageMoved = await setScheduledStage(db, localId, contract.mondayId, live.stage, writeTokenOptions(req), req.user?.oid ?? null);
        await postNote(db, {
          feeKItemId: contract.mondayId, profileItemId: contract.profileMondayId,
          title: "Contract scheduled for signature",
          body: `🗓 Contract prepared by ${senderName ?? "staff"} and scheduled: it goes to Adobe Sign on ${sendDateLabel(live.sendBy)} `
            + `(the Send Fee K By date), attorney (${attorneyEmail}) first, then the client (${clientEmail}). `
            + "If the date moves in Calendaring, it sends on the new date. Moving the Contract Stage off SCHEDULED cancels it.",
          localId,
        }, writeTokenOptions(req), req.user?.oid ?? null);
        auditFromReq(req, "esign.scheduled", {
          targetType: "contract", targetId: localId, targetMondayId: contract.mondayId,
          metadata: { agreement: id, sendOn: live.sendBy, stageMoved },
        });
        res.json({ data: { id, scheduled: true, sendOn: live.sendBy, stage: SCHEDULED_STAGE, warning: null } });
        return;
      }

      try {
        await callZap1(config, { id, file_token: token, client_name: contract.clientName, client_email: clientEmail, attorney_email: attorneyEmail }, documentName);
        db.prepare("UPDATE esign_agreements SET sent_at = datetime('now') WHERE id = ?").run(id);
      } catch (err) {
        console.error("[esign] Zapier hook failed:", err);
        db.prepare("UPDATE esign_agreements SET status = 'send_failed', last_error = ?, updated_at = datetime('now') WHERE id = ?")
          .run(err instanceof Error ? err.message.slice(0, 500) : "error", id);
        res.status(502).json({ error: "Zapier did not take the contract — nothing was sent. Try again in a minute." });
        return;
      }

      // Zapier has it. The stage move can be refused (someone moved it by
      // hand) without undoing the send.
      const step = await executeContractStep(db, localId, { step: "sent_for_signature" }, {
        tokenOptions: writeTokenOptions(req), authorOid: req.user?.oid ?? null,
        audit: (action, opts) => auditFromReq(req, action, opts),
      });
      await postNote(db, {
        feeKItemId: contract.mondayId, profileItemId: contract.profileMondayId,
        title: "Contract sent for signature",
        body: `📝 Contract sent for signature in Adobe Sign by ${senderName ?? "staff"}: attorney (${attorneyEmail}) first, then the client (${clientEmail}).`,
        localId,
      }, writeTokenOptions(req), req.user?.oid ?? null);
      auditFromReq(req, "esign.sent", {
        targetType: "contract", targetId: localId, targetMondayId: contract.mondayId,
        metadata: { agreement: id, stageMoved: step.ok },
      });
      res.json({
        data: {
          id, stage: step.ok ? step.data.stage : null,
          warning: step.ok ? null : `Sent, but the Contract Stage was not changed: ${String(step.body.error)}`,
        },
      });
    },
  );

  // M22 shows a waiting scheduled send, and can cancel it.
  app.get("/api/contracts/:localId/esign/scheduled", requireAuth, (req, res) => {
    const row = scheduledRowOf(db, String(req.params.localId));
    res.json({
      data: row
        ? { id: row.id, sendOn: row.send_on, by: row.sent_by_name, at: row.created_at, attorneyEmail: row.attorney_email, clientEmail: row.client_email, lastError: row.last_error }
        : null,
    });
  });

  app.delete("/api/contracts/:localId/esign/scheduled", requireAuth, async (req, res) => {
    const row = scheduledRowOf(db, String(req.params.localId));
    if (!row) {
      res.status(404).json({ error: "No scheduled send for this contract" });
      return;
    }
    cancelScheduled(db, row, `canceled by ${req.user?.name ?? "staff"}`);
    await postNote(db, {
      feeKItemId: row.contract_monday_id, profileItemId: null, title: "Scheduled contract canceled",
      body: `🗓 Scheduled contract canceled by ${req.user?.name ?? "staff"} — it was not sent. The Contract Stage is unchanged.`,
      localId: row.contract_local_id,
    }, writeTokenOptions(req), req.user?.oid ?? null);
    auditFromReq(req, "esign.schedule_canceled", {
      targetType: "contract", targetId: row.contract_local_id, targetMondayId: row.contract_monday_id, metadata: { agreement: row.id },
    });
    res.json({ data: { canceled: true } });
  });
}

function firmToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FIRM_TIMEZONE });
}

/** Zap 1: hand the stored PDF to Adobe Sign. Throws when Zapier doesn't take it. */
async function callZap1(
  config: EsignConfig,
  row: Pick<AgreementRow, "id" | "file_token" | "client_name" | "client_email" | "attorney_email">,
  documentName: string | null,
): Promise<void> {
  const agreementName = agreementNameOf(documentName, row.client_name, row.id);
  const fileBase = safeFileName(documentName ?? agreementName);
  const hook = await fetch(config.hookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `CP-${row.id}`,
      agreementName,
      pdfUrl: `${config.publicUrl}/api/esign/files/${row.file_token}/${encodeURIComponent(fileBase)}.pdf`,
      fileName: `${fileBase}.pdf`,
      attorneyEmail: row.attorney_email,
      clientEmail: row.client_email,
      clientName: row.client_name,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!hook.ok) throw new Error(`Zapier answered ${hook.status}`);
}

/** Fee Ks as Monday has them now: stage + "Send Fee K By:". Absent / archived = not in the map. */
async function readLiveFeeKs(ids: string[]): Promise<Map<string, LiveFeeK>> {
  const { fetchItemsByIds } = await import("@case-pipeline/monday");
  const out = new Map<string, LiveFeeK>();
  for (const item of await fetchItemsByIds(ids)) {
    if (item.state && item.state !== "active") continue;
    const col = (id: string) => item.column_values.find((c) => c.id === id);
    out.set(String(item.id), {
      stage: col(FEE_K_COLUMN_IDS.contractStage.id)?.text?.trim() || null,
      sendBy: parseSendBy(col(SEND_BY_COLUMN)?.display_value ?? col(SEND_BY_COLUMN)?.text),
    });
  }
  return out;
}

type ScheduledRow = AgreementRow & { last_error: string | null };

function scheduledRowOf(db: DatabaseInstance, localId: string): ScheduledRow | undefined {
  return db.prepare("SELECT * FROM esign_agreements WHERE contract_local_id = ? AND status = 'scheduled' ORDER BY id DESC LIMIT 1")
    .get(localId) as ScheduledRow | undefined;
}

function cancelScheduled(db: DatabaseInstance, row: Pick<AgreementRow, "id" | "file_token">, reason: string): void {
  db.prepare("UPDATE esign_agreements SET status = 'canceled', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(reason.slice(0, 500), row.id);
  fs.rmSync(path.join(DATA_DIR, ESIGN_DIR, `${row.file_token}.pdf`), { force: true });
}

/** Stage → SCHEDULED (unless it already is), on the same rails as a contract step: direct, else queued; local copy updated. */
async function setScheduledStage(
  db: DatabaseInstance,
  localId: string,
  mondayId: string,
  current: string | null,
  tokenOptions: TokenFallbackOptions,
  authorOid: string | null,
): Promise<boolean> {
  if (current?.trim() === SCHEDULED_STAGE) return false;
  const boardId = getBoardColumnsFor(db, "fee_ks")?.mondayBoardId;
  if (!boardId) return false;
  const columnId = FEE_K_COLUMN_IDS.contractStage.id;
  const value = { label: SCHEDULED_STAGE };
  try {
    await withTokenFallback((token) => dataSource.setColumnValues(boardId, mondayId, { [columnId]: value }, token), tokenOptions);
  } catch (err) {
    console.error("[esign] SCHEDULED stage write failed; queueing:", err);
    enqueueWrite(db, {
      opType: "change_column_json", targetTable: "contracts", targetLocalId: localId, mondayItemId: mondayId, authorOid,
      payload: { boardId, columnId, value },
    });
  }
  db.prepare(`UPDATE contracts SET raw_column_values = json_set(COALESCE(raw_column_values, '{}'), '$.${FEE_K_COLUMN_IDS.contractStage.key}', json(?)) WHERE local_id = ?`)
    .run(JSON.stringify(value), localId);
  return true;
}

export interface ScheduledRunResult {
  sent: number;
  waiting: number;
  canceled: number;
  reminded: number;
  failed: { agreement: number; error: string }[];
}

export interface ScheduledRunOptions {
  /** Fee Ks as Monday has them now (tests pass their own). */
  read?: (ids: string[]) => Promise<Map<string, LiveFeeK>>;
  /** Zap 1 (tests pass their own). */
  send?: typeof callZap1;
  today?: string;
}

/**
 * One run of the scheduled-send job (server.ts, every 15 minutes): send the
 * scheduled contracts whose date has come, cancel the ones taken off SCHEDULED,
 * and remind once on a SCHEDULED Fee K whose date came with nothing prepared.
 * Rules: esign/scheduled.ts.
 */
export async function runScheduledEsign(
  db: DatabaseInstance,
  sharedToken: string | undefined,
  opts: ScheduledRunOptions = {},
): Promise<ScheduledRunResult> {
  const result: ScheduledRunResult = { sent: 0, waiting: 0, canceled: 0, reminded: 0, failed: [] };
  const config = esignConfig();
  if (!config) return result;
  const today = opts.today ?? firmToday();
  const read = opts.read ?? readLiveFeeKs;
  const send = opts.send ?? callZap1;

  const scheduled = db.prepare("SELECT * FROM esign_agreements WHERE status = 'scheduled' ORDER BY id").all() as ScheduledRow[];
  // SCHEDULED on Monday (as of the last sync) with nothing prepared here.
  const unprepared = db.prepare(`
    SELECT c.monday_item_id AS mondayId, c.local_id AS localId
      FROM contracts c
     WHERE c.deleted_at IS NULL AND c.monday_item_id IS NOT NULL
       AND json_extract(c.raw_column_values, '$.${FEE_K_COLUMN_IDS.contractStage.key}.label') = ?
       AND NOT EXISTS (SELECT 1 FROM esign_agreements e WHERE e.contract_monday_id = c.monday_item_id AND e.status = 'scheduled')
  `).all(SCHEDULED_STAGE) as { mondayId: string; localId: string }[];
  if (!scheduled.length && !unprepared.length) return result;

  // One Monday read for all of them. An outage throws here, so nothing is canceled on a failed read.
  const live = await read([...scheduled.map((r) => r.contract_monday_id), ...unprepared.map((u) => u.mondayId)]);
  const shared: TokenFallbackOptions = { userToken: null, sharedToken };
  const audit = (action: string, target: { localId: string; mondayId: string }, metadata: Record<string, unknown>) =>
    recordAudit({
      actor: { userId: null, email: "system:esign-scheduled" }, action,
      targetType: "contract", targetId: target.localId, targetMondayId: target.mondayId, metadata,
    });

  for (const row of scheduled) {
    const fee = live.get(row.contract_monday_id) ?? null;
    const plan = planScheduledSend(fee, today);
    const target = { localId: row.contract_local_id, mondayId: row.contract_monday_id };
    if (plan.action === "wait") {
      result.waiting++;
      continue;
    }
    if (plan.action === "cancel") {
      cancelScheduled(db, row, plan.reason);
      result.canceled++;
      audit("esign.schedule_canceled", target, { agreement: row.id, reason: plan.reason });
      if (fee) {
        await postNote(db, {
          feeKItemId: row.contract_monday_id, profileItemId: null, title: "Scheduled contract canceled",
          body: `🗓 The scheduled contract was not sent: ${plan.reason}. To send it, open Generate contract again.`,
          localId: row.contract_local_id,
        }, senderTokenOptions(row, sharedToken), row.sent_by_oid);
      }
      continue;
    }
    if (!fs.existsSync(path.join(DATA_DIR, ESIGN_DIR, `${row.file_token}.pdf`))) {
      cancelScheduled(db, row, "the prepared PDF is missing on the server");
      result.failed.push({ agreement: row.id, error: "prepared PDF missing" });
      await postNote(db, {
        feeKItemId: row.contract_monday_id, profileItemId: null, title: "Scheduled contract not sent",
        body: "⚠️ The scheduled contract could not be sent: the prepared PDF is missing. Open Generate contract and send it again.",
        localId: row.contract_local_id,
      }, shared, null);
      continue;
    }
    try {
      await send(config, row, row.document_name);
    } catch (err) {
      // Stays scheduled: the next run tries again.
      const message = err instanceof Error ? err.message.slice(0, 500) : "error";
      db.prepare("UPDATE esign_agreements SET last_error = ?, updated_at = datetime('now') WHERE id = ?").run(message, row.id);
      result.failed.push({ agreement: row.id, error: message });
      continue;
    }
    db.prepare("UPDATE esign_agreements SET status = 'sending', sent_at = datetime('now'), last_error = NULL, updated_at = datetime('now') WHERE id = ?").run(row.id);
    result.sent++;
    const tokenOptions = senderTokenOptions(row, sharedToken);
    const step = await executeContractStep(db, row.contract_local_id, { step: "sent_for_signature" }, {
      tokenOptions, authorOid: row.sent_by_oid,
      audit: (action, o) => recordAudit({ actor: { userId: null, email: "system:esign-scheduled" }, action, ...o }),
    });
    await postNote(db, {
      feeKItemId: row.contract_monday_id, profileItemId: row.profile_monday_id,
      title: "Contract sent for signature",
      body: `📝 Scheduled contract sent for signature in Adobe Sign (Send Fee K By ${sendDateLabel(plan.sendBy)}; prepared by ${row.sent_by_name ?? "staff"}): `
        + `attorney (${row.attorney_email}) first, then the client (${row.client_email}).`,
      localId: row.contract_local_id,
    }, tokenOptions, row.sent_by_oid);
    audit("esign.sent", target, { agreement: row.id, scheduled: true, sendBy: plan.sendBy, stageMoved: step.ok });
  }

  for (const u of unprepared) {
    const due = needsReminder(live.get(u.mondayId) ?? null, today);
    if (!due) continue;
    const fresh = db.prepare("INSERT OR IGNORE INTO esign_schedule_reminders (contract_monday_id, send_on) VALUES (?, ?)").run(u.mondayId, due).changes;
    if (!fresh) continue;
    result.reminded++;
    await postNote(db, {
      feeKItemId: u.mondayId, profileItemId: null, title: "Scheduled contract not prepared",
      body: `🗓 This Fee K's Send Fee K By date ${due === today ? "is today" : `was ${sendDateLabel(due)}`}, but no contract is scheduled in the app, so nothing was sent. `
        + "Contracts → ⋯ → Generate contract → Preview → Send for signature (or Send on scheduled date).",
      localId: u.localId,
    }, shared, null);
    audit("esign.schedule_reminder", { localId: u.localId, mondayId: u.mondayId }, { sendOn: due });
  }
  return result;
}
