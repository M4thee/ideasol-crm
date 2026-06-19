"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type HasPv = "yes" | "no" | null;
type Tariff = "G11" | "G12" | "G13" | "other_unknown" | null;
type BillMode = "monthly" | "yearly";

type SettlementSystem = "net_billing" | "net_metering" | "unknown" | null;

type ThemeMode = "auto" | "light" | "dark";

type RecommendationType = "recommended" | "consider" | "not_recommended";

const ENERGY_PRICE_PER_KWH = 1.15;
const NET_BILLING_EXPORT_PRICE_PER_KWH = 0.27;
const NET_BILLING_BASE_AUTOCONSUMPTION_RATE = 0.2;
const NET_METERING_BASE_AUTOCONSUMPTION_RATE = 0.25;
const NET_METERING_SMALL_INSTALLATION_RETURN_RATE = 0.8;
const NET_METERING_LARGE_INSTALLATION_RETURN_RATE = 0.7;
const STORAGE_ROUND_TRIP_EFFICIENCY = 0.9;
const PV_PRODUCTION_PER_KWP = 1005;

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
  const priceLow = baseCalculatorPriceWithoutSellerMarkup + 3500;
  const priceHigh = Math.round(priceLow * 1.25);

  return [priceLow, priceHigh] as const;
}

function getPvStorageMarketingPriceRange(pvKw: number, storageKwh: number) {
  if (pvKw <= 4 && storageKwh <= 10) return [36000, 44000] as const;
  if (pvKw <= 5 && storageKwh <= 10) return [38000, 46500] as const;
  if (pvKw <= 6 && storageKwh <= 16) return [42000, 51000] as const;
  if (pvKw <= 8 && storageKwh <= 16) return [44400, 53600] as const;
  if (pvKw <= 10 && storageKwh <= 20) return [51900, 61600] as const;
  if (pvKw <= 12 && storageKwh <= 30) return [58900, 66800] as const;
  if (pvKw <= 15 && storageKwh <= 30) return [62600, 69900] as const;

  return [62600, 69900] as const;
}


function getOnlyStorageBasePriceWithoutSellerMarkup(storageKwh: number) {
  if (storageKwh <= 10) return 19000;
  if (storageKwh <= 16) return 25000;
  if (storageKwh <= 20) return 27800;
  return 43000;
}

function getPvStorageBasePriceWithoutSellerMarkup(pvKw: number, storageKwh: number) {
  if (pvKw <= 4 && storageKwh <= 10) return 30000;
  if (pvKw <= 5 && storageKwh <= 10) return 32000;
  if (pvKw <= 6 && storageKwh <= 16) return 36000;
  if (pvKw <= 8 && storageKwh <= 16) return 38400;
  if (pvKw <= 10 && storageKwh <= 20) return 45900;
  if (pvKw <= 12 && storageKwh <= 30) return 52900;
  return 52900;
}


function getAutoconsumptionRateWithStorageAndHems(storageKwh: number) {
  if (storageKwh <= 10) return 0.7;
  if (storageKwh <= 16) return 0.78;
  if (storageKwh <= 20) return 0.83;
  return 0.88;
}

function getBaseAutoconsumptionRate(params: {
  pvProductionKwh: number;
  yearlyConsumptionKwh: number;
}) {
  const { pvProductionKwh, yearlyConsumptionKwh } = params;

  if (pvProductionKwh <= 0 || yearlyConsumptionKwh <= 0) return NET_BILLING_BASE_AUTOCONSUMPTION_RATE;

  const coverageRatio = pvProductionKwh / yearlyConsumptionKwh;

  if (coverageRatio <= 0.6) return 0.3;
  if (coverageRatio <= 1) return 0.25;
  if (coverageRatio <= 1.5) return 0.22;
  return 0.2;
}


function getNetBillingStorageSavingsRange(params: {
  pvProductionKwh: number;
  yearlyConsumptionKwh: number;
  storageKwh: number;
  baseAutoconsumptionRate: number;
}) {
  const { pvProductionKwh, yearlyConsumptionKwh, storageKwh, baseAutoconsumptionRate } = params;

  const baseAutoconsumedKwh = Math.min(
    pvProductionKwh * baseAutoconsumptionRate,
    yearlyConsumptionKwh
  );

  const autoconsumptionRateWithStorage = getAutoconsumptionRateWithStorageAndHems(storageKwh);
  const autoconsumedWithStorageKwh = Math.min(
    pvProductionKwh * autoconsumptionRateWithStorage,
    yearlyConsumptionKwh
  );

  const additionalAutoconsumedKwh = Math.max(
    0,
    (autoconsumedWithStorageKwh - baseAutoconsumedKwh) * STORAGE_ROUND_TRIP_EFFICIENCY
  );

  const valueDifferencePerKwh = ENERGY_PRICE_PER_KWH - NET_BILLING_EXPORT_PRICE_PER_KWH;
  const expectedSavings = additionalAutoconsumedKwh * valueDifferencePerKwh;

  return {
    baseAutoconsumptionRate,
    autoconsumptionRateWithStorage,
    additionalAutoconsumedKwh,
    valueDifferencePerKwh,
    low: expectedSavings * 0.85,
    high: expectedSavings * 1.15,
  };
}

function getNetMeteringStorageSavingsRange(params: {
  pvProductionKwh: number;
  yearlyConsumptionKwh: number;
  storageKwh: number;
  currentPvPowerKw: number;
  baseAutoconsumptionRate: number;
}) {
  const { pvProductionKwh, yearlyConsumptionKwh, storageKwh, currentPvPowerKw, baseAutoconsumptionRate } = params;

  const returnRate =
    currentPvPowerKw > 10
      ? NET_METERING_LARGE_INSTALLATION_RETURN_RATE
      : NET_METERING_SMALL_INSTALLATION_RETURN_RATE;

  const baseAutoconsumedKwh = Math.min(
    pvProductionKwh * baseAutoconsumptionRate,
    yearlyConsumptionKwh
  );

  const autoconsumptionRateWithStorage = getAutoconsumptionRateWithStorageAndHems(storageKwh);

  const autoconsumedWithStorageKwh = Math.min(
    pvProductionKwh * autoconsumptionRateWithStorage,
    yearlyConsumptionKwh
  );

  const additionalAutoconsumedKwh = Math.max(
    0,
    (autoconsumedWithStorageKwh - baseAutoconsumedKwh) * STORAGE_ROUND_TRIP_EFFICIENCY
  );

  const valueDifferencePerKwh = ENERGY_PRICE_PER_KWH * (1 - returnRate);
  const expectedSavings = additionalAutoconsumedKwh * valueDifferencePerKwh;

  return {
    baseAutoconsumptionRate,
    autoconsumptionRateWithStorage,
    additionalAutoconsumedKwh,
    returnRate,
    valueDifferencePerKwh,
    low: expectedSavings * 0.85,
    high: expectedSavings * 1.15,
  };
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
      low -= 0.03;
      high -= 0.04;
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
  const paybackYearsForRecommendation = paybackYearsLow;
  const caresAboutSavings = priorities.includes("Niższe rachunki");
  const caresAboutBackup = priorities.includes("Awaryjne zasilanie domu w razie awarii");
  const caresAboutEfficiency = priorities.includes("Zwiększenie produktywności mojej instalacji fotowoltaicznej (zapobieganie wyłączeniom)");

  if (paybackYearsForRecommendation <= 7) {
    return {
      type: "recommended",
      title: "Magazyn energii wygląda na dobrą inwestycję",
      description:
        "Szacowany okres zwrotu jest korzystny, a magazyn może zwiększyć wykorzystanie energii z fotowoltaiki i ograniczyć rachunki za prąd.",
    };
  }

  if (paybackYearsForRecommendation >= 8 && paybackYearsForRecommendation <= 11) {
    return {
      type: "consider",
      title: "Magazyn energii warto rozważyć",
      description:
        "Opłacalność nie jest jednoznaczna i zależy m.in. od sposobu zużycia energii, przyszłych cen prądu oraz możliwości uzyskania dotacji.",
    };
  }

  if (caresAboutBackup) {
    return {
      type: "consider",
      title: "Warto rozważyć magazyn energii ze względu na zasilanie awaryjne",
      description:
        "Jeżeli zależy Ci na zasilaniu awaryjnym podczas przerw w dostawie prądu, magazyn energii może dać realny komfort i większe bezpieczeństwo pracy domu.",
    };
  }

  if (caresAboutEfficiency) {
    return {
      type: "consider",
      title: "Warto sprawdzić problem wyłączeń instalacji",
      description:
        "Jeżeli instalacja okresowo ogranicza produkcję lub wyłącza się przy wysokim napięciu, magazyn może pomóc wykorzystać większą część wyprodukowanej energii.",
    };
  }

  if (caresAboutSavings) {
    return {
      type: "not_recommended",
      title: "Magazyn energii ma ograniczoną opłacalność",
      description:
        "Przy obecnych założeniach inwestycja może zwracać się stosunkowo długo. Warto porozmawiać z doradcą o innych możliwościach obniżenia kosztów energii.",
    };
  }

  return {
    type: "consider",
    title: "Wymaga dokładniejszej analizy",
    description:
      "Wynik nie daje jednoznacznej odpowiedzi. Warto sprawdzić profil zużycia, taryfę, pracę instalacji oraz możliwość uzyskania dotacji.",
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
  if (type === "not_recommended") return "🛑 NIE REKOMENDUJEMY";
  return "🟡 Warto rozważyć";
}

export default function EnergyStorageCalculatorPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [hasStarted, setHasStarted] = useState(false);
  const [hasPv, setHasPv] = useState<HasPv>(null);
  const [pvPower, setPvPower] = useState("");
  const [settlementSystem, setSettlementSystem] = useState<SettlementSystem>(null);
  const [billMode, setBillMode] = useState<BillMode>("monthly");
  const [billAmount, setBillAmount] = useState("");
  const [tariff, setTariff] = useState<Tariff>(null);
  const [wantsBackup, setWantsBackup] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

const [step, setStep] = useState(2);
const [priorities, setPriorities] = useState<string[]>([]);
const [expandedResultDetails, setExpandedResultDetails] = useState<Record<string, boolean>>({});
const [showDetailedResult, setShowDetailedResult] = useState(false);

const [contactFirstName, setContactFirstName] = useState("");
const [contactLastName, setContactLastName] = useState("");
const [contactPostalCode, setContactPostalCode] = useState("");
const [contactPhone, setContactPhone] = useState("");
const [contactEmail, setContactEmail] = useState("");
const [marketingConsent, setMarketingConsent] = useState(false);
const [isSubmittingLead, setIsSubmittingLead] = useState(false);
const [leadSubmitStatus, setLeadSubmitStatus] =
  useState<"idle" | "success" | "error">("idle");
const [turnstileToken, setTurnstileToken] = useState("");
const [honeypot, setHoneypot] = useState("");
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const turnstileRef = useRef<HTMLDivElement | null>(null);
const [isTurnstileLoaded, setIsTurnstileLoaded] = useState(false);

  useEffect(() => {
    const savedThemeMode = window.localStorage.getItem("energyStorageCalculatorTheme") as ThemeMode | null;

    if (savedThemeMode === "auto" || savedThemeMode === "light" || savedThemeMode === "dark") {
      setThemeMode(savedThemeMode);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function updateSystemTheme() {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    }

    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", updateSystemTheme);
    };
  }, []);

  useEffect(() => {
    if (!showResult) {
      return;
    }

    if (!turnstileSiteKey || !isTurnstileLoaded || !turnstileRef.current || !window.turnstile) {
      return;
    }

    setTurnstileToken("");
    turnstileRef.current.innerHTML = "";

    window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        setTurnstileToken(token);
      },
      "expired-callback": () => {
        setTurnstileToken("");
      },
    });
  }, [turnstileSiteKey, isTurnstileLoaded, showResult]);

  function changeThemeMode(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    window.localStorage.setItem("energyStorageCalculatorTheme", nextThemeMode);
  }

  const formRef = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const pvDetailsRef = useRef<HTMLDivElement | null>(null);
  const step4Ref = useRef<HTMLDivElement | null>(null);
  const step5Ref = useRef<HTMLDivElement | null>(null);
  const step6Ref = useRef<HTMLButtonElement | null>(null);
  const detailedReportRef = useRef<HTMLDivElement | null>(null);

  const analysisSteps = [
    "Analiza zużycia energii",
    "Dobór pojemności magazynu",
    "Sprawdzenie potencjału dotacji",
    "Szacowanie oszczędności",
  ];

  const isDarkMode = themeMode === "dark" || (themeMode === "auto" && systemTheme === "dark");

  const pageClass = isDarkMode
    ? "relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#0F172A_0,#061524_28%,#020617_58%,#050816_100%)] px-4 py-6 text-white sm:px-6 lg:px-8"
    : "relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#ECFCCB_0,#CCFBF1_24%,#F8FAFC_58%,#E0E7FF_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8";

  const heroClass = isDarkMode
    ? "relative overflow-hidden rounded-[36px] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl shadow-cyan-950/30 sm:p-10"
    : "relative overflow-hidden rounded-[36px] border border-white/80 bg-white/80 p-6 text-slate-950 shadow-2xl shadow-slate-950/10 backdrop-blur-xl sm:p-10";

  const panelClass = isDarkMode
    ? "mx-auto w-full max-w-3xl scroll-mt-4 rounded-[32px] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8"
    : "mx-auto w-full max-w-3xl scroll-mt-4 rounded-[32px] border border-white/80 bg-white/75 p-5 shadow-2xl shadow-slate-950/10 backdrop-blur-xl sm:p-8";

  const resultPanelClass = isDarkMode
    ? "space-y-6 rounded-[28px] bg-slate-950 p-6 text-white sm:p-8 [&_button]:text-white"
    : "space-y-6 rounded-[28px] border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-slate-950/10 sm:p-8";

  const resultCardClass = isDarkMode
    ? "border-b border-white/10 py-4 text-white"
    : "border-b border-slate-200 py-4";

  const mutedTextClass = isDarkMode ? "text-[#D8CEC7]" : "text-slate-500";

  const eyebrowTextClass = isDarkMode ? "text-cyan-300" : "text-cyan-700";

  const secondaryButtonClass = isDarkMode
    ? "rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/15"
    : "rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800";

  const ghostButtonClass = isDarkMode
    ? "rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
    : "rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950";

  const themeButtonClass = (mode: ThemeMode) =>
    `rounded-full px-3 py-2 text-xs font-bold transition ${
      themeMode === mode
        ? isDarkMode
          ? "bg-cyan-300 text-slate-950"
          : "bg-slate-950 text-white"
        : isDarkMode
          ? "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
          : "bg-white/80 text-slate-600 hover:bg-white hover:text-slate-950"
    }`;

  const optionButtonClass = (isSelected: boolean, variant: "card" | "compact" = "card") => {
    const sizeClass = variant === "compact" ? "rounded-2xl px-4 py-3" : "rounded-[24px] p-5";

    return `${sizeClass} border text-left shadow-sm transition touch-manipulation hover:-translate-y-0.5 hover:shadow-md ${
      isSelected
        ? isDarkMode
          ? "border-cyan-300 bg-cyan-300/15 text-white"
          : "border-cyan-500 bg-cyan-100 text-slate-950"
        : isDarkMode
          ? "border-white/10 bg-white/10 text-white hover:bg-white/15"
          : "border-slate-200 bg-white/90 text-slate-950 hover:bg-slate-50"
    }`;
  };

  const inputClass = isDarkMode
    ? "rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-medium text-white shadow-sm outline-none transition placeholder:text-white/40 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
    : "rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-medium text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";

  const labelClass = isDarkMode ? "text-sm font-semibold text-white/70" : "text-sm font-semibold text-slate-600";

  const hintBoxClass = isDarkMode
    ? "mt-4 rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50 shadow-sm"
    : "mt-4 rounded-[22px] border border-cyan-200 bg-cyan-50/80 p-4 text-sm leading-6 text-slate-700 shadow-sm";

  const priorityHintBoxClass = isDarkMode
    ? "mt-2 rounded-[20px] border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50 shadow-sm animate-[fadeInUp_0.35s_ease-out]"
    : "mt-2 rounded-[20px] border border-cyan-200 bg-cyan-50/80 p-4 text-sm leading-6 text-slate-700 shadow-sm animate-[fadeInUp_0.35s_ease-out]";

  const backButtonClass = isDarkMode
    ? "mt-5 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/15"
    : "mt-5 w-full rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 font-bold text-slate-700 transition hover:bg-white hover:text-slate-950";

  const primaryButtonClass = isDarkMode
    ? "w-full rounded-2xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-white/50 disabled:shadow-none"
    : "w-full rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none";

  const contactPanelClass = isDarkMode
    ? "rounded-[24px] border border-lime-300/20 bg-gradient-to-br from-lime-300/10 to-white/5 p-5 text-white shadow-2xl shadow-lime-950/20"
    : "rounded-[24px] border border-lime-200 bg-gradient-to-br from-lime-50 to-white p-5 text-slate-950 shadow-2xl shadow-lime-100";

  const contactLabelClass = isDarkMode ? "text-sm font-semibold text-white/75" : "text-sm font-semibold text-slate-700";

  const contactInputClass = isDarkMode
    ? "mt-1 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-medium text-white outline-none transition placeholder:text-white/40 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
    : "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";

  const contactSubmitButtonClass = isDarkMode
    ? "mt-4 w-full rounded-2xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/50 disabled:shadow-none"
    : "mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none";

  const tariffHint = {
    G11: "Taryfa G11 nie wykorzystuje w pełni potencjału magazynów energii. Zalecane są taryfy G12/G13 lub taryfy dynamiczne. Nasz doradca pomoże wybrać Ci najlepsze rozwiązanie.",
    G12: "Taryfa G12 może dobrze współpracować z magazynem energii, szczególnie gdy część zużycia przesuwamy na tańsze godziny i lepiej zarządzamy energią w domu.",
    G13: "Taryfa G13 daje więcej możliwości optymalizacji pracy magazynu energii, bo pozwala lepiej dopasować ładowanie i zużycie do różnych stref cenowych.",
    other_unknown: "Jeżeli nie znasz taryfy albo masz mniej typową umowę, wybierz tę opcję. Doradca może później sprawdzić, czy obecna taryfa jest korzystna dla magazynu energii.",
  } satisfies Record<Exclude<Tariff, null>, string>;

  const settlementSystemHint: Record<Exclude<SettlementSystem, null>, string> = {
    net_metering:
      'System tzw. opustów, który obowiązuje dla instalacji założonych i zgłoszonych do 31.03.2022 roku. Polegał na tym, że operator sieci dystrybucyjnej przechowuje w "wirtualnym magazynie" od 70 do 80% nadwyżek przesłanej do sieci energii, w zależności od mocy instalacji fotowoltaicznej, umożliwiając jej późniejszy odbiór w kolejnych okresach rozliczeniowych.',
    net_billing:
      "System obowiązujący dla instalacji zainstalowanych i zgłoszonych od 01.04.2022 roku. W tym systemie nadwyżki energii są sprzedawane zakładowi energetycznemu po średnich cenach rynkowych, a energia pobrana z sieci jest kupowana po cenach dostawcy energii.",
    unknown:
      "Jeżeli nie masz pewności, w którym systemie rozliczana jest Twoja instalacja, wybierz tę opcję. Doradca może to później zweryfikować na podstawie daty zgłoszenia instalacji lub dokumentów od operatora.",
  };

  const priorityHint: Record<string, string> = {
    "Niższe rachunki":
      "Jedna z podstawowych ról magazynu energii to zwiększenie zużycia własnego prądu z fotowoltaiki. Dobrze skonfigurowany system sterowania może też wspierać sprzedaż energii w korzystniejszych godzinach, zamiast oddawania jej do sieci za bardzo niskie stawki.",
    "Awaryjne zasilanie domu w razie awarii":
      "Magazyn energii wyposażony w funkcję automatycznego zasilania awaryjnego może zasilać wybrane obwody domu podczas awarii sieci energetycznej. W prawidłowo dobranym systemie przełączenie na zasilanie z magazynu trwa zwykle mniej niż sekundę i jest praktycznie nieodczuwalne.",
    "Zwiększenie produktywności mojej instalacji fotowoltaicznej (zapobieganie wyłączeniom)":
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
      const elementTop = elementRect.top + window.scrollY;
      const targetY = Math.max(0, elementTop - 24);
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

  function startAnalysis() {
    setHasStarted(true);
    goToStep(2);

    window.setTimeout(() => {
      scrollToElement(formRef.current);
    }, 80);
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

  function selectSettlementSystem(value: Exclude<SettlementSystem, null>) {
    setSettlementSystem(value);
  }

  function selectTariff(value: Exclude<Tariff, null>) {
    setTariff(value);
    setShowResult(false);
  }

  function togglePriority(value: string) {
    setPriorities((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function toggleResultDetail(key: string) {
    setExpandedResultDetails((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function editAnswers() {
    setShowResult(false);
    setIsAnalyzing(false);
    setAnalysisStep(0);
    setShowDetailedResult(false);
    scrollToElement(formRef.current);
  }

  function restartCalculator() {
    setHasPv(null);
    setPvPower("");
    setSettlementSystem(null);
    setBillMode("monthly");
    setBillAmount("");
    setTariff(null);
    setShowResult(false);
    setIsAnalyzing(false);
    setAnalysisStep(0);
    setShowDetailedResult(false);
    setStep(2);
    setPriorities([]);
    setContactFirstName("");
    setContactLastName("");
    setContactPostalCode("");
    setContactPhone("");
    setContactEmail("");
    setMarketingConsent(false);
    setHoneypot("");
    setLeadSubmitStatus("idle");
    setHasStarted(false);
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
  const currentPvPowerKw = parseDecimal(pvPower);
  const estimatedGridConsumptionKwh = yearlyBill > 0 ? yearlyBill / ENERGY_PRICE_PER_KWH : 0;
  const estimatedPvProductionKwh = hasPv === "yes" && currentPvPowerKw > 0 ? currentPvPowerKw * PV_PRODUCTION_PER_KWP : 0;
  const preliminaryYearlyConsumptionKwh = estimatedGridConsumptionKwh + estimatedPvProductionKwh * NET_BILLING_BASE_AUTOCONSUMPTION_RATE;
  const baseAutoconsumptionRate =
    hasPv === "yes"
      ? getBaseAutoconsumptionRate({
          pvProductionKwh: estimatedPvProductionKwh,
          yearlyConsumptionKwh: preliminaryYearlyConsumptionKwh,
        })
      : NET_BILLING_BASE_AUTOCONSUMPTION_RATE;
  const estimatedSelfConsumedPvKwh =
    hasPv === "yes" ? estimatedPvProductionKwh * baseAutoconsumptionRate : 0;
  const estimatedExportedPvKwh =
    hasPv === "yes" ? Math.max(0, estimatedPvProductionKwh - estimatedSelfConsumedPvKwh) : 0;

  const netMeteringReturnRate = currentPvPowerKw > 10 ? 0.7 : 0.8;

  const estimatedReturnedFromNetMeteringKwh =
    hasPv === "yes" && settlementSystem === "net_metering"
      ? estimatedExportedPvKwh * netMeteringReturnRate
      : 0;

  const yearlyConsumptionKwh =
    hasPv === "yes"
      ? settlementSystem === "net_metering"
        ? estimatedGridConsumptionKwh +
          estimatedSelfConsumedPvKwh +
          estimatedReturnedFromNetMeteringKwh
        : estimatedGridConsumptionKwh + estimatedSelfConsumedPvKwh
      : estimatedGridConsumptionKwh;

    const result = useMemo(() => {
      if (!hasPv || yearlyBill <= 0) return null;

      const storageFromConsumption = getStorageFromConsumption(yearlyConsumptionKwh);
      const storageFromPv =
        hasPv === "yes" && currentPvPowerKw > 0
          ? pickStorageVariant(currentPvPowerKw * 2)
          : 0;
      const recommendedStorageKwh =
        hasPv === "yes"
          ? Math.max(storageFromConsumption, storageFromPv)
          : pickStorageVariant(getSuggestedPvKw(yearlyConsumptionKwh) * 2);
      let suggestedPvKw = getSuggestedPvKw(yearlyConsumptionKwh);

      if (
        hasPv === "yes" &&
        settlementSystem === "net_metering" &&
        currentPvPowerKw > 0 &&
        currentPvPowerKw < 10 &&
        suggestedPvKw > 10
      ) {
        const productionAt10Kw = 10 * PV_PRODUCTION_PER_KWP;
        const usableAt10Kw = productionAt10Kw * 0.8;

        const productionAtSuggestedKw = suggestedPvKw * PV_PRODUCTION_PER_KWP;
        const usableAtSuggestedKw = productionAtSuggestedKw * 0.7;

        const gainAfterCrossingThreshold = usableAtSuggestedKw - usableAt10Kw;

        if (gainAfterCrossingThreshold < 1500) {
          suggestedPvKw = 10;
        } else if (yearlyConsumptionKwh > 14000) {
          suggestedPvKw = Math.max(suggestedPvKw, 12);
        }
      }

      const coveragePercent =
        hasPv === "yes" && yearlyConsumptionKwh > 0
          ? Math.round((estimatedPvProductionKwh / yearlyConsumptionKwh) * 100)
          : 100;
      const shouldRecommendPvExpansion = hasPv === "yes" && coveragePercent < 70;
      const pvExpansionStorageKwh = pickStorageVariant(suggestedPvKw * 2);
      const pvExpansionPriceRange = getPvStorageMarketingPriceRange(suggestedPvKw, pvExpansionStorageKwh);

      const savingsRate = getSavingsRateRange({
        hasPv,
        settlementSystem,
        tariff,
        yearlyBill,
        recommendedStorageKwh,
      });

      const netBillingSavingsDetails =
        hasPv === "yes" && settlementSystem === "net_billing" && estimatedPvProductionKwh > 0
          ? getNetBillingStorageSavingsRange({
              pvProductionKwh: estimatedPvProductionKwh,
              yearlyConsumptionKwh,
              storageKwh: recommendedStorageKwh,
              baseAutoconsumptionRate,
            })
          : null;

      const netMeteringSavingsDetails =
        hasPv === "yes" && settlementSystem === "net_metering" && estimatedPvProductionKwh > 0
          ? getNetMeteringStorageSavingsRange({
              pvProductionKwh: estimatedPvProductionKwh,
              yearlyConsumptionKwh,
              storageKwh: recommendedStorageKwh,
              currentPvPowerKw,
              baseAutoconsumptionRate,
            })
          : null;

      const yearlySavingsLow = netBillingSavingsDetails
        ? netBillingSavingsDetails.low
        : netMeteringSavingsDetails
          ? netMeteringSavingsDetails.low
          : yearlyBill * savingsRate.low;
      const yearlySavingsHigh = netBillingSavingsDetails
        ? netBillingSavingsDetails.high
        : netMeteringSavingsDetails
          ? netMeteringSavingsDetails.high
          : yearlyBill * savingsRate.high;

      const baseCalculatorPriceWithoutSellerMarkup =
        hasPv === "yes"
          ? getOnlyStorageBasePriceWithoutSellerMarkup(recommendedStorageKwh)
          : getPvStorageBasePriceWithoutSellerMarkup(suggestedPvKw, recommendedStorageKwh);

      const [priceLow, priceHigh] =
        hasPv === "yes"
          ? getMarketingPriceRange(baseCalculatorPriceWithoutSellerMarkup)
          : getPvStorageMarketingPriceRange(suggestedPvKw, recommendedStorageKwh);

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
        estimatedPvProductionKwh,
        coveragePercent,
        shouldRecommendPvExpansion,
        pvExpansionStorageKwh,
        pvExpansionPriceRange,
        netBillingSavingsDetails,
        netMeteringSavingsDetails,
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
    }, [hasPv, currentPvPowerKw, estimatedPvProductionKwh, settlementSystem, tariff, yearlyBill, yearlyConsumptionKwh, priorities]);

  const hasValidPvDetails = hasPv !== "yes" || parseDecimal(pvPower) > 0;
const canCalculate = Boolean(
  hasPv &&
    yearlyBill > 0 &&
    hasValidPvDetails &&
    tariff &&
    (hasPv === "no" || settlementSystem) &&
    priorities.length > 0
);

const canSubmitLead = Boolean(
  contactFirstName.trim() &&
    contactPostalCode.length === 6 &&
    contactPhone.replace(/\D/g, "").length >= 9 &&
    marketingConsent &&
    turnstileToken &&
    result
);

  function handleCalculate() {
    if (!canCalculate) return;
    setIsAnalyzing(true);
    setShowResult(false);
    setAnalysisStep(0);
    setExpandedResultDetails({});
    setShowDetailedResult(false);

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
            turnstileToken,
            honeypot,
          },
          answers: {
            hasPv,
            pvPower: pvPower || null,
            settlementSystem,
            billMode,
            billAmount,
            yearlyBill,
            yearlyConsumptionKwh,
            estimatedGridConsumptionKwh,
            estimatedPvProductionKwh,
            estimatedSelfConsumedPvKwh,
            estimatedExportedPvKwh,
            estimatedReturnedFromNetMeteringKwh,
            baseAutoconsumptionRate,
            tariff,
            priorities,
          },
          result: {
            recommendationType: result.recommendation.type,
            recommendationTitle: result.recommendation.title,
            recommendedStorageKwh: result.recommendedStorageKwh,
            suggestedPvKw: hasPv === "no" ? result.suggestedPvKw : null,
            coveragePercent: result.coveragePercent,
            shouldRecommendPvExpansion: result.shouldRecommendPvExpansion,
            pvExpansionStorageKwh: result.pvExpansionStorageKwh,
            pvExpansionPriceLow: result.pvExpansionPriceRange[0],
            pvExpansionPriceHigh: result.pvExpansionPriceRange[1],
            yearlySavingsLow: result.yearlySavingsLow,
            yearlySavingsHigh: result.yearlySavingsHigh,
            netBillingSavingsDetails: result.netBillingSavingsDetails,
            netMeteringSavingsDetails: result.netMeteringSavingsDetails,
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
    <main className={pageClass}>
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex justify-end">
          <div className={`inline-flex rounded-full border p-1 shadow-sm backdrop-blur ${isDarkMode ? "border-white/10 bg-white/5" : "border-white/70 bg-white/60"}`}>
            <button type="button" onClick={() => changeThemeMode("auto")} className={themeButtonClass("auto")}>🌓 Auto</button>
            <button type="button" onClick={() => changeThemeMode("light")} className={themeButtonClass("light")}>☀️ Jasny</button>
            <button type="button" onClick={() => changeThemeMode("dark")} className={themeButtonClass("dark")}>🌙 Ciemny</button>
          </div>
        </div>
        <section className={heroClass}>
          <div
            className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${
              isDarkMode ? "opacity-[0.52]" : "opacity-[0.48]"
            }`}
            style={{
              backgroundImage: "url('/images/ess1.png')",
              filter: "blur(1px)",
              transform: "scale(1.01)",
            }}
          />
          <div
            className={`pointer-events-none absolute inset-0 ${
              isDarkMode
                ? "bg-gradient-to-r from-slate-950 via-slate-950/72 to-slate-950/28"
                : "bg-gradient-to-r from-white via-white/72 to-white/22"
            }`}
          />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-lime-300/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <p
              className={`mb-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold backdrop-blur ${
                isDarkMode
                  ? "border border-white/15 bg-white/10 text-cyan-200"
                  : "bg-white/70 text-[#1F9ABF]"
              }`}
            >
              Niezależna analiza opłacalności magazynu energii
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Czy magazyn energii naprawdę się opłaca?
            </h1>
            <p className={`mt-5 text-lg leading-8 ${isDarkMode ? "text-[#EDE6E0]" : "text-slate-600"}`}>
              Dla jednych domów magazyn energii może znacząco obniżyć rachunki za prąd i zwiększyć niezależność energetyczną. W innych przypadkach większy efekt może dać rozbudowa instalacji fotowoltaicznej albo zmiana sposobu wykorzystania energii.
              <br />
              <br />
              Odpowiedz na kilka prostych pytań, a kalkulator oszacuje potencjalne korzyści, sugerowaną pojemność magazynu energii oraz możliwy okres zwrotu inwestycji.
            </p>
            <div className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${
              isDarkMode
                ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-50"
                : "border-white/20 bg-white/15 text-slate-700 backdrop-blur-xl"
            }`}>
              <strong>Wynik może być zupełnie inny, niż zakładasz.</strong>
              <br />
              W ciągu kilkudziesięciu sekund sprawdzisz, czy magazyn energii ma szansę być opłacalny w Twoim domu oraz jaki wariant może mieć największy sens.
            </div>
            <a
              href="#analiza"
              onClick={(event) => {
                event.preventDefault();
                startAnalysis();
              }}
              className="mt-6 inline-flex rounded-2xl bg-gradient-to-r from-cyan-300 to-lime-300 px-6 py-4 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:brightness-105"
            >
              Rozpocznij analizę
            </a>
          </div>
        </section>

        {hasStarted && (
        <section className="grid gap-6">
          <div id="analiza" ref={formRef} className={panelClass}>
            {isAnalyzing ? (
              <div
                className={`flex min-h-[520px] flex-col justify-center rounded-[28px] p-6 sm:p-8 ${
                  isDarkMode
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-950/10"
                }`}
              >
                <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-cyan-200" : "text-cyan-600"}`}>
                  Analiza
                </p>
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
                            ? isDarkMode
                              ? "border-cyan-300/30 bg-cyan-300/15"
                              : "border-cyan-200 bg-cyan-50"
                            : isCurrent
                              ? isDarkMode
                                ? "border-white/20 bg-white/10"
                                : "border-slate-300 bg-slate-100"
                              : isDarkMode
                                ? "border-white/10 bg-white/5"
                                : "border-slate-200 bg-white"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            isDone
                              ? "bg-cyan-300 text-slate-950"
                              : isDarkMode
                                ? "bg-white/10 text-white/60"
                                : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {isDone ? "✓" : index + 1}
                        </span>
                        <span
                          className={
                            isDone
                              ? isDarkMode
                                ? "font-bold text-white"
                                : "font-bold text-slate-950"
                              : isDarkMode
                                ? "text-white/70"
                                : "text-slate-600"
                          }
                        >
                          {item}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : showResult && result ? (
              <div className={resultPanelClass}>
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${eyebrowTextClass}`}>
                    Twój wstępny wynik
                  </p>
                  <h2 className="mt-4 text-3xl font-bold">
                    Oto wynik analizy Twojej sytuacji
                  </h2>
                </div>

                <div className={`rounded-[24px] border p-5 ${getRecommendationBoxClass(result.recommendation.type)}`}>
                  <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${
                    result.recommendation.type === "recommended"
                      ? (isDarkMode ? "text-emerald-200" : "text-emerald-700")
                      : result.recommendation.type === "not_recommended"
                        ? (isDarkMode ? "text-rose-200" : "text-rose-700")
                        : (isDarkMode ? "text-amber-200" : "text-amber-700")
                  }`}>
                    {getRecommendationBadge(result.recommendation.type)}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold">{result.recommendation.title}</h3>
                  <p className={`mt-3 text-sm leading-6 ${mutedTextClass}`}>{result.recommendation.description}</p>
                  {(result.recommendation.type === "not_recommended" || (result.recommendation.type === "consider" && priorities.includes("Awaryjne zasilanie domu w razie awarii"))) && (
                    <div className={`mt-4 rounded-[18px] border p-4 text-sm leading-6 ${isDarkMode ? "border-white/10 bg-white/5 text-[#D8CEC7]" : "border-slate-200 bg-white/70 text-slate-600"}`}>
                      Nie oznacza to, że w Twoim domu nie da się poprawić kosztów energii. Może się okazać, że większy sens ma zmiana taryfy, korekta sposobu zużycia energii, optymalizacja pracy obecnej instalacji albo inne rozwiązanie. Warto omówić wynik z doradcą i sprawdzić, czy istnieje prostsza droga do obniżenia rachunków.
                    </div>
                  )}
                </div>

                <div>
  <button
    type="button"
    onClick={() => {
      setShowDetailedResult((current) => {
        const next = !current;

        if (next) {
          window.setTimeout(() => {
            scrollToElement(detailedReportRef.current);
          }, 80);
        }

        return next;
      });
    }}
    className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-lime-300 px-5 py-4 text-left text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:brightness-105"
  >
    <span className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-base font-extrabold">{showDetailedResult ? "Ukryj dokładny raport" : "Dokładny raport"}</span>
        <span className="mt-1 block text-xs font-semibold text-slate-800/75">
          {showDetailedResult ? "Schowaj szczegółowe liczby i założenia" : "Pokaż szczegółowe liczby i założenia"}
        </span>
      </span>
      <span aria-hidden="true" className="text-2xl font-extrabold">{showDetailedResult ? "↑" : "↓"}</span>
    </span>
  </button>

  {showDetailedResult && (
    <div ref={detailedReportRef} className="space-y-0">
                  <div className={resultCardClass}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>
                      {hasPv === "yes" ? "Szacowane całkowite zużycie energii" : "Szacowane roczne zużycie"}
                    </p>
                    <p className={isDarkMode ? "mt-1 text-2xl font-bold text-white" : "mt-1 text-2xl font-bold text-slate-950"}>{Math.round(yearlyConsumptionKwh).toLocaleString("pl-PL")} kWh</p>
                    {hasPv === "yes" && result.estimatedPvProductionKwh > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleResultDetail("usage")}
                          className={`mt-2 text-xs font-bold underline-offset-4 hover:underline ${isDarkMode ? "text-cyan-200" : "text-cyan-800"}`}
                        >
                          {expandedResultDetails.usage ? "Ukryj szczegóły" : "Rozwiń szczegóły"}
                        </button>
                        {expandedResultDetails.usage && (
                          <div className={`mt-3 px-4 py-3 ${isDarkMode ? "bg-white/5" : "bg-slate-100/80"}`}>
                            <p className={`text-xs leading-5 ${mutedTextClass}`}>
                              W tym około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(estimatedGridConsumptionKwh).toLocaleString("pl-PL")} kWh</strong> kupione z sieci oraz około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(estimatedSelfConsumedPvKwh).toLocaleString("pl-PL")} kWh</strong> zużyte bezpośrednio z obecnej instalacji fotowoltaicznej. Około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(estimatedExportedPvKwh).toLocaleString("pl-PL")} kWh</strong> traktujemy jako nadwyżkę oddaną do sieci.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {hasPv === "yes" && (
                    <div className={resultCardClass}>
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Twoja obecna instalacja fotowoltaiczna</p>
                      <p className={isDarkMode ? "mt-1 text-2xl font-bold text-cyan-300" : "mt-1 text-2xl font-bold text-cyan-700"}>
                        {pvPower ? `${pvPower} kWp` : "moc niepodana"}
                      </p>
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${isDarkMode ? "bg-cyan-300/10 text-cyan-300" : "bg-cyan-100 text-cyan-700"}`}>
                          {settlementSystem === "net_billing" ? "Net-billing" : settlementSystem === "net_metering" ? "Net-metering" : "System nieznany"}
                        </span>
                      </div>
                      <p className={`mt-2 text-sm ${mutedTextClass}`}>
                        Szacowana produkcja z fotowoltaiki: {Math.round(result.estimatedPvProductionKwh).toLocaleString("pl-PL")} kWh/rok
                      </p>
                      <p className={`mt-1 text-sm ${mutedTextClass}`}>
                        Szacowana autokonsumpcja bez magazynu: {Math.round(baseAutoconsumptionRate * 100)}% ({Math.round(estimatedSelfConsumedPvKwh).toLocaleString("pl-PL")} kWh/rok)
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleResultDetail("currentPv")}
                        className={`mt-2 text-xs font-bold underline-offset-4 hover:underline ${isDarkMode ? "text-cyan-200" : "text-cyan-800"}`}
                      >
                        {expandedResultDetails.currentPv ? "Ukryj szczegóły" : "Rozwiń szczegóły"}
                      </button>
                      {expandedResultDetails.currentPv && (
                        <div className={`mt-3 space-y-2 px-4 py-3 text-xs leading-5 ${mutedTextClass} ${isDarkMode ? "bg-white/5" : "bg-slate-100/80"}`}>
                          <p className={`mt-3 text-xs leading-5 ${mutedTextClass}`}>
                            Twoja instalacja fotowoltaiczna produkuje około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(result.estimatedPvProductionKwh).toLocaleString("pl-PL")} kWh</strong> energii rocznie, co odpowiada około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{result.coveragePercent}%</strong> rocznego zużycia energii w domu.
                          </p>
                          <p className={`mt-2 text-xs leading-5 ${mutedTextClass}`}>
                            Obecnie wykorzystujesz bezpośrednio około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(estimatedSelfConsumedPvKwh).toLocaleString("pl-PL")} kWh</strong> (<strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(baseAutoconsumptionRate * 100)}%</strong>) tej energii, a pozostałe około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(estimatedExportedPvKwh).toLocaleString("pl-PL")} kWh</strong> trafia do sieci.
                          </p>
                          <p className={`mt-2 text-xs font-semibold ${isDarkMode ? "text-cyan-200" : "text-cyan-700"}`}>
                            To właśnie ten obszar może poprawić magazyn energii, zwiększając wykorzystanie własnej produkcji zamiast oddawania jej do sieci.
                          </p>
                          {result.shouldRecommendPvExpansion && (
                            <p className={`mt-2 text-xs font-semibold ${isDarkMode ? "text-cyan-200" : "text-cyan-700"}`}>
                              Obecna instalacja fotowoltaiczna pokrywa mniej niż 70% szacowanego zapotrzebowania — warto sprawdzić wariant z rozbudową instalacji.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {hasPv === "no" && (
                    <div className={resultCardClass}>
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Sugerowana moc instalacji fotowoltaicznej</p>
                      <p className={isDarkMode ? "mt-1 text-2xl font-bold text-white" : "mt-1 text-2xl font-bold text-slate-950"}>około {result.suggestedPvKw} kWp</p>
                    </div>
                  )}
                  <div className={resultCardClass}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Sugerowany magazyn energii</p>
                    <p className={isDarkMode ? "mt-1 text-2xl font-bold text-cyan-300" : "mt-1 text-2xl font-bold text-cyan-700"}>około {result.recommendedStorageKwh} kWh</p>
                  </div>
                  <div className={resultCardClass}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Szacowana roczna korzyść</p>
                    <p className={isDarkMode ? "mt-1 text-2xl font-bold text-emerald-300" : "mt-1 text-2xl font-bold text-emerald-700"}>
                      {formatMoney(result.yearlySavingsLow)} – {formatMoney(result.yearlySavingsHigh)} / rok
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleResultDetail("yearlySavings")}
                      className={`mt-2 text-xs font-bold underline-offset-4 hover:underline ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`}
                    >
                      {expandedResultDetails.yearlySavings ? "Ukryj szczegóły" : "Rozwiń szczegóły"}
                    </button>

                    {expandedResultDetails.yearlySavings && (
                      result.netBillingSavingsDetails ? (
                        <div className={`mt-3 px-4 py-3 ${isDarkMode ? "bg-white/5" : "bg-slate-100/80"}`}>
                          <p className={`text-xs leading-5 ${mutedTextClass}`}>
                            Dla net-billingu przyjęliśmy około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(result.netBillingSavingsDetails.baseAutoconsumptionRate * 100)}%</strong> autokonsumpcji bez magazynu energii oraz około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{Math.round(result.netBillingSavingsDetails.autoconsumptionRateWithStorage * 100)}%</strong> autokonsumpcji z zastosowaniem magazynu energii i HEMS. Korzyść wynika z tego, że zamiast sprzedawać energię po około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{NET_BILLING_EXPORT_PRICE_PER_KWH.toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} zł/kWh</strong>, a następnie kupować ją po około <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{ENERGY_PRICE_PER_KWH.toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} zł/kWh</strong>, zużywasz większą część własnej energii na potrzeby domu.
                          </p>
                        </div>
                      ) : (
                        <div className={`mt-3 px-4 py-3 ${isDarkMode ? "bg-white/5" : "bg-slate-100/80"}`}>
                          <p className={`text-xs leading-5 ${mutedTextClass}`}>
                            {result.netMeteringSavingsDetails
      ? `Dla net-meteringu przyjęliśmy około ${Math.round(result.netMeteringSavingsDetails.baseAutoconsumptionRate * 100)}% autokonsumpcji bez magazynu energii oraz około ${Math.round(result.netMeteringSavingsDetails.autoconsumptionRateWithStorage * 100)}% autokonsumpcji z zastosowaniem magazynu energii i HEMS. W systemie opustów za każdą 1 kWh oddaną do sieci możesz odebrać około ${Math.round(result.netMeteringSavingsDetails.returnRate * 100)}% energii, dlatego magazyn poprawia wynik głównie przez ograniczenie tej straty i zwiększenie zużycia energii na miejscu.`
      : `To nawet około ${Math.round(result.savingsRateLow * 100)}–${Math.round(result.savingsRateHigh * 100)}% obecnych kosztów energii, w zależności od profilu zużycia i sposobu pracy instalacji.`}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                  <div className={resultCardClass}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Orientacyjny koszt inwestycji</p>
                    <p className={isDarkMode ? "mt-1 text-2xl font-bold text-white" : "mt-1 text-2xl font-bold text-slate-950"}>
                      {formatMoney(result.priceLow)} – {formatMoney(result.priceHigh)}
                    </p>
                  </div>
                  <div className={resultCardClass}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Możliwa dotacja</p>
                    <p className={isDarkMode ? "mt-1 text-2xl font-bold text-violet-300" : "mt-1 text-2xl font-bold text-violet-700"}>do {formatMoney(result.subsidyEstimate)}</p>
                  </div>
                  <div className={resultCardClass}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-cyan-300/80" : "text-cyan-700"}`}>Szacunkowy okres zwrotu inwestycji</p>
                    <p className={isDarkMode ? "mt-1 text-2xl font-bold text-amber-300" : "mt-1 text-2xl font-bold text-amber-700"}>
                      {result.paybackYearsLow === result.paybackYearsHigh
                        ? `około ${result.paybackYearsLow} ${result.paybackYearsLow === 1 ? "rok" : result.paybackYearsLow >= 2 && result.paybackYearsLow <= 4 ? "lata" : "lat"}`
                        : `${result.paybackYearsLow}–${result.paybackYearsHigh} lat`}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleResultDetail("payback")}
                      className={`mt-2 text-xs font-bold underline-offset-4 hover:underline ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`}
                    >
                      {expandedResultDetails.payback ? "Ukryj szczegóły" : "Rozwiń szczegóły"}
                    </button>
                    {expandedResultDetails.payback && (
                      <div className={`mt-3 px-4 py-3 ${isDarkMode ? "bg-white/5" : "bg-slate-100/80"}`}>
                        <p className={`text-xs leading-5 ${mutedTextClass}`}>
                          Szacunek opiera się na wstępnych cenach inwestycji z uwzględnieniem dotacji oraz prognozowanym wzroście ceny energii o <strong className={isDarkMode ? "text-white" : "text-slate-900"}>11% rok do roku, co jest zgodnie ze wzrostami z ostatnich pięciu pełnych lat (2020-2025)</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={editAnswers}
                    className={`w-full rounded-2xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${isDarkMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-slate-800 hover:bg-slate-200"}`}
                  >
                    Popraw odpowiedzi
                  </button>
                  <button
                    type="button"
                    onClick={restartCalculator}
                    className={`w-full rounded-2xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${isDarkMode ? "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950"}`}
                  >
                    Zacznij od początku
                  </button>
                </div>

                <div className={contactPanelClass}>
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isDarkMode ? "text-lime-300" : "text-lime-700"}`}>
                    Bezpłatna konsultacja
                  </p>
                  <p className="mt-3 text-xl font-bold">Bezpłatna konsultacja z doradcą</p>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>
                    Zostaw kontakt, a sprawdzimy Twój przypadek dokładniej i zweryfikujemy możliwości uzyskania dotacji.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={contactLabelClass}>Imię *</span>
                      <input
                        value={contactFirstName}
                        onChange={(event) => setContactFirstName(event.target.value)}
                        placeholder="np. Jan"
                        className={contactInputClass}
                      />
                    </label>

                    <label className="block">
                      <span className={contactLabelClass}>Nazwisko</span>
                      <input
                        value={contactLastName}
                        onChange={(event) => setContactLastName(event.target.value)}
                        placeholder="np. Kowalski"
                        className={contactInputClass}
                      />
                    </label>

                    <label className="block">
                      <span className={contactLabelClass}>Kod pocztowy *</span>
                      <input
                        value={contactPostalCode}
                        onChange={(event) => {
                          const value = event.target.value.replace(/[^0-9-]/g, "").slice(0, 6);
                          setContactPostalCode(value);
                        }}
                        placeholder="np. 25-015"
                        className={contactInputClass}
                      />
                    </label>

                    <label className="block">
                      <span className={contactLabelClass}>Telefon *</span>
                      <input
                        value={contactPhone}
                        onChange={(event) => setContactPhone(event.target.value)}
                        inputMode="tel"
                        placeholder="np. 500 600 700"
                        className={contactInputClass}
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className={contactLabelClass}>E-mail</span>
                      <input
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        inputMode="email"
                        placeholder="opcjonalnie — wyślemy kopię analizy"
                        className={contactInputClass}
                      />
                    </label>

                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        opacity: 0,
                        pointerEvents: "none",
                      }}
                    >
                      <input
                        type="text"
                        name="website"
                        autoComplete="off"
                        tabIndex={-1}
                        value={honeypot}
                        onChange={(event) => setHoneypot(event.target.value)}
                      />
                    </div>
                    <label className={`sm:col-span-2 flex items-start gap-3 rounded-xl border p-3 ${isDarkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70"}`}>
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(event) => setMarketingConsent(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <span className={`text-xs leading-5 ${mutedTextClass}`}>
                        Wyrażam zgodę na przetwarzanie podanych danych kontaktowych w celu kontaktu ze strony doradcy IdeaSol, marki handlowej firmy Marketing i Promocja Sp. z o.o. z siedzibą w Kielcach, w związku z analizą zapotrzebowania na magazyn energii oraz przedstawieniem informacji handlowych dotyczących oferowanych rozwiązań energetycznych.
                      </span>
                    </label>
                  </div>

                  <div className="mt-4 flex justify-center">
                    {turnstileSiteKey ? (
                      <div ref={turnstileRef} />
                    ) : (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        Brak konfiguracji Turnstile (NEXT_PUBLIC_TURNSTILE_SITE_KEY).
                      </div>
                    )}
                  </div>
                  {!turnstileToken && (
                    <p className={`mt-3 text-center text-xs ${mutedTextClass}`}>
                      Potwierdź zabezpieczenie antyspamowe, aby wysłać zgłoszenie.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={submitLead}
                    disabled={!canSubmitLead || isSubmittingLead}
                    className={contactSubmitButtonClass}
                  >
                    {isSubmittingLead ? "Wysyłamy zgłoszenie..." : "Skonsultuj wynik z doradcą"}
                  </button>

                  {leadSubmitStatus === "success" && (
                    <p className={`mt-3 rounded-2xl p-3 text-sm font-semibold ${isDarkMode ? "bg-emerald-300/10 text-emerald-100" : "bg-emerald-50 text-emerald-700"}`}>
                      Zgłoszenie zostało przyjęte. Doradca IdeaSol skontaktuje się z Tobą możliwie szybko. Jeżeli podałeś adres e-mail, otrzymasz również kopię analizy.
                    </p>
                  )}

                  {leadSubmitStatus === "error" && (
                    <p className={`mt-3 rounded-2xl p-3 text-sm font-semibold ${isDarkMode ? "bg-rose-300/10 text-rose-100" : "bg-rose-50 text-rose-700"}`}>
                      Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.
                    </p>
                  )}
                </div>

                <div className={`pt-2 text-xs leading-5 ${isDarkMode ? "text-[#D8CEC7]" : "text-slate-600"}`}>
                  Wynik ma charakter orientacyjny i został przygotowany na podstawie danych podanych przez użytkownika, średnich cen zakupu i odsprzedaży energii w Polsce oraz statystyk dotyczących historycznego wzrostu cen energii. Dokładna analiza wymaga dodatkowo znajomości profilu zużycia energii, parametrów instalacji fotowoltaicznej, warunków technicznych budynku oraz potwierdzenia możliwości uzyskania dotacji.
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {step === 2 && (
                  <div>
                    <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${eyebrowTextClass}`}>Krok 1</p>
                    <h2 className="mt-3 text-2xl font-bold">Czy masz już instalację fotowoltaiczną?</h2>
                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onPointerUp={() => selectHasPv("yes")}
                        className={optionButtonClass(hasPv === "yes")}
                      >
                        <span className="block text-lg font-bold">Tak, mam instalację fotowoltaiczną i chcę dobrać do niej magazyn energii</span>
                        <span className={`mt-1 block text-sm ${mutedTextClass}`}>Sprawdzimy pojemność magazynu, oszczędności i możliwą dotację.</span>
                      </button>
                      <button
                        type="button"
                        onPointerUp={() => selectHasPv("no")}
                        className={optionButtonClass(hasPv === "no")}
                      >
                        <span className="block text-lg font-bold">Nie, ale chcę mieć fotowoltaikę wraz z magazynem energii</span>
                        <span className={`mt-1 block text-sm ${mutedTextClass}`}>Oszacujemy moc instalacji fotowoltaicznej i magazynu energii na podstawie Twojego zużycia.</span>
                      </button>
                    </div>
                  </div>
                )}

                {hasPv === "yes" && step === 3 && (
                  <div ref={pvDetailsRef} className={`scroll-mt-6 rounded-[28px] border p-5 backdrop-blur animate-[fadeInUp_0.45s_ease-out] ${isDarkMode ? "border-white/10 bg-white/5 shadow-inner shadow-black/20" : "border-slate-200 bg-white/55 shadow-inner shadow-white/70"}`}>
                    <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${eyebrowTextClass}`}>Krok 2</p>
                    <h2 className="mt-3 text-2xl font-bold">Podaj szczegóły obecnej instalacji</h2>

                    <div className="mt-5 grid gap-4">
                      <label className="block">
                        <span className={labelClass}>Moc obecnej instalacji fotowoltaicznej</span>
                        <div className="mt-2 flex items-center gap-3">
                          <input
                            value={pvPower}
                            onChange={(event) => setPvPower(event.target.value.replace(",", "."))}
                            inputMode="decimal"
                            placeholder="np. 8.5"
                            className={`w-full ${inputClass}`}
                          />
                          <span className={`font-bold ${isDarkMode ? "text-white/70" : "text-slate-600"}`}>kWp</span>
                        </div>
                      </label>

                      <div>
                        <p className={labelClass}>W jakim systemie rozliczasz energię?</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {[
                            ["net_billing", "net-billing", "tzw. nowe zasady"],
                            ["net_metering", "net-metering", "tzw. stare zasady"],
                            ["unknown", "Nie wiem", "sprawdzimy to później"],
                          ].map(([value, label, subtitle]) => (
                            <button
                              key={value}
                              type="button"
                              onPointerUp={() => selectSettlementSystem(value as Exclude<SettlementSystem, null>)}
                              className={`${optionButtonClass(settlementSystem === value, "compact")} font-semibold`}
                            >
                              <span className="block">{label}</span>
                              {subtitle && (
                                <span className={`mt-1 block text-xs font-normal ${isDarkMode ? "text-white/60" : "text-slate-500"}`}>
                                  {subtitle}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        {settlementSystem && (
                          <div className={hintBoxClass}>
                            <span className={isDarkMode ? "font-bold text-white" : "font-bold text-slate-950"}>Wskazówka:</span> {settlementSystemHint[settlementSystem]}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        goToStep(4);
                        scrollToElement(formRef.current);
                      }}
                      disabled={!hasValidPvDetails || !settlementSystem}
                      className={`mt-5 ${primaryButtonClass}`}
                    >
                      Dalej
                    </button>
                    <button type="button" onClick={goBack} className={backButtonClass}>
                      Wstecz
                    </button>
                  </div>
                )}

                {step === 4 && (
                  <div ref={step4Ref}>
                    <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${eyebrowTextClass}`}>Krok {hasPv === "yes" ? "3" : "2"}</p>
                    <h2 className="mt-3 text-2xl font-bold">Jaki masz rachunek za energię?</h2>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[160px_1fr]">
                      <select value={billMode} onChange={(event) => setBillMode(event.target.value as BillMode)} className={inputClass}>
                        <option value="monthly">miesięcznie</option>
                        <option value="yearly">rocznie</option>
                      </select>
                      <input
                        value={billAmount}
                        onChange={(event) => setBillAmount(event.target.value.replace(",", "."))}
                        inputMode="decimal"
                        placeholder="np. 350"
                        className={inputClass}
                      />
                    </div>
                    <p className={`mt-2 text-sm ${mutedTextClass}`}>Podaj kwotę brutto z rachunku. Na tej podstawie oszacujemy zużycie energii.</p>
                    <button
                      type="button"
                      onClick={() => {
                        goToStep(5);
                        scrollToElement(formRef.current);
                      }}
                      disabled={yearlyBill <= 0}
                      className={`mt-3 ${primaryButtonClass}`}
                    >
                      Dalej
                    </button>
                    <button type="button" onClick={goBack} className={backButtonClass}>
                      Wstecz
                    </button>
                  </div>
                )}

                {step === 5 && (
                  <div ref={step5Ref}>
                    <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${eyebrowTextClass}`}>Krok {hasPv === "yes" ? "4" : "3"}</p>
                    <h2 className="mt-3 text-2xl font-bold">Z jakiej taryfy korzystasz?</h2>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {[
                        ["G11", "G11 — stała cena energii"],
                        ["G12", "G12 — dwie strefy"],
                        ["G13", "G13 — trzy strefy"],
                        ["other_unknown", "Inna / nie wiem"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onPointerUp={() => selectTariff(value as Exclude<Tariff, null>)}
                          className={`${optionButtonClass(tariff === value, "compact")} font-semibold`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {tariff && (
                      <div className={hintBoxClass}>
                        <span className={isDarkMode ? "font-bold text-white" : "font-bold text-slate-950"}>Wskazówka:</span> {tariffHint[tariff]}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!tariff}
                      onClick={() => {
                        goToStep(6);
                        scrollToElement(formRef.current);
                      }}
                      className={`mt-3 ${primaryButtonClass}`}
                    >
                      Dalej
                    </button>
                    <button type="button" onClick={goBack} className={backButtonClass}>
                      Wstecz
                    </button>
                  </div>
                )}

                {step === 6 && (
                  <div>
                    <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${eyebrowTextClass}`}>Krok {hasPv === "yes" ? "5" : "4"}</p>
                    <h2 className="mt-3 text-2xl font-bold">Co jest dla Ciebie najważniejsze?</h2>
                    <div className="mt-5 grid gap-3">
                      {Object.keys(priorityHint)
                        .filter((item) => hasPv === "yes" || item !== "Zwiększenie produktywności mojej instalacji fotowoltaicznej (zapobieganie wyłączeniom)")
                        .map((item) => (
                        <div key={item}>
                          <button
                            type="button"
                            onPointerUp={() => togglePriority(item)}
                            className={`w-full ${optionButtonClass(priorities.includes(item), "compact")} font-semibold`}
                          >
                            {item}
                          </button>
                          {priorities.includes(item) && (
                            <div className={priorityHintBoxClass}>
                              <span className={isDarkMode ? "font-bold text-white" : "font-bold text-slate-950"}>Wskazówka:</span> {priorityHint[item]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      ref={step6Ref}
                      type="button"
                      onClick={handleCalculate}
                      disabled={!canCalculate}
                      className="mt-3 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-lime-300 px-6 py-4 text-lg font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
                    >
                      Dokonaj analizy
                    </button>
                    <button type="button" onClick={goBack} className={backButtonClass}>
                      Wstecz
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        )}
      </div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setIsTurnstileLoaded(true)}
      />
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
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