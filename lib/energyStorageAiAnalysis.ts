import { supabaseAdmin } from "@/lib/supabase/admin";

const AI_HELPER_EMAIL = "pomagier-ai@system.ideasol.pl";
const AI_NOTICE =
  "To jest analiza klienta wykonana przez Pomagiera AI 🤖\nSztuczna inteligencja bardzo pomaga, ale nie uprawnia do wyłączania tej wrodzonej. Pamiętaj o tym rozmawiając z klientem 🙂";
const AI_NOTE_PREFIX = "🤖 Pomagier AI — analiza leada";
const DEFAULT_MODEL = "gpt-5.6-luna";

type EnergyStorageAnswers = {
  hasPv?: "yes" | "no" | null;
  pvPower?: string | null;
  settlementSystem?: "net_billing" | "net_metering" | "unknown" | null;
  billMode?: "monthly" | "yearly";
  billAmount?: string;
  yearlyBill?: number;
  yearlyConsumptionKwh?: number;
  tariff?: string | null;
  priorities?: string[];
};

type TariffOptimization = {
  label?: string;
  strategy?: string;
  dailyBenefitMinimum?: number;
  dailyBenefitMaximum?: number;
  yearlyBenefitLow?: number;
  yearlyBenefitHigh?: number;
  shiftedEnergyMinimumPerActiveDayKwh?: number;
  shiftedEnergyPerActiveDayKwh?: number;
  activeDaysMinimumPerYear?: number;
  activeDaysPerYear?: number;
  isTimeOfUse?: boolean;
  includesWeekendVariant?: boolean;
};

type EnergyStorageResult = {
  recommendationType?: "recommended" | "consider" | "not_recommended";
  recommendationTitle?: string;
  recommendedStorageKwh?: number;
  gridPurchaseYearlyKwh?: number;
  gridPurchaseDailyKwh?: number;
  suggestedPvKw?: number | null;
  yearlySavingsLow?: number;
  yearlySavingsHigh?: number;
  energySourceSavingsLow?: number;
  energySourceSavingsHigh?: number;
  tariffOptimization?: TariffOptimization;
  alternativeTariffOptimization?: TariffOptimization;
  alternativeYearlySavingsLow?: number;
  alternativeYearlySavingsHigh?: number;
  alternativePaybackYearsLow?: number;
  alternativePaybackYearsHigh?: number;
  priceLow?: number;
  priceHigh?: number;
  subsidyEstimate?: number;
  paybackYearsLow?: number;
  paybackYearsHigh?: number;
  paybackYearsWithoutSubsidyLow?: number;
  paybackYearsWithoutSubsidyHigh?: number;
};

export type EnergyStorageAiInput = {
  answers?: EnergyStorageAnswers;
  result?: EnergyStorageResult;
};

type SalesAnalysis = {
  salesGoal: string;
  suggestedOpening: string;
  rationale: string[];
  visitChecks: string[];
  recommendation: string;
  cautions: string[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function recommendationLabel(type: EnergyStorageResult["recommendationType"]) {
  if (type === "recommended") return "🟢 REKOMENDOWANY";
  if (type === "not_recommended") return "🔴 NIE REKOMENDOWANY";
  return "🟡 WYMAGANA INDYWIDUALNA ANALIZA";
}

/**
 * Buduje wyłącznie techniczno-energetyczny profil leada. Dane kontaktowe nie są
 * częścią tego typu ani treści wysyłanej do OpenAI.
 */
export function buildSanitizedEnergyProfile(input: EnergyStorageAiInput) {
  const answers = input.answers ?? {};
  const result = input.result ?? {};

  return {
    calculator: "magazyny.ideasol.pl",
    pv: {
      hasPv: answers.hasPv ?? null,
      powerKwp: cleanString(answers.pvPower, 40) || null,
      settlementSystem: answers.settlementSystem ?? null,
    },
    energy: {
      billMode: answers.billMode ?? null,
      billAmountPln: cleanString(answers.billAmount, 40) || null,
      yearlyBillPln: finiteNumber(answers.yearlyBill),
      yearlyConsumptionKwh: finiteNumber(answers.yearlyConsumptionKwh),
      tariff: cleanString(answers.tariff, 40) || null,
      priorities: cleanStringArray(answers.priorities, 6),
      gridPurchaseYearlyKwh: finiteNumber(result.gridPurchaseYearlyKwh),
      gridPurchaseDailyKwh: finiteNumber(result.gridPurchaseDailyKwh),
    },
    deterministicCalculatorResult: {
      status: result.recommendationType ?? "consider",
      title: cleanString(result.recommendationTitle) || null,
      recommendedStorageKwh: finiteNumber(result.recommendedStorageKwh),
      suggestedPvKw: finiteNumber(result.suggestedPvKw),
      yearlySavingsPln: {
        low: finiteNumber(result.yearlySavingsLow),
        high: finiteNumber(result.yearlySavingsHigh),
      },
      energySourceSavingsPln: {
        low: finiteNumber(result.energySourceSavingsLow),
        high: finiteNumber(result.energySourceSavingsHigh),
      },
      currentTariff: result.tariffOptimization ?? null,
      alternativeTariff: result.alternativeTariffOptimization ?? null,
      alternativeYearlySavingsPln: {
        low: finiteNumber(result.alternativeYearlySavingsLow),
        high: finiteNumber(result.alternativeYearlySavingsHigh),
      },
      pricePln: {
        low: finiteNumber(result.priceLow),
        high: finiteNumber(result.priceHigh),
      },
      subsidyPln: finiteNumber(result.subsidyEstimate),
      paybackYears: {
        low: finiteNumber(result.paybackYearsLow),
        high: finiteNumber(result.paybackYearsHigh),
      },
      alternativePaybackYears: {
        low: finiteNumber(result.alternativePaybackYearsLow),
        high: finiteNumber(result.alternativePaybackYearsHigh),
      },
    },
  };
}

function extractOutputText(response: ResponsesApiResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .join("\n");
}

function parseSalesAnalysis(text: string): SalesAnalysis {
  const parsed = JSON.parse(text) as Partial<SalesAnalysis>;
  const analysis: SalesAnalysis = {
    salesGoal: cleanString(parsed.salesGoal),
    suggestedOpening: cleanString(parsed.suggestedOpening, 800),
    rationale: cleanStringArray(parsed.rationale, 4),
    visitChecks: cleanStringArray(parsed.visitChecks, 4),
    recommendation: cleanString(parsed.recommendation, 800),
    cautions: cleanStringArray(parsed.cautions, 2),
  };

  if (
    !analysis.salesGoal ||
    !analysis.suggestedOpening ||
    analysis.rationale.length < 2 ||
    !analysis.recommendation
  ) {
    throw new Error("OpenAI returned an incomplete sales analysis.");
  }

  return analysis;
}

export async function generateEnergyStorageSalesAnalysis(
  input: EnergyStorageAiInput,
  options?: { fetchImpl?: typeof fetch }
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const profile = buildSanitizedEnergyProfile(input);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ENERGY_STORAGE_MODEL?.trim() || DEFAULT_MODEL,
      store: false,
      max_output_tokens: 900,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: [
                "Jesteś Pomagierem AI w CRM IdeaSol. Tworzysz krótką notatkę dla handlowca po leadzie z kalkulatora magazynu energii.",
                "Najważniejszy cel: pomóc umówić wizytę i analizę na miejscu. Nie przerzucaj pracy na klienta i nie zalecaj jako głównego kroku wysyłania rachunku.",
                "Po umówieniu spotkania wskaż maksymalnie 4 konkretne rzeczy, które handlowiec ma sprawdzić na miejscu.",
                "Opieraj się wyłącznie na przekazanych danych i wyniku kalkulatora. Nie zmieniaj jego statusu, kwot ani pojemności. Nie dopowiadaj cen, dotacji, taryf ani parametrów sprzętu.",
                "Uwzględnij różnicę między net-meteringiem i net-billingiem oraz sens porównania taryfy obecnej z alternatywną, jeśli dane je zawierają.",
                "Zakończ jedną konkretną rekomendacją sprzedażową. Pisz po polsku, krótko, konkretnie i bez marketingowego nadęcia.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(profile),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "energy_storage_sales_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              salesGoal: { type: "string" },
              suggestedOpening: { type: "string" },
              rationale: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 4,
              },
              visitChecks: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              recommendation: { type: "string" },
              cautions: {
                type: "array",
                items: { type: "string" },
                maxItems: 2,
              },
            },
            required: [
              "salesGoal",
              "suggestedOpening",
              "rationale",
              "visitChecks",
              "recommendation",
              "cautions",
            ],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 800);
    throw new Error(`OpenAI Responses API returned ${response.status}: ${errorBody}`);
  }

  const raw = (await response.json()) as ResponsesApiResponse;
  const outputText = extractOutputText(raw);
  if (!outputText) throw new Error("OpenAI Responses API returned no output text.");

  return parseSalesAnalysis(outputText);
}

export function formatEnergyStorageAiNote(
  analysis: SalesAnalysis,
  recommendationType: EnergyStorageResult["recommendationType"]
) {
  const sections = [
    AI_NOTICE,
    "",
    AI_NOTE_PREFIX,
    "",
    `STATUS: ${recommendationLabel(recommendationType)}`,
    `CEL HANDLOWY: ${analysis.salesGoal}`,
    "",
    "JAK POPROWADZIĆ ROZMOWĘ:",
    analysis.suggestedOpening,
    "",
    "DLACZEGO:",
    ...analysis.rationale.map((item) => `• ${item}`),
  ];

  if (analysis.visitChecks.length) {
    sections.push(
      "",
      "JEŚLI UDA SIĘ UMÓWIĆ WIZYTĘ, SPRAWDŹ:",
      ...analysis.visitChecks.map((item, index) => `${index + 1}. ${item}`)
    );
  }

  sections.push("", "REKOMENDACJA SPRZEDAŻOWA:", analysis.recommendation);

  if (analysis.cautions.length) {
    sections.push("", "WAŻNE:", ...analysis.cautions.map((item) => `• ${item}`));
  }

  return sections.join("\n");
}

async function findAiHelperUserId() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", AI_HELPER_EMAIL)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Pomagier AI profile is not configured.");
  return data.id as string;
}

async function hasExistingAiNote(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("client_notes")
    .select("id")
    .eq("client_id", clientId)
    .like("content", `${AI_NOTICE}%${AI_NOTE_PREFIX}%`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function createEnergyStorageAiNote(clientId: string, input: EnergyStorageAiInput) {
  try {
    if (await hasExistingAiNote(clientId)) {
      console.info("energy-storage-lead AI note already exists", { clientId });
      return { ok: true as const, skipped: true as const };
    }

    const [authorId, analysis] = await Promise.all([
      findAiHelperUserId(),
      generateEnergyStorageSalesAnalysis(input),
    ]);
    const content = formatEnergyStorageAiNote(
      analysis,
      input.result?.recommendationType
    );

    const { error } = await supabaseAdmin.from("client_notes").insert({
      client_id: clientId,
      created_by: authorId,
      content,
    });

    if (error) throw error;
    console.info("energy-storage-lead AI note created", { clientId });
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    console.error("energy-storage-lead AI analysis failed", {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false as const, skipped: false as const };
  }
}
