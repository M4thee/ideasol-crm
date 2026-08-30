import assert from "node:assert/strict";
import test from "node:test";

import {
  areIdeaSignPhonesEqual,
  formatIdeaSignPolishPhone,
  normalizeIdeaSignPolishPhone,
} from "../lib/ideasign/phone.ts";

test("IdeaSign normalizuje polski numer niezależnie od prefiksu i formatowania", () => {
  assert.equal(normalizeIdeaSignPolishPhone("501234567"), "48501234567");
  assert.equal(normalizeIdeaSignPolishPhone("+48 501 234 567"), "48501234567");
  assert.equal(normalizeIdeaSignPolishPhone("0048 501-234-567"), "48501234567");
  assert.equal(formatIdeaSignPolishPhone("501234567"), "+48 501 234 567");
});

test("IdeaSign wykrywa ten sam telefon zapisany z prefiksem i bez niego", () => {
  assert.equal(areIdeaSignPhonesEqual("+48 501234567", "501 234 567"), true);
  assert.equal(areIdeaSignPhonesEqual("+48 501234567", "+48 601234567"), false);
  assert.equal(areIdeaSignPhonesEqual("", ""), false);
});

test("IdeaSign odrzuca numery spoza obsługiwanego polskiego formatu", () => {
  assert.equal(normalizeIdeaSignPolishPhone("+49 501 234 567"), "");
  assert.equal(normalizeIdeaSignPolishPhone("12345"), "");
});
