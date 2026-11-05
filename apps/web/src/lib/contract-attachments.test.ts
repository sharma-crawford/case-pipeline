import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendPdf, contractInvolvesBond } from "./contract-attachments";

const none = { feeKTypes: [], motionName: "" };

describe("contractInvolvesBond", () => {
  it("is true for a bond template, Fee K Type or motion", () => {
    expect(contractInvolvesBond("BOND MOTION + MASTER HEARING.docx", none)).toBe(true);
    expect(contractInvolvesBond("COURT.docx", { feeKTypes: ["Emergency Bond MTN (c)"], motionName: "" })).toBe(true);
    expect(contractInvolvesBond("MASTER HEARING + MOTION.docx", { feeKTypes: [], motionName: "Motion for Bond" })).toBe(true);
  });

  it("is false otherwise", () => {
    expect(contractInvolvesBond("FORMS.docx", { feeKTypes: ["I-130 (c)", "Bona fide evidence"], motionName: "" })).toBe(false);
    expect(contractInvolvesBond("Bondurant.docx", none)).toBe(false);
  });
});

async function pdfOf(pages: number): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([100 + i, 100]);
  return new Blob([(await doc.save()) as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}

describe("appendPdf", () => {
  it("puts the extra pages after the contract's, in order", async () => {
    const out = await PDFDocument.load(await (await appendPdf(await pdfOf(2), await pdfOf(3))).arrayBuffer());
    expect(out.getPageCount()).toBe(5);
    expect(out.getPages().map((p) => p.getWidth())).toEqual([100, 101, 100, 101, 102]);
  });
});
