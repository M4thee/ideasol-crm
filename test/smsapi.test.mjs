import assert from "node:assert/strict";
import test from "node:test";

import {
  canSendAutomaticSmsToRecipient,
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  resolveSmsDelivery,
} from "../lib/smsapi.ts";

test("usuwa polskie znaki z treści SMS", () => {
  assert.equal(
    removePolishDiacritics("ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż"),
    "ACELNOSZZ acelnoszz"
  );
  assert.equal(
    removePolishDiacritics("Montaże u klienta Łukasz Żółć. 12\u00a0500 PLN"),
    "Montaze u klienta Lukasz Zolc. 12 500 PLN"
  );
});

test("normalizuje wyłącznie poprawne polskie numery", () => {
  assert.equal(normalizePolishPhoneNumber("500 600 700"), "48500600700");
  assert.equal(normalizePolishPhoneNumber("+48 500-600-700"), "48500600700");
  assert.equal(normalizePolishPhoneNumber("12345"), "");
  assert.equal(normalizePolishPhoneNumber("+49 500 600 700"), "");
});

test("tryb produkcyjny zachowuje numer odbiorcy", () => {
  assert.deepEqual(resolveSmsDelivery("500600700", {}), {
    intendedRecipientPhone: "48500600700",
    actualRecipientPhone: "48500600700",
    testMode: false,
  });
});

test("tryb testowy zawsze kieruje wiadomość na numer testowy", () => {
  assert.deepEqual(
    resolveSmsDelivery("500600700", {
      SMS_TEST_MODE: "true",
      SMS_TEST_PHONE: "600700800",
    }),
    {
      intendedRecipientPhone: "48500600700",
      actualRecipientPhone: "48600700800",
      testMode: true,
    }
  );
});

test("automatyczne SMS-y w trybie testowym przechodzą tylko dla klienta testowego", () => {
  const environment = {
    SMS_TEST_MODE: "true",
    SMS_TEST_PHONE: "600700800",
  };

  assert.equal(canSendAutomaticSmsToRecipient("600700800", environment), true);
  assert.equal(canSendAutomaticSmsToRecipient("500600700", environment), false);
});

test("tryb testowy bez poprawnego numeru kończy się bezpiecznym błędem", () => {
  assert.throws(
    () => resolveSmsDelivery("500600700", { SMS_TEST_MODE: "true" }),
    /SMS_TEST_PHONE/
  );
});
