import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function extractPageText(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();

  return content.items
    .map((item) => item.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

test("bazowy szablon umowy zawiera 5-letnią gwarancję IdeaSol", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("../public/templates/contract.pdf", import.meta.url))
  );
  const pdf = await getDocument({
    data: bytes,
    disableWorker: true,
    standardFontDataUrl: new URL(
      "../node_modules/pdfjs-dist/standard_fonts/",
      import.meta.url
    ).pathname,
  }).promise;

  assert.equal(pdf.numPages, 17);

  const agreementPage = await extractPageText(pdf, 5);
  const warrantyAttachmentPage = await extractPageText(pdf, 10);

  assert.match(agreementPage, /Wykonawca udziela/);
  assert.match(
    agreementPage,
    /5-letniej gwarancji na jakość wykonanych prac montażowych/
  );
  assert.match(
    warrantyAttachmentPage,
    /Gwarancja jakości wykonania obowiązuje przez 5 lat od dnia odbioru Instalacji/
  );
  assert.doesNotMatch(agreementPage, /24-miesięcznej gwarancji/);
  assert.doesNotMatch(warrantyAttachmentPage, /obowiązuje przez 24 miesiące/);
});
