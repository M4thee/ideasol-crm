import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261110095420_merge_duplicates_keep_first_advisor.sql"
  ),
  "utf8"
);

test("scalanie wybiera pierwszego doradcę z całej grupy wspólnego kontaktu", () => {
  assert.match(migration, /c\.assigned_user_id is not null/);
  assert.match(migration, /c\.phone_dedup_key = v_shared_phone_key/);
  assert.match(migration, /order by c\.created_at asc nulls last, c\.id/);
  assert.doesNotMatch(migration, /Client advisors differ/);
});

test("scalanie zachowuje wymaganą notatkę i audytuje zmianę doradcy", () => {
  assert.match(migration, /Potencjalny dubel, scalono różne UID\./);
  assert.match(migration, /source_assigned_user_id/);
  assert.match(migration, /target_assigned_user_id_before/);
  assert.match(migration, /resolved_assigned_user_id/);
  assert.match(migration, /earliest_duplicate_card_with_assigned_advisor/);
});

test("scalanie odrzuca karty bez wspólnego znormalizowanego kontaktu", () => {
  assert.match(migration, /Clients do not share a normalized phone or email/);
  assert.match(migration, /Clients belong to different business areas/);
});
