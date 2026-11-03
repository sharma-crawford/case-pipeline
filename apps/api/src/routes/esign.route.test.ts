// =============================================================================
// Adobe Sign via Zapier — end to end with Monday mocked at the dataSource seam
// =============================================================================
// The event rules are in esign/events.test.ts. This drives the real routes:
// send → Zap 1 gets the PDF link → "sent" → attorney signs → client signs, and
// checks the stage writes, notes and notification that actually go out.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import { initializeSchema } from "@case-pipeline/seed/db/schema";

type Call = { op: string; [k: string]: unknown };
let calls: Call[] = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "esign-test-"));

vi.mock("../paths.js", () => ({ DATA_DIR: tmp, REPO_ROOT: tmp }));
const efile = vi.hoisted(() => ({ calls: [] as [number, string][], result: { ok: true, folder: "FEE Ks", name: "x.pdf", webUrl: "https://sp/x" } as Record<string, unknown> }));
vi.mock("../esign/efile.js", () => ({
  fileSignedContract: (id: number, name: string) => {
    efile.calls.push([id, name]);
    return Promise.resolve(efile.result);
  },
}));
vi.mock("../data-source/index.js", () => ({
  dataSource: {
    postUpdate: async (itemId: string, body: string) => {
      calls.push({ op: "update", itemId, body });
      return "u1";
    },
    createTimelineItem: async (input: { itemId: string; title: string; customActivityId: string; content: string }) => {
      calls.push({ op: "activity", ...input });
      return "t1";
    },
    setColumnValues: async (_boardId: string, itemId: string, values: Record<string, unknown>) => {
      calls.push({ op: "columns", itemId, values });
    },
    addFile: async (itemId: string, columnId: string, fileName: string) => {
      calls.push({ op: "file", itemId, columnId, fileName });
      return "asset-1";
    },
  },
}));
vi.mock("../db/users-db.js", async () => ({ usersDb: (await import("../staff/test-db.js")).makeRosterDb() }));
vi.mock("../auth/middleware.js", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { user: unknown }).user = { oid: "oid-1", name: "Ana Reyes", preferred_username: "ana@firm.com" };
    next();
  },
}));
vi.mock("../audit/log.js", () => ({ auditFromReq: () => {}, recordAudit: () => {} }));
vi.mock("./monday-oauth.js", () => ({ getUserMondayToken: () => null, markMondayTokenRejected: () => {} }));
vi.mock("@case-pipeline/monday", async (orig) => ({
  ...(await orig<typeof import("@case-pipeline/monday")>()),
  fetchWorkspaceUsers: async () => [{ id: "42", name: "Ana Reyes", email: "ana@firm.com" }],
  createNotification: async (userId: string, itemId: string, text: string) => {
    calls.push({ op: "notify", userId, itemId, text });
  },
  // The Fee Ks as Monday has them now (scheduled sends): stage + the "Send Fee K By:" mirror.
  fetchItemsByIds: async (ids: string[]) =>
    ids.filter((id) => mondayNow.items[id]).map((id) => ({
      id, name: "Fee K", state: "active",
      column_values: [
        { id: "deal_stage", text: mondayNow.items[id]!.stage },
        { id: "lookup_mm55y7zr", text: null, display_value: mondayNow.items[id]!.sendBy ?? "" },
      ],
    })),
}));
const mondayNow = vi.hoisted(() => ({ items: {} as Record<string, { stage: string; sendBy: string | null }> }));

const { registerEsignRoutes, registerEsignPublicRoutes, runScheduledEsign } = await import("./esign.js");

const STAGES = ["Needs to be sent", "Atty Reviewing", "Sent to Client", "Needs Payment Link", "SCHEDULED - fee k to be sent"];
let db: Database.Database;
let server: Server;
let zapier: Server;
let base: string;
let hookBodies: Record<string, string>[] = [];

beforeEach(async () => {
  calls = [];
  hookBodies = [];
  db = new Database(":memory:");
  initializeSchema(db);
  db.prepare("INSERT INTO seed_batches (id, batch_name) VALUES (1, 'test')").run();
  db.prepare("INSERT INTO profiles (batch_id, local_id, monday_item_id, name) VALUES (1, 'p1', '111', 'Ana Pérez')").run();
  db.prepare(
    `INSERT INTO contracts (batch_id, local_id, monday_item_id, profile_local_id, name, raw_column_values)
     VALUES (1, 'c1', '555', 'p1', 'Fee K', ?)`,
  ).run(JSON.stringify({ contract_stage: { label: "Needs to be sent" } }));
  const col = db.prepare(
    "INSERT INTO board_columns (board_key, monday_board_id, column_id, title, type, options, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  col.run("fee_ks", "B-FK", "deal_stage", "Contract Stage", "status", JSON.stringify(STAGES.map((label, index) => ({ index, label }))), 0);
  col.run("fee_ks", "B-FK", "date1__1", "Contract Sent On", "date", null, 1);
  col.run("fee_ks", "B-FK", "date8__1", "Signed Contract Received On", "date", null, 2);

  const hook = express();
  hook.use(express.json());
  hook.post("/hook", (req, res) => { hookBodies.push(req.body as Record<string, string>); res.json({ status: "success" }); });
  zapier = hook.listen(0);

  const app = express();
  app.use(express.json());
  const deps = { db, mondayApiToken: "shared", writeTokenOptions: () => ({ sharedToken: "shared" }) as never };
  registerEsignPublicRoutes(app, deps);
  registerEsignRoutes(app, deps);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ZAPIER_ESIGN_HOOK_URL = `http://127.0.0.1:${(zapier.address() as AddressInfo).port}/hook`;
  process.env.ZAPIER_ESIGN_SECRET = "s3cret";
  process.env.API_URL = base;
  delete process.env.SLACK_WEBHOOK_URL;
});
afterEach(() => {
  server.close();
  zapier.close();
  db.close();
});

const send = (q = "attorneyEmail=atty@firm.com&clientEmail=ana@mail.com") =>
  fetch(`${base}/api/contracts/c1/esign?${q}`, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: "%PDF-1.4 test" });
const event = async (body: Record<string, unknown>, secret = "s3cret") => {
  const res = await fetch(`${base}/api/webhooks/zapier/${secret}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};
const stage = () =>
  (db.prepare("SELECT json_extract(raw_column_values, '$.contract_stage.label') AS s FROM contracts WHERE local_id = 'c1'").get() as { s: string }).s;

describe("Adobe Sign via Zapier", () => {
  it("sends, follows both signatures, and notifies the sender", async () => {
    const r = await send();
    expect(r.status).toBe(200);
    expect(stage()).toBe("Atty Reviewing");
    expect(hookBodies).toHaveLength(1);
    const hook = hookBodies[0]!;
    expect(hook).toMatchObject({ ref: "CP-1", attorneyEmail: "atty@firm.com", clientEmail: "ana@mail.com", agreementName: "Fee K - Ana Pérez [CP-1]" });
    expect(calls.find((c) => c.op === "update")?.body).toContain("Ana Reyes");
    // …and on the client's profile timeline (E&A), as a Contract note.
    expect(calls.find((c) => c.op === "activity")).toMatchObject({ itemId: "111", title: "Contract sent for signature" });

    // Zap 1 downloads the PDF from the private link.
    const pdf = await fetch(hook.pdfUrl!);
    expect(pdf.status).toBe(200);
    expect(await pdf.text()).toBe("%PDF-1.4 test");

    // A second send while it's out is refused.
    expect((await send()).status).toBe(409);

    expect((await event({ event: "sent", ref: "CP-1", agreementId: "A1" })).json).toMatchObject({ applied: true, status: "out_for_signature" });

    calls = [];
    await event({ event: "AGREEMENT_ACTION_COMPLETED", agreementId: "A1", participantEmail: "atty@firm.com" });
    expect(stage()).toBe("Sent to Client");
    expect(calls.find((c) => c.op === "columns")?.values).toMatchObject({ deal_stage: { label: "Sent to Client" }, date1__1: { date: expect.any(String) } });

    calls = [];
    // The client's own signature event changes nothing; completion does.
    expect((await event({ event: "AGREEMENT_ACTION_COMPLETED", agreementId: "A1", participantEmail: "ana@mail.com" })).json.applied).toBe(false);
    await event({ event: "AGREEMENT_WORKFLOW_COMPLETED", agreementName: "Fee K - Ana Pérez [CP-1]" });
    expect(stage()).toBe("Needs Payment Link");
    expect(calls.filter((c) => c.op === "activity").map((c) => c.title)).toEqual(["Contract signed"]);
    expect(calls.find((c) => c.op === "notify")).toMatchObject({ userId: "42", itemId: "555" });

    // Zapier retries are harmless.
    calls = [];
    expect((await event({ event: "AGREEMENT_WORKFLOW_COMPLETED", agreementId: "A1" })).json.applied).toBe(false);
    expect(calls).toEqual([]);
  });

  it("rejected: note + notification, stage left alone, and a new send is allowed", async () => {
    await send();
    calls = [];
    const r = await event({ event: "AGREEMENT_REJECTED", ref: "CP-1" });
    expect(r.json).toMatchObject({ applied: true, status: "rejected" });
    expect(stage()).toBe("Atty Reviewing");
    expect(calls.map((c) => c.op).sort()).toEqual(["activity", "notify", "update"]);
    expect(calls.find((c) => c.op === "activity")).toMatchObject({ itemId: "111", title: "Contract rejected" });
    expect(String(calls.find((c) => c.op === "update")?.body)).toContain("rejected");
  });

  it("refuses a wrong secret and ignores agreements it didn't send", async () => {
    expect((await event({ event: "sent" }, "nope")).status).toBe(401);
    expect((await event({ event: "AGREEMENT_WORKFLOW_COMPLETED", agreementId: "unknown" })).json).toMatchObject({ ignored: "no matching contract" });
  });

  it("nothing is sent when Zapier refuses, and the PDF link is dead for unknown tokens", async () => {
    process.env.ZAPIER_ESIGN_HOOK_URL = `${base}/nowhere`;
    const r = await send();
    expect(r.status).toBe(502);
    expect(stage()).toBe("Needs to be sent");
    expect((await fetch(`${base}/api/esign/files/${"x".repeat(32)}/a.pdf`)).status).toBe(404);
  });

  it("names it Client - Matter - date, and files the signed copy in the E-File", async () => {
    const r = await send(`attorneyEmail=atty@firm.com&clientEmail=ana@mail.com&documentName=${encodeURIComponent("Ana Pérez - I-212 - 10-15-2026")}`);
    expect(r.status).toBe(200);
    expect(hookBodies[0]).toMatchObject({ agreementName: "Ana Pérez - I-212 - 10-15-2026 [CP-1]", fileName: "Ana Pérez - I-212 - 10-15-2026.pdf" });
    expect(hookBodies[0]!.pdfUrl).toMatch(/\/Ana%20P%C3%A9rez%20-%20I-212%20-%2010-15-2026\.pdf$/);

    // Zap 3's signed copy: fetched from Adobe's https link.
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
      String(input) === "https://adobe.test/signed.pdf" ? Promise.resolve(new Response("%PDF-signed")) : realFetch(input, init));
    calls = [];
    efile.calls = [];
    const ev = await event({ event: "signed_pdf", agreementName: "10-15-26 - I-212 Contract - A. PÉREZ [CP-1]", pdfUrl: "https://adobe.test/signed.pdf" });
    spy.mockRestore();
    // (This test board has no file column, so the Monday attach is skipped; the copy is kept.)
    expect(ev.json).toMatchObject({ saved: true });
    expect(efile.calls).toEqual([[1, "10-15-26 - SIGNED I-212 Contract - A. PÉREZ"]]);
    await vi.waitFor(() => expect(String(calls.find((c) => c.op === "update")?.body)).toContain("E-File: FEE Ks / x.pdf"));
  });

  it("the client's Credit / Debit / Cash pick fills an empty Payment Method, once, and tells staff", async () => {
    await send();
    await event({ event: "sent", ref: "CP-1", agreementId: "A1" });
    calls = [];
    await event({ event: "AGREEMENT_WORKFLOW_COMPLETED", agreementId: "A1", formData: JSON.stringify({ PayMethod: "Credit" }) });
    expect(calls.find((c) => c.op === "columns" && (c.values as Record<string, unknown>).dropdown_mm7v5eeb)).toMatchObject({
      itemId: "555", values: { dropdown_mm7v5eeb: { labels: ["CREDIT Card - Surcharge Applies"] } },
    });
    expect(calls.filter((c) => c.op === "update").map((c) => String(c.body)).join("\n")).toContain("chose to pay by credit card. Payment links are ready");
    const local = db.prepare("SELECT json_extract(raw_column_values, '$.payment_method.labels[0]') AS m FROM contracts WHERE local_id = 'c1'").get() as { m: string };
    expect(local.m).toBe("CREDIT Card - Surcharge Applies");

    // Zap 3 repeats it with the signed copy: nothing new.
    calls = [];
    await event({ event: "AGREEMENT_WORKFLOW_COMPLETED", agreementId: "A1", formData: { PayMethod: "Credit" } });
    expect(calls.filter((c) => c.op === "columns" || c.op === "update")).toEqual([]);
  });

  it("a Payment Method staff already set stays; the note flags the difference", async () => {
    db.prepare("UPDATE contracts SET raw_column_values = json_set(raw_column_values, '$.payment_method', json(?)) WHERE local_id = 'c1'")
      .run(JSON.stringify({ labels: ["SPLIT PAYMENTS"] }));
    await send();
    calls = [];
    await event({ event: "AGREEMENT_REJECTED", ref: "CP-1", formData: "PayMethod\nCash" });
    expect(calls.find((c) => c.op === "columns" && (c.values as Record<string, unknown>).dropdown_mm7v5eeb)).toBeUndefined();
    expect(calls.map((c) => String(c.body ?? "")).join("\n")).toContain('says "SPLIT PAYMENTS" — left as it is');
  });

  it("needs two different e-mails", async () => {
    expect((await send("attorneyEmail=atty@firm.com&clientEmail=")).status).toBe(400);
    expect((await send("attorneyEmail=a@b.com&clientEmail=A@b.com")).status).toBe(400);
  });
});

describe("Scheduled sends (Send on scheduled date)", () => {
  const SCHEDULED = "SCHEDULED - fee k to be sent";
  const schedule = () => send("attorneyEmail=atty@firm.com&clientEmail=ana@mail.com&documentName=11-05-26%20-%20Contract%20-%20A.%20PEREZ&schedule=1");
  const row = () => db.prepare("SELECT status, send_on, sent_at, last_error FROM esign_agreements ORDER BY id DESC LIMIT 1").get() as
    { status: string; send_on: string | null; sent_at: string | null; last_error: string | null };
  const notes = () => calls.filter((c) => c.op === "update").map((c) => String(c.body)).join("\n");

  beforeEach(() => {
    process.env.ESIGN_SCHEDULED = "on";
    mondayNow.items = { "555": { stage: "Needs to be sent", sendBy: "2026-11-05" } };
  });
  afterEach(() => { delete process.env.ESIGN_SCHEDULED; });

  it("keeps the PDF, moves the stage to SCHEDULED, and sends nothing yet", async () => {
    const r = await schedule();
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: Record<string, unknown> }).data).toMatchObject({ scheduled: true, sendOn: "2026-11-05" });
    expect(hookBodies).toEqual([]);
    expect(row()).toMatchObject({ status: "scheduled", send_on: "2026-11-05", sent_at: null });
    expect(stage()).toBe(SCHEDULED);
    expect(calls.find((c) => c.op === "columns")).toMatchObject({ itemId: "555", values: { deal_stage: { label: SCHEDULED } } });
    expect(notes()).toContain("goes to Adobe Sign on Thursday, Nov 5");
    // Not served to Zapier before it is sent.
    const token = (db.prepare("SELECT file_token FROM esign_agreements").get() as { file_token: string }).file_token;
    expect((await fetch(`${base}/api/esign/files/${token}/x.pdf`)).status).toBe(404);
    // A second send (now or later) is refused while one waits.
    expect((await send()).status).toBe(409);
    expect((await schedule()).status).toBe(409);
  });

  it("refuses with no Send Fee K By date, a past one, or when the switch is off", async () => {
    mondayNow.items["555"]!.sendBy = null;
    expect((await schedule()).status).toBe(409);
    mondayNow.items["555"]!.sendBy = "2020-01-01";
    expect((await schedule()).status).toBe(409);
    delete process.env.ESIGN_SCHEDULED;
    mondayNow.items["555"]!.sendBy = "2099-01-01";
    expect((await schedule()).status).toBe(503);
    expect(db.prepare("SELECT COUNT(*) AS n FROM esign_agreements").get()).toEqual({ n: 0 });
  });

  it("waits until the date, then sends that PDF like Send for signature", async () => {
    await schedule();
    mondayNow.items["555"]!.stage = SCHEDULED;
    calls = [];

    let r = await runScheduledEsign(db, "shared", { today: "2026-11-04" });
    expect(r).toMatchObject({ sent: 0, waiting: 1 });
    expect(hookBodies).toEqual([]);

    // The date moved later in Calendaring: the live one counts.
    mondayNow.items["555"]!.sendBy = "2026-11-10";
    r = await runScheduledEsign(db, "shared", { today: "2026-11-05" });
    expect(r).toMatchObject({ sent: 0, waiting: 1 });

    r = await runScheduledEsign(db, "shared", { today: "2026-11-10" });
    expect(r).toMatchObject({ sent: 1, waiting: 0, failed: [] });
    expect(hookBodies).toHaveLength(1);
    expect(hookBodies[0]).toMatchObject({ ref: "CP-1", attorneyEmail: "atty@firm.com", clientEmail: "ana@mail.com", agreementName: "11-05-26 - Contract - A. PEREZ [CP-1]" });
    expect(row().status).toBe("sending");
    expect(row().sent_at).not.toBeNull();
    expect(stage()).toBe("Atty Reviewing");
    expect(notes()).toContain("Scheduled contract sent for signature");
    // Zap 1 can now download it.
    expect((await fetch(hookBodies[0]!.pdfUrl!)).status).toBe(200);

    // Nothing left to do on the next run.
    hookBodies = [];
    r = await runScheduledEsign(db, "shared", { today: "2026-11-10" });
    expect(r).toMatchObject({ sent: 0, waiting: 0 });
    expect(hookBodies).toEqual([]);
  });

  it("keeps it scheduled when Zapier refuses, and tries again", async () => {
    await schedule();
    mondayNow.items["555"]!.stage = SCHEDULED;
    const refuse = async () => { throw new Error("Zapier answered 500"); };
    const r = await runScheduledEsign(db, "shared", { today: "2026-11-05", send: refuse });
    expect(r.failed).toEqual([{ agreement: 1, error: "Zapier answered 500" }]);
    expect(row()).toMatchObject({ status: "scheduled", last_error: "Zapier answered 500" });
    expect((await runScheduledEsign(db, "shared", { today: "2026-11-05" })).sent).toBe(1);
  });

  it("cancels when the stage was moved off SCHEDULED by hand", async () => {
    await schedule();
    mondayNow.items["555"]!.stage = "Create to sign in office";
    calls = [];
    const r = await runScheduledEsign(db, "shared", { today: "2026-11-05" });
    expect(r).toMatchObject({ sent: 0, canceled: 1 });
    expect(hookBodies).toEqual([]);
    expect(row().status).toBe("canceled");
    expect(notes()).toContain('was not sent: the Contract Stage is now "Create to sign in office"');
  });

  it("does nothing when Monday can't be read", async () => {
    await schedule();
    const down = async () => { throw new Error("Monday is down"); };
    await expect(runScheduledEsign(db, "shared", { today: "2026-11-05", read: down })).rejects.toThrow("Monday is down");
    expect(row().status).toBe("scheduled");
  });

  it("M22 shows the waiting send and can cancel it", async () => {
    await schedule();
    const shown = (await (await fetch(`${base}/api/contracts/c1/esign/scheduled`)).json()) as { data: Record<string, unknown> };
    expect(shown.data).toMatchObject({ sendOn: "2026-11-05", by: "Ana Reyes" });
    expect((await fetch(`${base}/api/contracts/c1/esign/scheduled`, { method: "DELETE" })).status).toBe(200);
    expect(row().status).toBe("canceled");
    expect(((await (await fetch(`${base}/api/contracts/c1/esign/scheduled`)).json()) as { data: unknown }).data).toBeNull();
    // A canceled one no longer blocks a new send.
    expect((await send()).status).toBe(200);
  });

  it("notes once on a SCHEDULED Fee K whose date came with nothing prepared", async () => {
    db.prepare("UPDATE contracts SET raw_column_values = json_set(raw_column_values, '$.contract_stage', json(?)) WHERE local_id = 'c1'")
      .run(JSON.stringify({ label: SCHEDULED }));
    mondayNow.items["555"] = { stage: SCHEDULED, sendBy: "2026-11-05" };
    expect((await runScheduledEsign(db, "shared", { today: "2026-11-04" })).reminded).toBe(0);
    expect((await runScheduledEsign(db, "shared", { today: "2026-11-05" })).reminded).toBe(1);
    expect(notes()).toContain("Send Fee K By date is today, but no contract is scheduled in the app");
    expect((await runScheduledEsign(db, "shared", { today: "2026-11-06" })).reminded).toBe(0);
    expect(hookBodies).toEqual([]);
  });
});
