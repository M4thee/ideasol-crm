import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstallationReminderMessage,
  buildSaleSmsTemplates,
  getUnknownSmsTemplatePlaceholders,
} from "../lib/saleSms.ts";
import {
  isValidDateOnly,
  isValidTimeOnly,
  polishLocalDateTimeToIso,
} from "../lib/polishDateTime.ts";

const completeContext = {
  contractNumber: "IS/123/2026",
  depositAmount: 12_500,
  outstandingAmount: 47_321.5,
  installationDate: "2026-08-12",
  installationTime: "08:30",
  installerCompanyName: "Montaże PV Sp. z o.o.",
};

test("gotowe wiadomości zawierają wartości z umowy i poprawne saldo", () => {
  const templates = buildSaleSmsTemplates(completeContext);
  const deposit = templates.find((template) => template.type === "deposit_reminder");
  const reminder = templates.find((template) => template.type === "payment_reminder_1");
  const confirmation = templates.find(
    (template) => template.type === "installation_confirmation"
  );

  assert.equal(deposit?.enabled, true);
  assert.match(deposit?.message || "", /12[\s\u00a0]500,00 PLN/);
  assert.match(deposit?.message || "", /IS\/123\/2026/);
  assert.match(reminder?.message || "", /47[\s\u00a0]321,50 PLN/);
  assert.match(confirmation?.message || "", /12\.08\.2026/);
  assert.match(confirmation?.message || "", /08:30/);
  assert.match(confirmation?.message || "", /Montaże PV/);
});

test("ponaglenia są blokowane po pełnej zapłacie", () => {
  const templates = buildSaleSmsTemplates({ ...completeContext, outstandingAmount: 0 });

  for (const type of ["payment_reminder_1", "payment_reminder_2", "payment_demand"]) {
    const template = templates.find((item) => item.type === type);
    assert.equal(template?.enabled, false);
    assert.match(template?.reason || "", /nie ma dodatniego salda/i);
  }
});

test("potwierdzenie montażu wymaga daty, godziny i instalatora", () => {
  const templates = buildSaleSmsTemplates({ ...completeContext, installationTime: null });
  const confirmation = templates.find(
    (template) => template.type === "installation_confirmation"
  );

  assert.equal(confirmation?.enabled, false);
  assert.match(confirmation?.reason || "", /godziny montażu/i);
});

test("własny szablon uzupełnia pola z CRM i respektuje dodatkowe wymagania", () => {
  const [template] = buildSaleSmsTemplates(
    {
      ...completeContext,
      clientName: "Jan Kowalski",
      contractValue: 60_000,
      paidTotal: 12_678.5,
    },
    [
      {
        id: "custom-id",
        type: "custom_payment_status",
        title: "Stan płatności",
        messageTemplate:
          "Dzień dobry {{client_name}}. Wpłacono {{paid_total}} PLN, pozostało {{outstanding_amount}} PLN do umowy {{contract_number}}.",
        tone: "standard",
        requiredFields: ["outstanding_amount"],
      },
    ]
  );

  assert.equal(template.enabled, true);
  assert.equal(template.type, "custom_payment_status");
  assert.match(template.message, /Jan Kowalski/);
  assert.match(template.message, /12[\s\u00a0]678,50 PLN/);
  assert.match(template.message, /47[\s\u00a0]321,50 PLN/);
});

test("własny szablon jest blokowany, gdy brakuje danych użytych w treści", () => {
  const [template] = buildSaleSmsTemplates(
    { ...completeContext, clientName: null },
    [
      {
        type: "custom_greeting",
        title: "Powitanie",
        messageTemplate: "Dzień dobry {{client_name}}.",
        tone: "standard",
        requiredFields: [],
      },
    ]
  );

  assert.equal(template.enabled, false);
  assert.match(template.reason || "", /klienta/i);
});

test("szablon relacyjny działa bez sprzedaży i zachowuje kategorię", () => {
  const [template] = buildSaleSmsTemplates(
    {
      clientName: "Jan Kowalski",
      contractNumber: "",
      contractValue: null,
      depositAmount: null,
      paidTotal: null,
      outstandingAmount: null,
      installationDate: null,
      installationTime: null,
      installerCompanyName: null,
    },
    [
      {
        type: "custom_opinion",
        title: "Prośba o opinię",
        messageTemplate: "Dzień dobry {{client_name}}. Dziękujemy za współpracę.",
        tone: "standard",
        category: "relationship",
        requiredFields: [],
      },
    ]
  );

  assert.equal(template.enabled, true);
  assert.equal(template.category, "relationship");
  assert.match(template.message, /Jan Kowalski/);
});

test("walidacja wykrywa nieobsługiwane pola dynamiczne", () => {
  assert.deepEqual(
    getUnknownSmsTemplatePlaceholders("Umowa {{contract_number}}, pole {{nieznane_pole}}"),
    ["nieznane_pole"]
  );
});

test("automatyczne przypomnienie zawiera kontakt do instalatora", () => {
  const message = buildInstallationReminderMessage({
    contractNumber: "IS/123/2026",
    installerCompanyName: "Montaże PV",
    installerContactName: "Jan Kowalski",
    installerPhone: "500 600 700",
  });

  assert.match(message, /w dniu jutrzejszym/);
  assert.match(message, /IS\/123\/2026/);
  assert.match(message, /Montaże PV/);
  assert.match(message, /Jan Kowalski/);
  assert.match(message, /500 600 700/);
  assert.match(message, /41 202 02 38/);
});

test("termin montażu jest zapisywany jako prawidłowy czas Warszawy", () => {
  assert.equal(isValidDateOnly("2026-02-29"), false);
  assert.equal(isValidDateOnly("2028-02-29"), true);
  assert.equal(isValidTimeOnly("24:00"), false);
  assert.equal(isValidTimeOnly("08:30"), true);
  assert.equal(polishLocalDateTimeToIso("2026-08-12", "08:30"), "2026-08-12T06:30:00.000Z");
  assert.equal(polishLocalDateTimeToIso("2026-12-12", "08:30"), "2026-12-12T07:30:00.000Z");
});
