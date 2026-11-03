import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import { createDriveClient } from "./drive-client.js";

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = {
  client_email: "intake@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

/** A fetch that answers the token exchange, then each Drive call from `statuses` in turn. */
function fakeFetch(statuses: number[]) {
  const calls: number[] = [];
  const impl = (async (url: string) => {
    if (String(url).startsWith("https://oauth2.googleapis.com/")) {
      return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
    }
    const status = statuses[calls.length] ?? 200;
    calls.push(status);
    return status === 200
      ? new Response(JSON.stringify({ id: "f1", name: "a.pdf" }))
      : new Response('{"error":{"message":"Unknown Error."}}', { status });
  }) as typeof fetch;
  return { impl, calls };
}

const noWait = async () => {};

describe("Drive client retries", () => {
  test("a one-off 500 is retried", async () => {
    const f = fakeFetch([500, 200]);
    const drive = createDriveClient(key, f.impl, noWait);
    await expect(drive.get("f1")).resolves.toMatchObject({ id: "f1" });
    expect(f.calls).toEqual([500, 200]);
  });

  test("a 500 that keeps coming fails after 5 tries", async () => {
    const f = fakeFetch([500, 503, 500, 502, 500, 200]);
    const drive = createDriveClient(key, f.impl, noWait);
    await expect(drive.get("f1")).rejects.toThrow(/Drive 500/);
    expect(f.calls).toHaveLength(5);
  });

  test("a 404 is not retried", async () => {
    const f = fakeFetch([404, 200]);
    const drive = createDriveClient(key, f.impl, noWait);
    await expect(drive.get("f1")).rejects.toThrow(/Drive 404/);
    expect(f.calls).toEqual([404]);
  });
});
