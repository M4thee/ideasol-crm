import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMetaLeadNote,
  formatMetaAnswerLabel,
  formatMetaAnswerValue,
} from "../lib/metaLeadNotes.ts";

test("IdeaTermo zapisuje polskie pytania i wszystkie wybrane prace bez kluczy Meta", () => {
  const note = buildMetaLeadNote({
    campaignName: "IdeaTermo | 01 Lokalny wykonawca | 11.2026",
    answers: [
      {
        label: "czy_chcesz_skorzystac_z_termomodernizacji_w_ramach_programu_czyste_powietrze?",
        value: "yes",
      },
      {
        label: "jaki_zakres_prac_cie_interesuje?",
        value: "docieplenie, wymiana_stolarki_okiennej, wymiana_drzwi_zewnetrznych, wymiana_nieekologicznego_zrodla_ciepla",
      },
      {
        label: "czy_posiadasz_juz_zaswiadczenie_o_wysokosci_dochodu_wymagane_do_programu?",
        value: "jestem_w_trakcie_pozyskiwania",
      },
    ],
  });
  assert.equal(note, [
    "Nowy lead z Meta Ads",
    "Kampania: IdeaTermo | 01 Lokalny wykonawca | 11.2026",
    "",
    "Odpowiedzi z formularza:",
    "• Czy chcesz skorzystać z termomodernizacji w ramach programu Czyste Powietrze: Tak",
    "• Jaki zakres prac Cię interesuje: Docieplenie, Wymiana stolarki okiennej, Wymiana drzwi zewnętrznych, Wymiana nieekologicznego źródła ciepła",
    "• Czy posiadasz już zaświadczenie o wysokości dochodu wymagane do programu: Jestem w trakcie pozyskiwania",
  ].join("\n"));
  assert.doesNotMatch(note, /_/);
});

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
