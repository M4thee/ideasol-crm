export type MetaLeadAnswer = {
  label: string;
  value: string;
};

const SPECIAL_TERMS: Record<string, string> = {
  arimr: "ARiMR",
  pv: "PV",
  kw: "kW",
  kwh: "kWh",
  kwp: "kWp",
};

function normalizeLookupValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function restoreSpecialTerms(value: string) {
  return value
    .split(/(\s+)/)
    .map((part) => {
      const punctuationMatch = part.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}]+)([^\p{L}\p{N}]*)$/u);
      if (!punctuationMatch) return part;

      const [, prefix, word, suffix] = punctuationMatch;
      return `${prefix}${SPECIAL_TERMS[normalizeLookupValue(word)] ?? word}${suffix}`;
    })
    .join("");
}

function humanizeMetaText(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[_]+/g, " ")
    .replace(/\s*[—–]\s*/g, " — ")
    .replace(/\s+/g, " ")
    .replace(/[?:]+$/g, "")
    .trim();

  if (!normalized) return fallback;

  const withKnownTerms = restoreSpecialTerms(normalized);
  return `${withKnownTerms.charAt(0).toLocaleUpperCase("pl-PL")}${withKnownTerms.slice(1)}`;
}

export function formatMetaAnswerLabel(label: string) {
  const normalized = normalizeLookupValue(label);

  if (
    normalized.includes("czy_prowadzisz_gospodarstwo") &&
    (normalized.includes("doplat") || normalized.includes("arimr"))
  ) {
    return "Kwalifikacja do programu ARiMR";
  }

  if (
    normalized.includes("czy_obecnie_posiadasz_instalacje_fotowoltaiczna") ||
    normalized.includes("czy_masz_juz_fotowoltaike") ||
    normalized.includes("czy_posiadasz_instalacje_fotowoltaiczna")
  ) {
    return "Instalacja fotowoltaiczna";
  }

  if (normalized.includes("ile_wynosza_roczne_rachunki")) {
    return "Roczne rachunki za prąd";
  }

  if (normalized.includes("jakiej_mocy_magazynu")) {
    return "Szukana pojemność magazynu";
  }

  if (normalized.includes("jak_szybko") && normalized.includes("zakup")) {
    return "Planowany termin zakupu";
  }

  if (normalized.includes("roczne_zuzycie")) {
    return "Roczne zużycie energii";
  }

  if (normalized.includes("moc_instalacji")) {
    return "Planowana moc instalacji";
  }

  return humanizeMetaText(label, "Pole formularza");
}

export function formatMetaAnswerValue(value: string) {
  const normalized = normalizeLookupValue(value);

  if (normalized === "yes" || normalized === "true") return "Tak";
  if (normalized === "no" || normalized === "false") return "Nie";

  return humanizeMetaText(value, "Brak danych");
}

export function buildMetaLeadNote(params: {
  campaignName: string;
  answers: MetaLeadAnswer[];
}) {
  const lines = [
    "Nowy lead z Meta Ads",
    `Kampania: ${params.campaignName.trim() || "Nieznana kampania"}`,
  ];

  if (params.answers.length === 0) {
    return lines.join("\n");
  }

  lines.push(
    "",
    "Odpowiedzi z formularza:",
    ...params.answers.map(
      (answer) =>
        `• ${formatMetaAnswerLabel(answer.label)}: ${formatMetaAnswerValue(answer.value)}`
    )
  );

  return lines.join("\n");
}
