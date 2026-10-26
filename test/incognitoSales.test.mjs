import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIncognitoContractBankParagraph,
  buildIncognitoCustomPaymentBankClause,
  buildSalePricingPreview,
  deriveIncognitoOwnersCount,
  IDEASOL_INCOGNITO_BANK_ACCOUNT,
  IDEASOL_INCOGNITO_BANK_NAME,
  shouldSendTeamsForSale,
} from "../lib/incognitoSales.ts";
import { buildSaleSmsTemplates } from "../lib/saleSms.ts";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

test("kalkulator incognito odejmuje dokładnie jedną marżę ownera", () => {
  assert.equal(deriveIncognitoOwnersCount(3), 2);
  assert.equal(deriveIncognitoOwnersCount(1), 0);
  assert.equal(deriveIncognitoOwnersCount(0), 0);
});

test("podgląd sprzedaży pokazuje cenę incognito zamiast ceny zwykłej", () => {
  const preview = buildSalePricingPreview({
    isIncognito: true,
    installationCount: 2,
    standardUnitNet: 50_000,
    standardUnitGross: 54_000,
    incognitoUnitNet: 48_000,
    incognitoUnitGross: 51_840,
  });

  assert.equal(preview.totalGross, 103_680);
  assert.equal(preview.standardTotalGross, 108_000);
  assert.equal(preview.savingsGross, 4_320);
  assert.equal(preview.usesIncognitoPricing, true);
});

test("powiadomienia Teams pozostają włączone tylko dla zwykłej sprzedaży", () => {
  assert.equal(shouldSendTeamsForSale(false), true);
  assert.equal(shouldSendTeamsForSale(true), false);
});

test("wiadomości płatnicze incognito używają odrębnego rachunku", () => {
  const [deposit] = buildSaleSmsTemplates({
    contractNumber: "01/01/2026/10/IS",
    depositAmount: 10_000,
    outstandingAmount: 40_000,
    installationDate: null,
    installationTime: null,
    installerCompanyName: null,
    isIncognito: true,
  });

  assert.match(deposit.message, new RegExp(IDEASOL_INCOGNITO_BANK_ACCOUNT));
  assert.equal(IDEASOL_INCOGNITO_BANK_NAME, "BNP Paribas Bank Polska S.A.");
});

test("umowa incognito używa rachunku BNP i nie zachowuje standardowego rachunku w szablonie", async () => {
  const paragraph = buildIncognitoContractBankParagraph();
  assert.match(paragraph, new RegExp(IDEASOL_INCOGNITO_BANK_ACCOUNT));
  assert.match(paragraph, new RegExp(IDEASOL_INCOGNITO_BANK_NAME.replaceAll(".", "\\.")));
  assert.match(
    buildIncognitoCustomPaymentBankClause(),
    new RegExp(IDEASOL_INCOGNITO_BANK_ACCOUNT)
  );

  const data = new Uint8Array(await readFile("public/templates/contract-incognito.pdf"));
  const pdf = await getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(4);
    const content = await page.getTextContent();
    const templateText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    assert.doesNotMatch(templateText, /mBank/);
    assert.doesNotMatch(templateText, /33 1140 2004 0000 3302 8689 3030/);
  } finally {
    await pdf.destroy();
  }
});
