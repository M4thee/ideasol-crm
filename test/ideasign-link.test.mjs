import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canExchangeIdeaSignLink,
  getIdeaSignAccessExpiresAt,
  signerStatusAfterOpening,
} from "../lib/ideasign/link.ts";

const now = Date.parse("2026-10-13T15:00:00.000Z");
const activeLink = {
  signerStatus: "uwierzytelniony",
  signerLinkExpiresAt: "2026-10-20T15:00:00.000Z",
  sessionStatus: "częściowo_podpisana",
  sessionExpiresAt: "2026-10-20T15:00:00.000Z",
  now,
};

test("aktywny link IdeaSign można wymieniać wielokrotnie przez 7 dni", () => {
  assert.equal(canExchangeIdeaSignLink(activeLink), true);
  assert.equal(canExchangeIdeaSignLink(activeLink), true);
});

test("ponowne otwarcie nie obniża statusu podpisującego", () => {
  assert.equal(signerStatusAfterOpening("oczekuje"), "otwarty");
  assert.equal(signerStatusAfterOpening("uwierzytelniony"), "uwierzytelniony");
});

test("link przestaje działać po podpisaniu, zakończeniu procesu lub wygaśnięciu", () => {
  assert.equal(canExchangeIdeaSignLink({ ...activeLink, signerStatus: "podpisany" }), false);
  assert.equal(canExchangeIdeaSignLink({ ...activeLink, sessionStatus: "anulowana" }), false);
  assert.equal(canExchangeIdeaSignLink({
    ...activeLink,
    signerLinkExpiresAt: "2026-10-13T14:59:59.000Z",
  }), false);
});

test("krótka sesja dostępu nie wykracza poza ważność linku", () => {
  assert.equal(
    getIdeaSignAccessExpiresAt({
      signerLinkExpiresAt: "2026-10-13T16:00:00.000Z",
      sessionExpiresAt: "2026-10-20T15:00:00.000Z",
      accessTtlSeconds: 8 * 60 * 60,
      now,
    }),
    "2026-10-13T16:00:00.000Z"
  );
});

test("wymiana linku nie wymaga już pustego znacznika pierwszego użycia", async () => {
  const source = await readFile(
    new URL("../lib/ideasign/server.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /signer\.link_consumed_at\s*\|\|\s*isExpired/);
  assert.doesNotMatch(source, /\.is\("link_consumed_at",\s*null\)/);
  assert.match(source, /reused:\s*Boolean\(signer\.link_consumed_at\)/);
});
