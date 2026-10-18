import assert from "node:assert/strict";
import test from "node:test";

import {
  TECHNICAL_SURVEY_DECLARATION,
  createTechnicalSurveyForSale,
  normalizeTechnicalSurvey,
  technicalSurveyRouteTotal,
  validateTechnicalSurveyForSigning,
} from "../lib/technicalSurvey.ts";

test("normalizuje payload ankiety wysyłany przez aplikację natywną", () => {
  const survey = normalizeTechnicalSurvey({
    clientName: "Jan Kowalski",
    installationAddress: "Warszawa",
    auditDate: "2026-10-17T12:00:00Z",
    scopes: ["Fotowoltaika – dach", "Magazyn energii"],
    text: { pv_dc_a: "4", pv_dc_c: "6" },
    choices: {
      products: ["PV", "ME"],
      pv_location: ["Dach"],
    },
    photoChecklist: ["Lokalizacja licznika"],
    declarationAccepted: true,
    declarationText: TECHNICAL_SURVEY_DECLARATION,
    sketchData: "",
  });

  assert.deepEqual(survey.choices.products, ["PV", "ME"]);
  assert.equal(survey.declarationAccepted, true);
  assert.equal(survey.photoChecklist[0], "Lokalizacja licznika");
  assert.equal(technicalSurveyRouteTotal(survey, "pv_dc"), 10);
});
test("zdjęcia nie są wymagane do podpisania umowy", () => {
  const survey = normalizeTechnicalSurvey({
    choices: { products: ["PV"], pv_location: ["Dach"] },
    photoChecklist: [],
    declarationAccepted: true,
  });

  assert.deepEqual(validateTechnicalSurveyForSigning(survey), []);
});

test("wymaga zakresu, miejsca montażu PV i oświadczenia", () => {
  const empty = normalizeTechnicalSurvey({});
  assert.equal(validateTechnicalSurveyForSigning(empty).length, 2);

  const pvWithoutLocation = normalizeTechnicalSurvey({
    choices: { products: ["PV"] },
    declarationAccepted: true,
  });
  assert.deepEqual(validateTechnicalSurveyForSigning(pvWithoutLocation), [
    "Wybierz miejsce montażu instalacji PV: dach albo grunt.",
  ]);
});

test("uzupełnia zakres i dach z zapisanej oferty", () => {
  const survey = createTechnicalSurveyForSale(
    {
      offer_snapshot: {
        offer_type: "pv_storage",
        offer_data: { form: { roofType: "dachowka" } },
      },
    },
    null,
    {
      clientName: "Anna Nowak",
      contractNumber: "IS/2026/101",
      osdOperator: "pge",
    }
  );

  assert.deepEqual(survey.choices.products, ["PV", "ME"]);
  assert.deepEqual(survey.choices.pv_location, ["Dach"]);
  assert.equal(survey.text.roof_type_from_offer, "Dachówka");
  assert.equal(survey.text.osd_operator, "pge");
});
