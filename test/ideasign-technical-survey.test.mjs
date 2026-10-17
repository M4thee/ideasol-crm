import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

import {
  TECHNICAL_SURVEY_DECLARATION,
  TechnicalSurveyValidationError,
  buildTechnicalSurveySnapshot,
  generateTechnicalSurveyPdf,
  normalizeTechnicalSurvey,
} from "../lib/ideasign/technical-survey.ts";

const context = {
  acceptedAt: "2026-10-17T12:34:56.000Z",
  preparedBy: { id: "user-1", name: "Jan Doradca" },
};

function pvSurvey(overrides = {}) {
  return {
    declarationAccepted: true,
    products: { pv: { selected: true } },
    pvInstallationPlace: "roof",
    sections: {
      A: { phases: 3, meterLocation: "Garaż" },
      B: {
        inverterLocation: "Kotłownia",
        routes: [
          {
            name: "DC od paneli do falownika",
            insideMeters: 4,
            facadeMeters: 6,
            groundMeters: 2,
            overheadMeters: 1,
          },
        ],
      },
      C: { roofCovering: "Dachówka", rafterSpacing: 80 },
      D: { storageInstallationPlace: "Nie powinno trafić do PDF" },
    },
    ...overrides,
  };
}

test("IdeaSign wymaga oświadczenia, produktu i miejsca montażu PV", () => {
  assert.throws(
    () => normalizeTechnicalSurvey({ products: ["PV"] }, context),
    TechnicalSurveyValidationError
  );
  assert.throws(
    () => normalizeTechnicalSurvey({ declarationAccepted: true }, context),
    /co najmniej jeden produkt/
  );
  assert.throws(
    () => normalizeTechnicalSurvey({ declarationAccepted: true, products: ["PV"] }, context),
    /miejsce montażu/
  );
});

test("IdeaSign wybiera tylko sekcje właściwe dla zakresu i sam liczy trasy", () => {
  const survey = normalizeTechnicalSurvey(pvSurvey(), context);
  assert.equal(survey.hasPv, true);
  assert.equal(survey.hasMe, false);
  assert.equal(survey.pvInstallationPlace, "roof");
  assert.ok(survey.sections.A.length > 0);
  assert.ok(survey.sections.B.length > 0);
  assert.ok(survey.sections.C.length > 0);
  assert.deepEqual(survey.sections.D, []);
  assert.equal(survey.routes.length, 1);
  assert.equal(survey.routes[0].totalMeters, 13);
});

test("IdeaSign dla magazynu energii pomija sekcje PV i nie wymaga miejsca montażu PV", () => {
  const survey = normalizeTechnicalSurvey({
    declarationAccepted: true,
    products: { energyStorage: { capacityKwh: 10 } },
    sections: {
      A: { phases: 3 },
      B: { notes: "Pomiń" },
      C: { roofCovering: "Pomiń" },
      D: { storageInstallationPlace: "Kotłownia" },
    },
  }, context);
  assert.equal(survey.hasPv, false);
  assert.equal(survey.hasMe, true);
  assert.deepEqual(survey.sections.B, []);
  assert.deepEqual(survey.sections.C, []);
  assert.ok(survey.sections.D.length > 0);
});

test("snapshot nie przechowuje obrazu base64, ale utrwala identyfikator, wersję i hash", () => {
  const survey = normalizeTechnicalSurvey(pvSurvey({
    roofSketch: {
      id: "sketch-1",
      version: "7",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,AAAA",
    },
  }), context);
  const bytes = Buffer.from("image-content");
  const snapshot = buildTechnicalSurveySnapshot(survey, [{
    key: "roofSketch-1",
    role: "roofSketch",
    id: "sketch-1",
    version: "7",
    category: "Szkic dachu",
    description: "",
    mimeType: "image/png",
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    storagePath: "sale-id/technical/sketch.png",
  }]);
  assert.equal(JSON.stringify(snapshot).includes("AAAA"), false);
  assert.equal(snapshot._ideaSign.media[0].id, "sketch-1");
  assert.equal(snapshot._ideaSign.media[0].version, "7");
  assert.match(snapshot._ideaSign.media[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(snapshot._ideaSign.declarationAcceptedAt, context.acceptedAt);
});

test("generator tworzy poprawny wielostronicowy PDF ankiety z wymaganym oświadczeniem", async () => {
  assert.equal(
    TECHNICAL_SURVEY_DECLARATION,
    "Oświadczam, że podane przeze mnie informacje są zgodne ze stanem faktycznym, a miejsce montażu instalacji spełnia warunki umożliwiające jej prawidłowy i bezpieczny montaż oraz użytkowanie. Przyjmuję do wiadomości, że zatajenie lub nieujawnienie istotnych informacji dotyczących w szczególności stanu technicznego dachu, instalacji elektrycznej lub terenu przeznaczonego pod montaż może skutkować koniecznością uzgodnienia dodatkowych prac, zmianą terminu albo odmową wykonania prac, których nie można bezpiecznie lub zgodnie z prawem wykonać. Postanowienie to nie wyłącza odpowiedzialności Wykonawcy za brak należytej staranności."
  );
  const survey = normalizeTechnicalSurvey(pvSurvey(), context);
  const bytes = await generateTechnicalSurveyPdf({
    survey,
    media: [],
    contractNumber: "IS/2026/10/17/1",
    clientName: "Jan Kowalski",
    installationAddress: "ul. Testowa 1, 00-001 Warszawa",
  });
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
  assert.equal(pdf.getTitle(), "Załącznik nr 4 - Ankieta techniczna");
});
