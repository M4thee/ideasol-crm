import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const webhook = fs.readFileSync(
  path.join(process.cwd(), "app/api/meta/webhook/route.ts"),
  "utf8"
);
const teams = fs.readFileSync(
  path.join(process.cwd(), "lib/microsoftTeams.ts"),
  "utf8"
);

test("webhook Meta nie wysyła licznika leadów na czat Ogólny", () => {
  assert.doesNotMatch(webhook, /countIntegrationLeads/);
  assert.doesNotMatch(webhook, /campaignLeadCount/);
  assert.doesNotMatch(webhook, /general-chat/);
  assert.doesNotMatch(teams, /sendTeamsGeneralMetaLeadNotification/);
});

test("pozostawia powiadomienia do doradcy i na czat operacyjny", () => {
  assert.match(webhook, /sendTeamsDirectMetaLeadNotification/);
  assert.match(webhook, /sendTeamsBoardMetaLeadNotification/);
});
