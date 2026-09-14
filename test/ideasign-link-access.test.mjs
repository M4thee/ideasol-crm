import assert from "node:assert/strict";
import test from "node:test";

import { renderIdeaSignInvitationEmail } from "../lib/ideasign/email.ts";
import { canExchangeIdeaSignLink } from "../lib/ideasign/link-access.ts";

const NOW = Date.parse("2026-09-14T12:00:00.000Z");
const FUTURE = "2026-09-18T12:00:00.000Z";
const PAST = "2026-09-13T12:00:00.000Z";

function availability(overrides = {}) {
  return canExchangeIdeaSignLink({
    signerStatus: "oczekuje",
    signerExpiresAt: FUTURE,
    sessionStatus: "wysłana",
    sessionExpiresAt: FUTURE,
    nowMs: NOW,
    ...overrides,
  });
}

test("link IdeaSign można otwierać wielokrotnie przez 7 dni", () => {
  assert.equal(availability({ signerStatus: "oczekuje" }), true);
  assert.equal(availability({ signerStatus: "otwarty" }), true);
  assert.equal(availability({ signerStatus: "uwierzytelniony" }), true);
});

test("link IdeaSign przestaje działać po podpisie, anulowaniu lub zawarciu umowy", () => {
  assert.equal(availability({ signerStatus: "podpisany" }), false);
  assert.equal(availability({ sessionStatus: "anulowana" }), false);
  assert.equal(availability({ sessionStatus: "zawarta" }), false);
  assert.equal(availability({ sessionStatus: "wygasła" }), false);
});

test("link IdeaSign nie działa po upływie ważności podpisującego lub procesu", () => {
  assert.equal(availability({ signerExpiresAt: PAST }), false);
  assert.equal(availability({ sessionExpiresAt: PAST }), false);
  assert.equal(availability({ signerExpiresAt: "niepoprawna-data" }), false);
});

test("mail wyjaśnia wielokrotne użycie linku w ciągu 7 dni", () => {
  const html = renderIdeaSignInvitationEmail({
    signerName: "Jan Kowalski",
    contractNumber: "IS/1/2026",
    signUrl: "https://sign.ideasol.pl/#token=test",
  });

  assert.match(html, /Możesz wracać do procesu tym samym linkiem przez 7 dni/);
  assert.match(html, /Indywidualny link przypisany wyłącznie do Ciebie/);
  assert.doesNotMatch(html, /Jednorazowy link/);
});
