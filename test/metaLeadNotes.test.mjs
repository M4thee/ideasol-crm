import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMetaLeadNote,
  formatMetaAnswerLabel,
  formatMetaAnswerValue,
} from "../lib/metaLeadNotes.ts";

test("buduje czytelną notatkę dla formularza ARiMR", () => {
  const note = buildMetaLeadNote({
    campaignName: "ARiMR 2026 | Sadownicy | 65% wsparcia",
    answers: [
      {
        label:
          "czy_prowadzisz_gospodarstwo_rolne_lub_sadownicze_i_spełniasz_warunek_dopłat_arimr?",
        value:
          "tak_—_płatność_obszarową_lub_podstawowe_wsparcie_dochodów_przyznano_mi",
      },
      {
        label: "czy_obecnie_posiadasz_instalację_fotowoltaiczną?",
        value: "nie",
      },
      {
        label: "ile_wynoszą_roczne_rachunki_za_prąd_w_twoim_gospodarstwie?",
        value: "do_10_000_zł",
      },
    ],
  });

  assert.equal(
    note,
    [
      "Nowy lead z Meta Ads",
      "Kampania: ARiMR 2026 | Sadownicy | 65% wsparcia",
      "",
      "Odpowiedzi z formularza:",
      "• Kwalifikacja do programu ARiMR: Tak — płatność obszarową lub podstawowe wsparcie dochodów przyznano mi",
      "• Instalacja fotowoltaiczna: Nie",
      "• Roczne rachunki za prąd: Do 10 000 zł",
    ].join("\n")
  );
});

test("czytelnie formatuje pytania z kampanii magazynów energii", () => {
  assert.equal(formatMetaAnswerLabel("jakiej_mocy_magazynu_szukasz?"), "Szukana pojemność magazynu");
  assert.equal(formatMetaAnswerValue("30_kWh"), "30 kWh");
  assert.equal(
    formatMetaAnswerLabel("jeżeli_oferta_ci_się_spodoba,_jak_szybko_planujesz_dokonać_zakupu?"),
    "Planowany termin zakupu"
  );
});

test("nowe pytania bez mapowania nadal są czytelne", () => {
  assert.equal(
    formatMetaAnswerLabel("jaki_jest_preferowany_termin_kontaktu?"),
    "Jaki jest preferowany termin kontaktu"
  );
  assert.equal(formatMetaAnswerValue("po_godzinie_16:00"), "Po godzinie 16:00");
  assert.equal(formatMetaAnswerValue("yes"), "Tak");
});
