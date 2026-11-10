import assert from "node:assert/strict";
import test from "node:test";

import {
  findExistingExternalLead,
  normalizeLeadEmail,
  normalizeLeadPhone,
} from "../lib/externalLeadDedup.ts";

test("normalizuje polskie formaty telefonu do wspólnego klucza", () => {
  const expected = "501234567";
  assert.equal(normalizeLeadPhone("+48 501 234 567"), expected);
  assert.equal(normalizeLeadPhone("0048-501-234-567"), expected);
  assert.equal(normalizeLeadPhone("501234567"), expected);
});

test("odrzuca zbyt krótki telefon i normalizuje e-mail pomocniczy", () => {
  assert.equal(normalizeLeadPhone("12345"), null);
  assert.equal(normalizeLeadEmail("  KLIENT@Example.COM "), "klient@example.com");
  assert.equal(normalizeLeadEmail("  "), null);
});

test("poprawny telefon ma pierwszeństwo i nie uruchamia zapasowego dopasowania po e-mailu", async () => {
  const equalityFilters = [];
  let queryCount = 0;
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      equalityFilters.push([column, value]);
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return Promise.resolve({ data: [], error: null });
    },
  };
  const supabase = {
    from() {
      queryCount += 1;
      return query;
    },
  };

  const match = await findExistingExternalLead(supabase, {
    businessArea: "ideasol",
    phone: "+48 501 234 567",
    email: "shared@example.com",
  });

  assert.equal(match, null);
  assert.equal(queryCount, 1);
  assert.deepEqual(equalityFilters, [
    ["business_area", "ideasol"],
    ["phone_dedup_key", "501234567"],
  ]);
});
