// =============================================================================
// Pages added after a generated contract (M22)
// =============================================================================
// A contract that involves a bond gets the firm's bond document list
// (SharePoint Fee Contracts/DOCLISTS/BOND.pdf) as its last pages, so the client
// signs and receives one PDF that says what to bring. "Involves a bond" = the
// template's file name, a picked Fee K Type or the picked motion says "bond".
// Only the PDF (preview, download, Adobe Sign) gets it: the Word download is
// the template alone.
// =============================================================================

import { PDFDocument } from "pdf-lib";

const BOND = /\bbond\b/i;

export function contractInvolvesBond(templateName: string, input: { feeKTypes: string[]; motionName: string }): boolean {
  return [templateName, input.motionName, ...input.feeKTypes].some((s) => BOND.test(s));
}

/** `main` followed by every page of `extra`, as one PDF. */
export async function appendPdf(main: Blob, extra: Blob): Promise<Blob> {
  const out = await PDFDocument.load(await main.arrayBuffer());
  const add = await PDFDocument.load(await extra.arrayBuffer(), { ignoreEncryption: true });
  for (const page of await out.copyPages(add, add.getPageIndices())) out.addPage(page);
  return new Blob([(await out.save()) as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}
