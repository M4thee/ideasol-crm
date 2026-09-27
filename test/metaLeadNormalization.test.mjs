import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMetaLead } from "../lib/metaLeadNormalization.ts";

test("mapuje pola używane przez formularz kampanii 8 kWp", () => {
  const lead = normalizeMetaLead([
    { name: "phone", values: ["+48 600 000 000"] },
    { name: "email", values: [" KLIENT@EXAMPLE.COM "] },
    { name: "post_code", values: ["43300"] },
    { name: "czy_masz_już_fotowoltaikę?", values: ["nie"] },
  ]);

  assert.equal(lead.email, "klient@example.com");
  assert.equal(lead.phone, "+48 600 000 000");
  assert.equal(lead.postalCode, "43-300");
  assert.equal(lead.fullName, null);
  assert.deepEqual(lead.extraAnswers, [
    { label: "czy_masz_już_fotowoltaikę?", value: "nie" },
  ]);
});

test("łączy osobne pola imienia i nazwiska", () => {
  const lead = normalizeMetaLead([
    { name: "first_name", values: ["Anna"] },
    { name: "last_name", values: ["Nowak"] },
  ]);

  assert.equal(lead.fullName, "Anna Nowak");
  assert.deepEqual(lead.extraAnswers, []);
});

test("uwzględnia mapowanie pól ustawione dla integracji", () => {
  const lead = normalizeMetaLead(
    [
      { name: "podaj_swoje_dane", values: ["Jan Kowalski"] },
      { name: "mail_kontaktowy", values: ["jan@example.com"] },
    ],
    {
      fullName: ["podaj_swoje_dane"],
      email: ["mail_kontaktowy"],
    }
  );

  assert.equal(lead.fullName, "Jan Kowalski");
  assert.equal(lead.email, "jan@example.com");
  assert.deepEqual(lead.extraAnswers, []);
});

test("stare mapowanie integracji nie wyłącza nowszych aliasów Meta", () => {
  const lead = normalizeMetaLead(
    [
      { name: "name", values: ["Maria Zielińska"] },
      { name: "email_address", values: ["maria@example.com"] },
    ],
    {
      fullName: ["full_name", "imie_i_nazwisko"],
      email: ["email"],
    }
  );

  assert.equal(lead.fullName, "Maria Zielińska");
  assert.equal(lead.email, "maria@example.com");
  assert.deepEqual(lead.extraAnswers, []);
});

test("rozpoznaje opisowe polskie pole imienia i nazwiska", () => {
  const lead = normalizeMetaLead([
    { name: "Podaj proszę swoje imię i nazwisko", values: ["Piotr Wiśniewski"] },
    { name: "czy_posiadasz_instalację_pv?", values: ["Tak"] },
  ]);

  assert.equal(lead.fullName, "Piotr Wiśniewski");
  assert.deepEqual(lead.extraAnswers, [
    { label: "czy_posiadasz_instalację_pv?", value: "Tak" },
  ]);
});

test("rozpoznaje opisowe osobne pola imienia i nazwiska", () => {
  const lead = normalizeMetaLead([
    { name: "Twoje imię", values: ["Adam"] },
    { name: "Nazwisko klienta", values: ["Kowalski"] },
  ]);

  assert.equal(lead.fullName, "Adam Kowalski");
  assert.deepEqual(lead.extraAnswers, []);
});
