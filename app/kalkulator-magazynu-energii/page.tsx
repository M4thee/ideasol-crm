"use client";

import { useMemo, useRef, useState } from "react";

type HasPv = "yes" | "no" | null;
type Tariff = "G11" | "G12" | "G13" | "other" | "unknown";
type BillMode = "monthly" | "yearly";
type SettlementSystem = "net_billing" | "net_metering" | "unknown";

type RecommendationType = "recommended" | "consider" | "not_recommended";

const ENERGY_PRICE_PER_KWH = 1.15;

function formatMoney(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseDecimal(value: string) {
  return Number(String(value).replace(",", ".")) || 0;
}
function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 5);

  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, "").slice(0, 15);
}
function pickStorageVariant(requiredKwh: number) {
  if (requiredKwh <= 10) return 10;
  if (requiredKwh <= 16) return 16;
  if (requiredKwh <= 20) return 20;
  return 30;
}

function getStorageFromConsumption(yearlyConsumptionKwh: number) {
  if (yearlyConsumptionKwh <= 4500) return 10;
  if (yearlyConsumptionKwh <= 7000) return 16;
  if (yearlyConsumptionKwh <= 9500) return 20;
  return 30;
}

function getSuggestedPvKw(yearlyConsumptionKwh: number) {
  if (yearlyConsumptionKwh <= 3500) return 4;
  if (yearlyConsumptionKwh <= 5000) return 5;
  if (yearlyConsumptionKwh <= 6500) return 6;
  if (yearlyConsumptionKwh <= 8500) return 8;
  if (yearlyConsumptionKwh <= 11000) return 10;
  return 12;
}

function calculatePaybackYears(investmentAfterSubsidy: number, yearlySavings: number) {
  if (investmentAfterSubsidy <= 0 || yearlySavings <= 0) return 0;

  const annualEnergyPriceGrowth = 0.11;
  let cumulativeSavings = 0;

  for (let year = 1; year <= 30; year += 1) {
    cumulativeSavings += yearlySavings * Math.pow(1 + annualEnergyPriceGrowth, year - 1);

    if (cumulativeSavings >= investmentAfterSubsidy) {
      return year;
    }
  }

  return 30;
}

function getMarketingPriceRange(baseCalculatorPriceWithoutSellerMarkup: number) {
  const priceLow = baseCalculatorPriceWithoutSellerMarkup + 6000;
  const priceHigh = Math.round(priceLow * 1.25);

  return [priceLow, priceHigh] as const;
}

function getOnlyStorageBasePriceWithoutSellerMarkup(storageKwh: number) {
  if (storageKwh <= 10) return 19000;
  if (storageKwh <= 16) return 25000;
  if (storageKwh <= 20) return 27800;
  return 43000;
}

function getPvStorageBasePriceWithoutSellerMarkup(pvKw: number, storageKwh: number) {
  if (pvKw <= 4 && storageKwh <= 10) return 28000;
  if (pvKw <= 5 && storageKwh <= 10) return 31000;
  if (pvKw <= 6 && storageKwh <= 16) return 38000;
  if (pvKw <= 8 && storageKwh <= 16) return 43000;
  if (pvKw <= 10 && storageKwh <= 20) return 49000;
  if (pvKw <= 12 && storageKwh <= 30) return 56000;
  return 62000;
}

function getSavingsRateRange(params: {
  hasPv: HasPv;
  settlementSystem: SettlementSystem;
  tariff: Tariff;
  yearlyBill: number;
  recommendedStorageKwh: number;
}) {
  const { hasPv, settlementSystem, tariff, yearlyBill, recommendedStorageKwh } = params;

  let low = hasPv === "yes" ? 0.26 : 0.54;
  let high = hasPv === "yes" ? 0.44 : 0.78;

  if (hasPv === "yes") {
    if (settlementSystem === "net_billing") {
      low += 0.08;
      high += 0.1;
    }

    if (settlementSystem === "net_metering") {
      low -= 0.08;
      high -= 0.1;
    }
  }

  if (tariff === "G12" || tariff === "G13") {
    low += 0.04;
    high += 0.05;
  }

  if (yearlyBill >= 6000) {
    low += 0.04;
    high += 0.05;
  }

  if (recommendedStorageKwh >= 20) {
    low += 0.03;
    high += 0.04;
  }

  if (hasPv === "yes") {
    return {
      low: clamp(low, 0.18, 0.48),
      high: clamp(high, 0.32, 0.64),
    };
  }

  return {
    low: clamp(low, 0.48, 0.68),
    high: clamp(high, 0.68, 0.88),
  };
}

function getRecommendation(params: {
  paybackYearsLow: number;
  paybackYearsHigh: number;
  priorities: string[];
}): {
  type: RecommendationType;
  title: string;
  description: string;
} {
  const { paybackYearsLow, paybackYearsHigh, priorities } = params;
  const paybackYearsForRecommendation = Math.round((paybackYearsLow + paybackYearsHigh) / 2);
  const caresAboutSavings = priorities.includes("Niższe rachunki");
  const caresAboutBackup = priorities.includes("Awaryjne zasilanie domu w razie awarii");
  const caresAboutEfficiency = priorities.includes("Zwiększenie wydajności mojej instalacji (mniej wyłączeń)");

  if (paybackYearsForRecommendation <= 6) {
    return {
      type: "recommended",
      title: "Rekomendujemy to rozwiązanie",
      description:
        "Na podstawie podanych danych magazyn energii może być dla Ciebie bardzo dobrym rozwiązaniem. Prognozowany okres zwrotu jest relatywnie krótki, a dodatkowo zyskujesz większą niezależność energetyczną i lepsze wykorzystanie energii z instalacji fotowoltaicznej.",
    };
  }

  if (paybackYearsForRecommendation >= 7 && paybackYearsForRecommendation <= 9) {
    return {
      type: "consider",
      title: "Warto rozważyć magazyn energii",
      description:
        "Magazyn energii może mieć sens, ale nie jest to jednoznaczna decyzja wyłącznie ekonomiczna. Ostateczna opłacalność będzie zależeć między innymi od przyszłych cen energii, profilu zużycia, taryfy oraz sposobu pracy instalacji.",
    };
  }

  if (caresAboutBackup) {
    return {
      type: "consider",
      title: "Finansowo ostrożnie, ale backup może mieć sens",
      description:
        "Pod względem samego obniżenia rachunków okres zwrotu może być długi. Jeżeli jednak zależy Ci na bezpieczeństwie energetycznym, magazyn energii z funkcją zasilania awaryjnego może nadal być bardzo rozsądnym rozwiązaniem dla domu.",
    };
  }

  if (caresAboutEfficiency) {
    return {
      type: "consider",
      title: "Warto sprawdzić problem wyłączeń instalacji",
      description:
        "Największą korzyścią może być poprawa wykorzystania istniejącej instalacji fotowoltaicznej. Jeżeli instalacja okresowo ogranicza produkcję przez wysokie napięcie w sieci, magazyn energii może pomóc ograniczyć część strat i zwiększyć autokonsumpcję.",
    };
  }

  if (caresAboutSavings) {
    return {
      type: "not_recommended",
      title: "Raczej nie rekomendujemy wyłącznie dla oszczędności",
      description:
        "Na podstawie podanych danych zakup magazynu energii może nie być obecnie najlepszym rozwiązaniem, jeśli głównym celem są wyłącznie niższe rachunki. Prognozowany okres zwrotu jest stosunkowo długi. Jeżeli mimo wszystko chcesz porozmawiać z doradcą, chętnie oddzwonimy.",
    };
  }

  return {
    type: "consider",
    title: "Wymaga dokładniejszej analizy",
    description:
      "Na podstawie podanych danych magazyn energii nie daje jednoznacznej odpowiedzi ekonomicznej. Warto sprawdzić profil zużycia, taryfę, pracę instalacji oraz możliwość uzyskania dotacji.",
  };
}

function getRecommendationBoxClass(type: RecommendationType) {
  if (type === "recommended") {
    return "border-emerald-300/30 bg-emerald-300/15";
  }

  if (type === "not_recommended") {
    return "border-rose-300/30 bg-rose-300/15";
  }

  return "border-amber-300/30 bg-amber-300/15";
}

function getRecommendationBadge(type: RecommendationType) {
  if (type === "recommended") return "✅ Rekomendacja pozytywna";
  if (type === "not_recommended") return "⚠️ Ostrożna rekomendacja";
  return "🟡 Warto rozważyć";
}

export default function EnergyStorageCalculatorPage() {
  const [hasPv, setHasPv] = useState<HasPv>(null);
  const [pvPower, setPvPower] = useState("");
  const [settlementSystem, setSettlementSystem] = useState<SettlementSystem>("unknown");
  const [billMode, setBillMode] = useState<BillMode>("monthly");
  const [billAmount, setBillAmount] = useState("");
  const [tariff, setTariff] = useState<Tariff>("unknown");
  const [wantsBackup, setWantsBackup] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

const [step, setStep] = useState(2);
const [priorities, setPriorities] = useState<string[]>([]);

const [contactFirstName, setContactFirstName] = useState("");
const [contactLastName, setContactLastName] = useState("");
const [contactPostalCode, setContactPostalCode] = useState("");
const [contactPhone, setContactPhone] = useState("");
const [contactEmail, setContactEmail] = useState("");
const [isSubmittingLead, setIsSubmittingLead] = useState(false);
const [leadSubmitStatus, setLeadSubmitStatus] =
  useState<"idle" | "success" | "error">("idle");

  const formRef = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const pvDetailsRef = useRef<HTMLDivElement | null>(null);
  const step4Ref = useRef<HTMLDivElement | null>(null);
  const step5Ref = useRef<HTMLDivElement | null>(null);
  const step6Ref = useRef<HTMLButtonElement | null>(null);

  const analysisSteps = [
    "Analiza zużycia energii",
    "Dobór pojemności magazynu",
    "Sprawdzenie potencjału dotacji",
    "Szacowanie oszczędności",
  ];

  const tariffHint = {
    G11: "Taryfa G11 nie wykorzystuje w pełni potencjału magazynów energii. Zalecane są taryfy G12/G13 lub taryfy dynamiczne. Nasz doradca pomoże wybrać Ci najlepsze rozwiązanie.",
    G12: "Taryfa G12 może dobrze współpracować z magazynem energii, szczególnie gdy część zużycia przesuwamy na tańsze godziny i lepiej zarządzamy energią w domu.",
    G13: "Taryfa G13 daje więcej możliwości optymalizacji pracy magazynu energii, bo pozwala lepiej dopasować ładowanie i zużycie do różnych stref cenowych.",
    other: "Przy mniej typowej taryfie warto sprawdzić profil zużycia i godziny poboru energii. Doradca może pomóc ocenić, czy zmiana taryfy zwiększy opłacalność magazynu.",
    unknown: "Nie musisz znać taryfy na tym etapie. Podczas analizy doradca może sprawdzić, czy obecna taryfa jest korzystna dla magazynu energii.",
  } satisfies Record<Tariff, string>;

  const priorityHint: Record<string, string> = {
    "Niższe rachunki":
      "Jedna z podstawowych ról magazynu energii to zwiększenie zużycia własnego prądu z fotowoltaiki. Dobrze skonfigurowany system sterowania może też wspierać sprzedaż energii w korzystniejszych godzinach, zamiast oddawania jej do sieci za bardzo niskie stawki.",
    "Awaryjne zasilanie domu w razie awarii":
      "Magazyn energii wyposażony w funkcję automatycznego zasilania awaryjnego może zasilać wybrane obwody domu podczas awarii sieci energetycznej. W prawidłowo dobranym systemie przełączenie na zasilanie z magazynu trwa zwykle mniej niż sekundę i jest praktycznie nieodczuwalne.",
    "Zwiększenie wydajności mojej instalacji (mniej wyłączeń)":
      "W okresach wysokiej produkcji część instalacji fotowoltaicznych ogranicza pracę albo wyłącza się przez zbyt wysokie napięcie w sieci. To realna strata energii, szczególnie latem. Magazyn energii może stabilizować pracę instalacji i ograniczać straty wynikające z nadprodukcji oraz przeciążeń sieci.",
  };

  function goToStep(nextStep: number) {
    setStep(nextStep);
  }

  function scrollToElement(element: HTMLElement | null) {
    if (!element) return;

    window.setTimeout(() => {
      const startY = window.scrollY;
      const elementRect = element.getBoundingClientRect();
      const elementCenter = elementRect.top + window.scrollY + elementRect.height / 2;
      const targetY = Math.max(0, elementCenter - window.innerHeight / 2);
      const duration = 750;
      const startTime = window.performance.now();

      function easeInOutCubic(t: number) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }

      function animateScroll(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);
        const nextY = startY + (targetY - startY) * easedProgress;

        window.scrollTo(0, nextY);

        if (progress < 1) {
          window.requestAnimationFrame(animateScroll);
        }
      }

      window.requestAnimationFrame(animateScroll);
    }, 180);
  }

  function selectHasPv(value: Exclude<HasPv, null>) {
    setHasPv(value);
    setShowResult(false);

    if (value === "yes") {
      goToStep(3);
      scrollToElement(formRef.current);
      return;
    }

    goToStep(4);
    scrollToElement(formRef.current);
  }

  function selectSettlementSystem(value: SettlementSystem) {
    setSettlementSystem(value);
  }

  function selectTariff(value: Tariff) {
    setTariff(value);
    setShowResult(false);
    goToStep(6);
    scrollToElement(formRef.current);
  }

  function togglePriority(value: string) {
    setPriorities((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function editAnswers() {
    setShowResult(false);
    setIsAnalyzing(false);
    setAnalysisStep(0);
    scrollToElement(formRef.current);
  }

  function restartCalculator() {
    setHasPv(null);
    setPvPower("");
    setSettlementSystem("unknown");
    setBillMode("monthly");
    setBillAmount("");
    setTariff("unknown");
    setShowResult(false);
    setIsAnalyzing(false);
    setAnalysisStep(0);
    setStep(2);
    setPriorities([]);
    setContactFirstName("");
    setContactLastName("");
    setContactPostalCode("");
    setContactPhone("");
    setContactEmail("");
    setLeadSubmitStatus("idle");
    scrollToElement(formRef.current);
  }

  function goBack() {
    if (step === 2) return;

    if (step === 4 && hasPv === "no") {
      goToStep(2);
      scrollToElement(formRef.current);
      return;
    }

    goToStep(step - 1);
    scrollToElement(formRef.current);
  }

  const billValue = parseDecimal(billAmount);
  const yearlyBill = billMode === "monthly" ? billValue * 12 : billValue;
  const yearlyConsumptionKwh = yearlyBill > 0 ? yearlyBill / ENERGY_PRICE_PER_KWH : 0;

  const result = useMemo(() => {
    if (!hasPv || yearlyBill <= 0) return null;

    const currentPvPowerKw = parseDecimal(pvPower);
    const storageFromConsumption = getStorageFromConsumption(yearlyConsumptionKwh);
    const storageFromPv =
      hasPv === "yes" && currentPvPowerKw > 0
        ? pickStorageVariant(currentPvPowerKw * 2)
        : 0;
    const recommendedStorageKwh =
      hasPv === "yes"
        ? Math.max(storageFromConsumption, storageFromPv)
        : pickStorageVariant(getSuggestedPvKw(yearlyConsumptionKwh) * 2);
    const suggestedPvKw = getSuggestedPvKw(yearlyConsumptionKwh);

    const savingsRate = getSavingsRateRange({
      hasPv,
      settlementSystem,
      tariff,
      yearlyBill,
      recommendedStorageKwh,
    });
    const yearlySavingsLow = yearlyBill * savingsRate.low;
    const yearlySavingsHigh = yearlyBill * savingsRate.high;

    const baseCalculatorPriceWithoutSellerMarkup =
      hasPv === "yes"
        ? getOnlyStorageBasePriceWithoutSellerMarkup(recommendedStorageKwh)
        : getPvStorageBasePriceWithoutSellerMarkup(suggestedPvKw, recommendedStorageKwh);

    const [priceLow, priceHigh] = getMarketingPriceRange(baseCalculatorPriceWithoutSellerMarkup);

    const storageSubsidyCap = settlementSystem === "net_metering" ? 8000 : 16000;
    const subsidyEstimate = Math.min(recommendedStorageKwh * 800, storageSubsidyCap) + 2000;

    const investmentLowAfterSubsidy = Math.max(0, priceLow - subsidyEstimate);
    const investmentHighAfterSubsidy = Math.max(0, priceHigh - subsidyEstimate);
    const paybackYearsLow = calculatePaybackYears(investmentLowAfterSubsidy, yearlySavingsHigh);
    const paybackYearsHigh = calculatePaybackYears(investmentHighAfterSubsidy, yearlySavingsLow);

    const recommendation = getRecommendation({
      paybackYearsLow,
      paybackYearsHigh,
      priorities,
    });

    return {
      recommendedStorageKwh,
      storageFromConsumption,
      storageFromPv,
      currentPvPowerKw,
      suggestedPvKw,
      yearlySavingsLow,
      yearlySavingsHigh,
      savingsRateLow: savingsRate.low,
      savingsRateHigh: savingsRate.high,
      priceLow,
      priceHigh,
      subsidyEstimate,
      paybackYearsLow,
      paybackYearsHigh,
      recommendation,
    };
  }, [hasPv, pvPower, settlementSystem, tariff, yearlyBill, yearlyConsumptionKwh, priorities]);

  const hasValidPvDetails = hasPv !== "yes" || parseDecimal(pvPower) > 0;
const canCalculate = Boolean(hasPv && yearlyBill > 0 && hasValidPvDetails && priorities.length > 0);

const canSubmitLead = Boolean(
  contactFirstName.trim() &&
    contactPostalCode.length === 6 &&
    contactPhone.replace(/\D/g, "").length >= 9 &&
    result
);

  function handleCalculate() {
    if (!canCalculate) return;
    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisStep(0);

    scrollToElement(formRef.current);

    analysisSteps.forEach((_, index) => {
      window.setTimeout(() => {
        setAnalysisStep(index + 1);
      }, 650 + index * 850);
    });

    window.setTimeout(() => {
      setIsAnalyzing(false);
      setShowResult(true);
      scrollToElement(formRef.current);
    }, 4800);
  }

  async function submitLead() {
    if (!canSubmitLead || !result) return;

    setIsSubmittingLead(true);
    setLeadSubmitStatus("idle");

    try {
      const response = await fetch("/api/public/energy-storage-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "kalkulatorME",
          contact: {
            firstName: contactFirstName.trim(),
            lastName: contactLastName.trim() || null,
            postalCode: contactPostalCode,
            phone: contactPhone,
            email: contactEmail.trim() || null,
          },
          answers: {
            hasPv,
            pvPower: pvPower || null,
            settlementSystem,
            billMode,
            billAmount,
            yearlyBill,
            yearlyConsumptionKwh,
            tariff,
            priorities,
          },
          result: {
            recommendationType: result.recommendation.type,
            recommendationTitle: result.recommendation.title,
            recommendedStorageKwh: result.recommendedStorageKwh,
            suggestedPvKw: hasPv === "no" ? result.suggestedPvKw : null,
            yearlySavingsLow: result.yearlySavingsLow,
            yearlySavingsHigh: result.yearlySavingsHigh,
            priceLow: result.priceLow,
            priceHigh: result.priceHigh,
            subsidyEstimate: result.subsidyEstimate,
            paybackYearsLow: result.paybackYearsLow,
            paybackYearsHigh: result.paybackYearsHigh,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Lead submit failed");
      }

      setLeadSubmitStatus("success");
    } catch (error) {
      console.error(error);
      setLeadSubmitStatus("error");
    } finally {
      setIsSubmittingLead(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#D9F99D_0,#CCFBF1_24%,#F8FAFC_55%,#E0E7FF_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20 sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-lime-300/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-200 backdrop-blur">
              Kalkulator IdeaSol
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Czy magazyn energii ma sens w Twoim domu?
            </h1>
            <p className="mt-5 text-lg leading-8 text-[#EDE6E0]">
              Odpowiedz na kilka pytań i sprawdź potencjalne oszczędności, sugerowaną pojemność magazynu energii oraz możliwą dotację.
            </p>
            <a
              href="#analiza"
              onClick={(event) => {
                event.preventDefault();
                goToStep(2);
                scrollToElement(formRef.current);
              }}
              className="mt-6 inline-flex rounded-2xl bg-gradient-to-r from-cyan-300 to-lime-300 px-6 py-4 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:brightness-105"
            >
              Rozpocznij analizę
            </a>
          </div>
        </section>

        <section className="grid gap-6">
          <div id="analiza" ref={formRef} className="mx-auto w-full max-w-3xl scroll-mt-4 rounded-[32px] border border-white/80 bg-white/75 p-5 shadow-2xl shadow-slate-950/10 backdrop-blur-xl sm:p-8">
            {isAnalyzing ? (
              <div className="flex min-h-[520px] flex-col justify-center rounded-[28px] bg-slate-950 p-6 text-white sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Analiza</p>
                <h2 className="mt-4 text-3xl font-bold">Liczymy potencjał Twojego domu</h2>
                <div className="mt-8 space-y-3">
                  {analysisSteps.map((item, index) => {
                    const isDone = analysisStep > index;
                    const isCurrent = analysisStep === index;

                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-[20px] border p-4 transition ${
                          isDone
                            ? "border-cyan-300/30 bg-cyan-300/15"
                            : isCurrent
                              ? "border-white/20 bg-white/10"
                              : "border-white/10 bg-white/5"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            isDone ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white/60"
                          }`}
                        >
                          {isDone ? "✓" : index + 1}
                        </span>
                        <span className={isDone ? "font-bold text-white" : "text-white/70"}>{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : showResult && result ? (
              <div className="space-y-6 rounded-[28px] bg-slate-950 p-6 text-white sm:p-8">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Twój wstępny wynik</p>
                  <h2 className="mt-4 text-3xl font-bold">
                    {hasPv === "yes" ? "Magazyn energii może mieć sens" : "PV + magazyn energii może mieć sens"}
                  </h2>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm text-[#D8CEC7]">Szacowane roczne zużycie</p>
                    <p className="mt-1 text-2xl font-bold">{Math.round(yearlyConsumptionKwh).toLocaleString("pl-PL")} kWh</p>
                  </div>
                  {hasPv === "yes" && (
                    <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                      <p className="text-sm text-[#D8CEC7]">Twoja obecna instalacja PV</p>
                      <p className="mt-1 text-2xl font-bold">
                        {pvPower ? `${pvPower} kWp` : "moc niepodana"} · {settlementSystem === "net_billing" ? "net-billing" : settlementSystem === "net_metering" ? "net-metering" : "system nieznany"}
                      </p>
                    </div>
                  )}
                  {priorities.length > 0 && (
                    <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                      <p className="text-sm text-[#D8CEC7]">Najważniejsze dla Ciebie</p>
                      <p className="mt-1 text-lg font-bold">{priorities.join(" · ")}</p>
                    </div>
                  )}
                  {hasPv === "no" && (
                    <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                      <p className="text-sm text-[#D8CEC7]">Sugerowana moc PV</p>
                      <p className="mt-1 text-2xl font-bold">około {result.suggestedPvKw} kWp</p>
                    </div>
                  )}
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm text-[#D8CEC7]">Sugerowany magazyn energii</p>
                    <p className="mt-1 text-2xl font-bold">około {result.recommendedStorageKwh} kWh</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm text-[#D8CEC7]">Szacowana roczna korzyść</p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatMoney(result.yearlySavingsLow)} – {formatMoney(result.yearlySavingsHigh)} / rok
                    </p>
                    <p className="mt-2 text-sm text-[#D8CEC7]">
                      To nawet około {Math.round(result.savingsRateLow * 100)}–{Math.round(result.savingsRateHigh * 100)}% obecnych kosztów energii, w zależności od profilu zużycia i sposobu pracy instalacji.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm text-[#D8CEC7]">Orientacyjny koszt inwestycji</p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatMoney(result.priceLow)} – {formatMoney(result.priceHigh)}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm text-[#D8CEC7]">Możliwa dotacja</p>
                    <p className="mt-1 text-2xl font-bold">do {formatMoney(result.subsidyEstimate)}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm text-[#D8CEC7]">Szacunkowy okres zwrotu inwestycji</p>
                    <p className="mt-1 text-2xl font-bold">
                      {result.paybackYearsLow === result.paybackYearsHigh
                        ? `około ${result.paybackYearsLow} lat`
                        : `${result.paybackYearsLow}–${result.paybackYearsHigh} lat`}
                    </p>
                    <p className="mt-2 text-sm text-[#D8CEC7]">
                      Szacunek uwzględnia cenę inwestycji po dotacji oraz wzrost ceny energii o 11% rocznie.
                    </p>
                  </div>
                </div>

                <div className={`rounded-[24px] border p-5 ${getRecommendationBoxClass(result.recommendation.type)}`}>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    {getRecommendationBadge(result.recommendation.type)}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold">{result.recommendation.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#D8CEC7]">{result.recommendation.description}</p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-[#D8CEC7]">
                  Wynik ma charakter orientacyjny i został przygotowany na podstawie podanych danych. Dokładna analiza uwzględnia dodatkowo profil zużycia energii, parametry instalacji fotowoltaicznej, warunki techniczne budynku oraz możliwości uzyskania dotacji.
                </div>

                <div className="rounded-[24px] bg-white p-5 text-slate-950 shadow-xl shadow-black/10">
                  <p className="text-lg font-bold">Chcesz dokładniejszą analizę dla swojego domu?</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Zostaw krótki kontakt. Doradca IdeaSol oddzwoni i omówi wynik kalkulatora oraz możliwy wariant instalacji.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Imię *</span>
                      <input
                        value={contactFirstName}
                        onChange={(event) => setContactFirstName(event.target.value)}
                        placeholder="np. Jan"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Nazwisko</span>
                      <input
                        value={contactLastName}
                        onChange={(event) => setContactLastName(event.target.value)}
                        placeholder="opcjonalnie"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Kod pocztowy *</span>
                      <input
                        value={contactPostalCode}
                        onChange={(event) => setContactPostalCode(formatPostalCode(event.target.value))}
                        inputMode="numeric"
                        placeholder="__-___"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Telefon *</span>
                      <input
                        value={contactPhone}
                        onChange={(event) => setContactPhone(normalizePhone(event.target.value))}
                        inputMode="tel"
                        placeholder="np. 500600700"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-sm font-semibold text-slate-700">E-mail</span>
                      <input
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        inputMode="email"
                        placeholder="opcjonalnie — wyślemy kopię analizy"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={submitLead}
                    disabled={!canSubmitLead || isSubmittingLead || leadSubmitStatus === "success"}
                    className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    {leadSubmitStatus === "success"
                      ? "Dziękujemy — zgłoszenie wysłane"
                      : isSubmittingLead
                        ? "Wysyłanie..."
                        : "Poproś o kontakt doradcy"}
                  </button>

                  {leadSubmitStatus === "success" && (
                    <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                      Zgłoszenie zostało przyjęte. Doradca IdeaSol skontaktuje się z Tobą możliwie szybko.
                    </p>
                  )}

                  {leadSubmitStatus === "error" && (
                    <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                      Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={editAnswers}
                    className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/15"
                  >
                    Edytuj odpowiedzi
                  </button>
                  <button
                    type="button"
                    onClick={restartCalculator}
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    Zacznij od nowa
                  </button>
                </div>
              </div>
            ) : (
            <div className="space-y-8">
              {step === 2 && (
                <div className="animate-[fadeInUp_0.45s_ease-out]">
              <h2 className="text-xl font-bold">1. Czy posiadasz instalację fotowoltaiczną?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onPointerUp={() => selectHasPv("yes")}
                      className={`rounded-[24px] border p-5 text-left shadow-sm transition touch-manipulation hover:-translate-y-0.5 hover:shadow-md ${
                        hasPv === "yes" ? "border-cyan-500 bg-cyan-100" : "border-slate-200 bg-white/90 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-lg font-bold">Tak, ale chcę dobrać do niej magazyn energii</span>
                      <span className="mt-1 block text-sm text-[#6B5E58]">Sprawdzimy pojemność magazynu, oszczędności i możliwą dotację.</span>
                    </button>
                    <button
                      type="button"
                      onPointerUp={() => selectHasPv("no")}
                      className={`rounded-[24px] border p-5 text-left shadow-sm transition touch-manipulation hover:-translate-y-0.5 hover:shadow-md ${
                        hasPv === "no" ? "border-cyan-500 bg-cyan-100" : "border-slate-200 bg-white/90 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-lg font-bold">Nie, ale chcę mieć instalację wraz z magazynem</span>
                      <span className="mt-1 block text-sm text-[#6B5E58]">Oszacujemy moc instalacji PV i magazynu energii.</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={restartCalculator}
                    className="mt-4 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
                  >
                    Zacznij od nowa
                  </button>
                </div>
              )}

              {hasPv === "yes" && step === 3 && (
                <div ref={pvDetailsRef} className="scroll-mt-6 rounded-[28px] border border-slate-200 bg-white/55 p-5 shadow-inner shadow-white/70 backdrop-blur animate-[fadeInUp_0.45s_ease-out]">
                  <h2 className="text-xl font-bold">2. Opowiedz krótko o swojej fotowoltaice</h2>

                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-600">Moc instalacji</label>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        value={pvPower}
                        onChange={(event) => setPvPower(event.target.value)}
                        inputMode="decimal"
                        placeholder="np. 6,5"
                        className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-medium shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      />
                      <span className="font-bold text-slate-600">kWp</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-600">W jakim systemie rozliczasz energię?</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {[
                        ["net_billing", "Tzw. nowe zasady (net-billing)"],
                        ["net_metering", "Tzw. stare zasady (net-metering)"],
                        ["unknown", "Nie wiem"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onPointerUp={() => selectSettlementSystem(value as SettlementSystem)}
                          className={`rounded-2xl border px-4 py-3 text-left font-semibold shadow-sm transition touch-manipulation hover:-translate-y-0.5 hover:shadow-md ${
                            settlementSystem === value ? "border-cyan-500 bg-cyan-100" : "border-slate-200 bg-white/90 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-5 w-full rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 font-bold text-slate-700 transition hover:bg-white hover:text-slate-950"
                  >
                    Wstecz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (parseDecimal(pvPower) <= 0) return;
                      goToStep(4);
                      scrollToElement(formRef.current);
                    }}
                    disabled={parseDecimal(pvPower) <= 0}
                    className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    Dalej
                  </button>
                </div>
              )}

              {step === 4 && (
                <div ref={step3Ref} className="scroll-mt-6 animate-[fadeInUp_0.45s_ease-out]">
                  <h2 className="text-xl font-bold">{hasPv === "yes" ? "3." : "2."} Ile płacisz za prąd?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
                    <select
                      value={billMode}
                      onChange={(event) => {
                        setBillMode(event.target.value as BillMode);
                        setShowResult(false);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-medium shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    >
                      <option value="monthly">Miesięcznie</option>
                      <option value="yearly">Rocznie</option>
                    </select>
                    <input
                      value={billAmount}
                      onChange={(event) => {
                        setBillAmount(event.target.value);
                        setShowResult(false);
                      }}
                      inputMode="decimal"
                      placeholder={billMode === "monthly" ? "np. 350" : "np. 4200"}
                      className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-medium shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Na potrzeby wstępnej analizy przeliczamy rachunek na szacunkowe roczne zużycie energii.
                  </p>
                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-5 w-full rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 font-bold text-slate-700 transition hover:bg-white hover:text-slate-950"
                  >
                    Wstecz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (billValue <= 0) return;
                      goToStep(5);
                      scrollToElement(formRef.current);
                    }}
                    disabled={billValue <= 0}
                    className="mt-3 w-full rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    Dalej
                  </button>
                </div>
              )}

              {step === 5 && (
                <div ref={step4Ref} className="scroll-mt-6 animate-[fadeInUp_0.45s_ease-out]">
                  <h2 className="text-xl font-bold">{hasPv === "yes" ? "4." : "3."} Jaką masz taryfę?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ["G11", "G11 (całodobowa)"],
                      ["G12", "G12 (dwustrefowa)"],
                      ["G13", "G13"],
                      ["other", "Inna"],
                      ["unknown", "Nie wiem"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onPointerUp={() => selectTariff(value as Tariff)}
                        className={`rounded-2xl border px-4 py-3 text-left font-semibold shadow-sm transition touch-manipulation hover:-translate-y-0.5 hover:shadow-md ${
                          tariff === value ? "border-cyan-500 bg-cyan-100" : "border-slate-200 bg-white/90 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {tariff !== "unknown" && (
                    <div className="mt-4 rounded-[22px] border border-cyan-200 bg-cyan-50/80 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                      <span className="font-bold text-slate-950">Wskazówka:</span> {tariffHint[tariff]}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-5 w-full rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 font-bold text-slate-700 transition hover:bg-white hover:text-slate-950"
                  >
                    Wstecz
                  </button>
                </div>
              )}

              {step === 6 && (
                <div ref={step5Ref} className="scroll-mt-6 animate-[fadeInUp_0.45s_ease-out]">
                  <h2 className="text-xl font-bold">{hasPv === "yes" ? "5." : "4."} Co jest dla Ciebie najważniejsze?</h2>
                  <div className="mt-4 grid gap-3">
                    {[
                      "Niższe rachunki",
                      "Awaryjne zasilanie domu w razie awarii",
                      "Zwiększenie wydajności mojej instalacji (mniej wyłączeń)",
                    ].map((item) => (
                      <div key={item}>
                        <button
                          type="button"
                          onPointerUp={() => togglePriority(item)}
                          className={`w-full rounded-2xl border p-4 text-left font-semibold shadow-sm transition touch-manipulation hover:-translate-y-0.5 hover:shadow-md ${
                            priorities.includes(item) ? "border-cyan-500 bg-cyan-100" : "border-slate-200 bg-white/80"
                          }`}
                        >
                          {item}
                        </button>
                        {priorities.includes(item) && (
                          <div className="mt-2 rounded-[20px] border border-cyan-200 bg-cyan-50/80 p-4 text-sm leading-6 text-slate-700 shadow-sm animate-[fadeInUp_0.35s_ease-out]">
                            <span className="font-bold text-slate-950">Wskazówka:</span> {priorityHint[item]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={goBack}
                    className="mt-5 w-full rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 font-bold text-slate-700 transition hover:bg-white hover:text-slate-950"
                  >
                    Wstecz
                  </button>
                  <button
                    ref={step6Ref}
                    type="button"
                    onClick={handleCalculate}
                    disabled={!canCalculate}
                    className="mt-3 w-full rounded-[24px] bg-slate-950 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    Dokonaj analizy
                  </button>
                </div>
              )}

            </div>
            )}
          </div>
        </section>
      </div>
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}