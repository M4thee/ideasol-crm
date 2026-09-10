import assert from "node:assert/strict";
import test from "node:test";

import { buildTeamsGeneralMetaLeadMessage } from "../lib/metaLeadGeneralNotification.ts";

test("buduje anonimowe podsumowanie nowego leada na czat ogólny", () => {
  const message = buildTeamsGeneralMetaLeadMessage({
    campaignName: "ARiMR 2026 | PV + magazyn | Rolnicy",
    adName: "ARiMR 2026 | Małopolska – Podhale/Orawa | Hodowcy",
    campaignLeadCount: 17,
  });

  assert.match(message, /ARiMR 2026 \| PV \+ magazyn \| Rolnicy/);
  assert.match(message, /Małopolska – Podhale\/Orawa \| Hodowcy/);
  assert.match(message, /Suma leadów z tej kampanii <strong>17<\/strong>/);
  assert.doesNotMatch(message, /Przypisano|Użytkownikowi|Klient:|crm\.ideasol\.pl/);
});

test("escapuje nazwy pochodzące z Meta", () => {
  const message = buildTeamsGeneralMetaLeadMessage({
    campaignName: "Kampania <test>",
    adName: "A & B",
    campaignLeadCount: null,
  });

  assert.match(message, /Kampania &lt;test&gt;/);
  assert.match(message, /A &amp; B/);
  assert.match(message, /Suma leadów z tej kampanii <strong>brak danych<\/strong>/);
});
