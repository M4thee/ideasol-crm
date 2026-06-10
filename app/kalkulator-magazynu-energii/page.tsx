"use client";

import { useMemo, useRef, useState } from "react";

type HasPv = "yes" | "no" | null;
type Tariff = "G11" | "G12" | "G13" | "dynamic" | "unknown";
type BillMode = "monthly" | "yearly";

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

export default function EnergyStorageCalculatorPage() {
  const [hasPv, setHasPv] = useState<HasPv>(null);
  const [billMode, setBillMode] = useState<BillMode>("monthly");
  const [billAmount, setBillAmount] = useState("");
  const [tariff, setTariff] = useState<Tariff>("unknown");
  const [wantsBackup, setWantsBackup] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [step, setStep] = useState(2);
  const [priority, setPriority] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement | null>(null);

  function goToStep(nextStep: number) {
    setStep(nextStep);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function selectHasPv(value: Exclude<HasPv, null>) {
    setHasPv(value);
    setShowResult(false);
    goToStep(3);
  }

  function selectTariff(value: Tariff) {
    setTariff(value);
    setShowResult(false);
    goToStep(5);
  }

  function selectPriority(value: string) {
    setPriority(value);
    goToStep(6);
  }

  const billValue = Number(String(billAmount).replace(",", ".")) || 0;
  const yearlyBill = billMode === "monthly" ? billValue * 12 : billValue;
  const yearlyConsumptionKwh = yearlyBill > 0 ? yearlyBill / ENERGY_PRICE_PER_KWH : 0;

  const result = useMemo(() => {
    if (!hasPv || yearlyBill <= 0) return null;

    const recommendedStorageKwh = clamp(Math.ceil(yearlyConsumptionKwh / 900) * 2, 5, 15);
    const suggestedPvKw = clamp(Math.round((yearlyConsumptionKwh / 1000) * 10) / 10, 4, 12);

    const yearlySavingsLow = hasPv === "yes" ? yearlyBill * 0.22 : yearlyBill * 0.55;
    const yearlySavingsHigh = hasPv === "yes" ? yearlyBill * 0.38 : yearlyBill * 0.78;

    const storagePriceLow = recommendedStorageKwh * 2600;
    const storagePriceHigh = recommendedStorageKwh * 3400;
    const pvPriceLow = suggestedPvKw * 3600;
    const pvPriceHigh = suggestedPvKw * 4700;

    const priceLow = hasPv === "yes" ? storagePriceLow : storagePriceLow + pvPriceLow;
    const priceHigh = hasPv === "yes" ? storagePriceHigh : storagePriceHigh + pvPriceHigh;

    const subsidyEstimate = Math.min(recommendedStorageKwh * 800, tariff === "G11" ? 8000 : 16000);

    return {
      recommendedStorageKwh,
      suggestedPvKw,
      yearlySavingsLow,
      yearlySavingsHigh,
      priceLow,
      priceHigh,
      subsidyEstimate,
    };
  }, [hasPv, tariff, yearlyBill, yearlyConsumptionKwh]);

  const canCalculate = Boolean(hasPv && yearlyBill > 0);

  function handleCalculate() {
    if (!canCalculate) return;
    setShowResult(true);
    window.setTimeout(() => {
      formRef.current?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <main className="min-h-screen bg-[#F7F2EA] px-4 py-8 text-[#24140F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="rounded-[32px] bg-white p-6 shadow-sm sm:p-10">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full bg-[#CCEBE6] px-4 py-2 text-sm font-semibold text-[#16433D]">
              Kalkulator IdeaSol
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Czy magazyn energii ma sens w Twoim domu?
            </h1>
            <p className="mt-5 text-lg leading-8 text-[#5F514C]">
              Odpowiedz na kilka pytań i sprawdź potencjalne oszczędności, sugerowaną pojemność magazynu energii oraz możliwą dotację.
            </p>
            <a
              href="#analiza"
              onClick={() => goToStep(2)}
              className="mt-6 inline-flex rounded-2xl bg-[#16433D] px-6 py-4 font-bold text-white"
            >
              Rozpocznij analizę
            </a>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div id="analiza" ref={formRef} className="scroll-mt-4 rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-8">
              {step >= 2 && (
                <div>
                  <h2 className="text-xl font-bold">1. Czy masz już fotowoltaikę?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onPointerUp={() => selectHasPv("yes")}
                      className={`rounded-2xl border p-5 text-left transition touch-manipulation ${
                        hasPv === "yes" ? "border-[#16433D] bg-[#CCEBE6]" : "border-[#E7DDD4] bg-white hover:bg-[#FAF7F2]"
                      }`}
                    >
                      <span className="block text-lg font-bold">Tak, mam PV</span>
                      <span className="mt-1 block text-sm text-[#6B5E58]">Chcę sprawdzić magazyn energii.</span>
                    </button>
                    <button
                      type="button"
                      onPointerUp={() => selectHasPv("no")}
                      className={`rounded-2xl border p-5 text-left transition touch-manipulation ${
                        hasPv === "no" ? "border-[#16433D] bg-[#CCEBE6]" : "border-[#E7DDD4] bg-white hover:bg-[#FAF7F2]"
                      }`}
                    >
                      <span className="block text-lg font-bold">Nie mam PV</span>
                      <span className="mt-1 block text-sm text-[#6B5E58]">Chcę sprawdzić PV + magazyn.</span>
                    </button>
                  </div>
                </div>
              )}

              {step >= 3 && (
                <div>
                  <h2 className="text-xl font-bold">2. Ile płacisz za prąd?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
                    <select
                      value={billMode}
                      onChange={(event) => {
                        setBillMode(event.target.value as BillMode);
                        setShowResult(false);
                      }}
                      className="rounded-2xl border border-[#E7DDD4] bg-white px-4 py-3 font-medium outline-none focus:border-[#16433D]"
                    >
                      <option value="monthly">Miesięcznie</option>
                      <option value="yearly">Rocznie</option>
                    </select>
                    <input
                      value={billAmount}
                      onChange={(event) => {
                        setBillAmount(event.target.value);
                        setShowResult(false);
                        if (event.target.value.trim() !== "") {
                          goToStep(4);
                        }
                      }}
                      inputMode="decimal"
                      placeholder={billMode === "monthly" ? "np. 350" : "np. 4200"}
                      className="rounded-2xl border border-[#E7DDD4] bg-white px-4 py-3 font-medium outline-none focus:border-[#16433D]"
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#7C6D66]">
                    Na potrzeby wstępnej analizy przeliczamy rachunek na szacunkowe roczne zużycie energii.
                  </p>
                </div>
              )}

              {step >= 4 && (
                <div>
                  <h2 className="text-xl font-bold">3. Jaką masz taryfę?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ["G11", "Stała"],
                      ["G12", "Dzień/noc"],
                      ["G13", "Trzystrefowa"],
                      ["dynamic", "Dynamiczna"],
                      ["unknown", "Nie wiem"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onPointerUp={() => selectTariff(value as Tariff)}
                        className={`rounded-2xl border px-4 py-3 text-left font-semibold transition touch-manipulation ${
                          tariff === value ? "border-[#16433D] bg-[#CCEBE6]" : "border-[#E7DDD4] bg-white hover:bg-[#FAF7F2]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step >= 5 && (
                <div>
                  <h2 className="text-xl font-bold">4. Co jest dla Ciebie najważniejsze?</h2>
                  <div className="mt-4 grid gap-3">
                    {[
                      "Niższe rachunki",
                      "Prąd podczas awarii",
                      "Maksymalna dotacja",
                      "Chcę sprawdzić czy to ma sens",
                    ].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onPointerUp={() => selectPriority(item)}
                        className={`rounded-2xl border p-4 text-left font-semibold touch-manipulation ${
                          priority === item ? "border-[#16433D] bg-[#CCEBE6]" : "border-[#E7DDD4]"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step >= 6 && (
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={!canCalculate}
                  className="w-full rounded-2xl bg-[#16433D] px-6 py-4 text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-[#B8ADA6]"
                >
                  Pokaż wstępny wynik
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-[28px] bg-[#24140F] p-6 text-white shadow-sm sm:p-8">
            {!showResult || !result ? (
              <div className="flex h-full min-h-[420px] flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#CCEBE6]">Wynik</p>
                  <h2 className="mt-4 text-3xl font-bold">Odpowiedz na kilka pytań, a pokażemy wstępną analizę.</h2>
                  <p className="mt-4 text-[#D8CEC7]">
                    Nie pokazujemy jednej sztywnej ceny bez kontekstu. Najpierw liczymy, czy inwestycja może realnie pomóc obniżyć rachunki.
                  </p>
                </div>
                <div className="mt-8 rounded-2xl bg-white/10 p-5 text-sm text-[#EDE6E0]">
                  Wynik ma charakter orientacyjny. Szczegółowa wycena wymaga weryfikacji zużycia, instalacji, przyłącza i warunków montażu.
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#CCEBE6]">Twój wstępny wynik</p>
                  <h2 className="mt-4 text-3xl font-bold">
                    {hasPv === "yes" ? "Magazyn energii może mieć sens" : "PV + magazyn energii może mieć sens"}
                  </h2>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-[#D8CEC7]">Szacowane roczne zużycie</p>
                    <p className="mt-1 text-2xl font-bold">{Math.round(yearlyConsumptionKwh).toLocaleString("pl-PL")} kWh</p>
                  </div>
                  {hasPv === "no" && (
                    <div className="rounded-2xl bg-white/10 p-5">
                      <p className="text-sm text-[#D8CEC7]">Sugerowana moc PV</p>
                      <p className="mt-1 text-2xl font-bold">około {result.suggestedPvKw} kWp</p>
                    </div>
                  )}
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-[#D8CEC7]">Sugerowany magazyn energii</p>
                    <p className="mt-1 text-2xl font-bold">około {result.recommendedStorageKwh} kWh</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-[#D8CEC7]">Szacowana dodatkowa oszczędność</p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatMoney(result.yearlySavingsLow)} – {formatMoney(result.yearlySavingsHigh)} / rok
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-[#D8CEC7]">Orientacyjny koszt inwestycji</p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatMoney(result.priceLow)} – {formatMoney(result.priceHigh)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-sm text-[#D8CEC7]">Możliwa dotacja</p>
                    <p className="mt-1 text-2xl font-bold">do {formatMoney(result.subsidyEstimate)}</p>
                  </div>
                </div>

                {wantsBackup && (
                  <div className="rounded-2xl bg-[#CCEBE6] p-5 text-[#16433D]">
                    <p className="font-bold">Backup awaryjny</p>
                    <p className="mt-1 text-sm">
                      Przygotujemy wariant z zasilaniem awaryjnym wybranych obwodów domu.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl bg-white p-5 text-[#24140F]">
                  <p className="text-lg font-bold">Chcesz dostać dokładniejszą analizę?</p>
                  <p className="mt-2 text-sm text-[#6B5E58]">
                    W kolejnym kroku dodamy formularz kontaktowy i zapis leada bezpośrednio do CRM IdeaSol.
                  </p>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-2xl bg-[#16433D] px-5 py-3 font-bold text-white"
                  >
                    Poproś o kontakt doradcy
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}