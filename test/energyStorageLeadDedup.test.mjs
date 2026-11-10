import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/public/energy-storage-lead/route.ts"),
  "utf8"
);

test("kalkulator magazynu korzysta ze wspólnej deduplikacji leadów WWW", () => {
  assert.match(route, /findExistingExternalLead/);
  assert.match(route, /ingestExternalLead/);
  assert.match(route, /source:\s*"www"/);
  assert.match(route, /note:\s*buildAnalysisNote\(payload\)/);
  assert.doesNotMatch(route, /findRecentLeadByPhone/);
});

test("ponowne zgłoszenie nie uruchamia ponownego przydziału doradcy", () => {
  assert.match(route, /integration\s*&&\s*!existingClient/);
  assert.match(route, /assignedUserId:\s*assignedUser\?\.id\s*\|\|\s*null/);
});

test("metadane kalkulatora są ustawiane wyłącznie dla nowej karty", () => {
  assert.match(route, /if\s*\(!ingestedLead\.duplicate\)/);
  assert.match(route, /lead_source:\s*"kalkulatorME"/);
  assert.match(route, /contact_phone:\s*phone/);
});
