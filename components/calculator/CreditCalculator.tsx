"use client";

import { useEffect, useMemo, useState } from "react";

import {
  calculateCreditInstallment,
  parseMoneyInput,
  validateCreditAmount,
  type CreditBank,
  type CreditOffer,
} from "@/lib/calculator/creditCalculator";
import { getCreditBankLogoUrl } from "@/lib/calculator/creditBankLogo";
import {
  canUseLocalCreditCatalog,
  LOCAL_CREDIT_CATALOG_EVENT,
  readLocalCreditCatalog,
} from "@/lib/calculator/localCreditCatalog";
import { supabase } from "@/lib/supabase";

type CreditCalculatorProps = {
  installationPrice: number;
  compact?: boolean;
  expanded?: boolean;
};

const moneyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeBank(row: Record<string, unknown>): CreditBank {
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    logo_path: row.logo_path ? String(row.logo_path) : null,
    display_order: Number(row.display_order || 0),
    active: Boolean(row.active),
  };
}

function normalizeOffer(row: Record<string, unknown>): CreditOffer {
  return {
    id: Number(row.id),
    bank_id: Number(row.bank_id),
    name: String(row.name || ""),
    min_term_months: Number(row.min_term_months),
    max_term_months: Number(row.max_term_months),
    min_amount: Number(row.min_amount),
    max_amount: Number(row.max_amount),
    interest_rate_type: row.interest_rate_type === "annual_nominal" ? "annual_nominal" : "monthly_flat",
    interest_rate: Number(row.interest_rate),
    active: Boolean(row.active),
  };
}

export default function CreditCalculator({ installationPrice, compact = false, expanded = false }: CreditCalculatorProps) {
  const [banks, setBanks] = useState<CreditBank[]>([]);
  const [offers, setOffers] = useState<CreditOffer[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [downPaymentInput, setDownPaymentInput] = useState("0");
  const [termMonths, setTermMonths] = useState(12);
  const [status, setStatus] = useState("Ładowanie ofert kredytowych...");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  useEffect(() => {
    let isCurrent = true;

    function applyCatalog(nextBanks: CreditBank[], nextOffers: CreditOffer[], localMode = false) {
      const activeBanks = nextBanks
        .filter((bank) => bank.active)
        .sort((first, second) => first.display_order - second.display_order || first.name.localeCompare(second.name));
      const activeOffers = nextOffers.filter((offer) => offer.active);
      const firstBank = activeBanks.find((bank) =>
        activeOffers.some((offer) => offer.bank_id === bank.id)
      );
      const firstOffer = activeOffers.find((offer) => offer.bank_id === firstBank?.id);

      setBanks(activeBanks);
      setOffers(activeOffers);
      setSelectedBankId(firstBank?.id ?? null);
      setSelectedOfferId(firstOffer?.id ?? null);
      setTermMonths(firstOffer?.min_term_months ?? 12);
      setStatus(localMode
        ? activeBanks.length === 0
          ? "Tryb lokalny: dodaj bank i ofertę w panelu administratora."
          : ""
        : activeBanks.length === 0
          ? "Administrator nie dodał jeszcze aktywnych banków."
          : "");
    }

    async function loadCreditCatalog() {
      setStatus("Ładowanie ofert kredytowych...");
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      try {
        const catalogRequest = Promise.all([
          supabase
            .from("credit_banks")
            .select("id, name, logo_path, display_order, active")
            .eq("active", true)
            .order("display_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase
            .from("credit_offers")
            .select("id, bank_id, name, min_term_months, max_term_months, min_amount, max_amount, interest_rate_type, interest_rate, active")
            .eq("active", true)
            .order("name", { ascending: true }),
        ]);
        const timeoutRequest = new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Przekroczono czas pobierania katalogu finansowania.")), 4000);
        });
        const [banksResult, offersResult] = await Promise.race([catalogRequest, timeoutRequest]);

        if (!isCurrent) return;

        if (banksResult.error || offersResult.error) {
          throw new Error(banksResult.error?.message || offersResult.error?.message || "Nie udało się pobrać katalogu finansowania.");
        }

        const nextBanks = (banksResult.data || []).map((row) => normalizeBank(row));
        const nextOffers = (offersResult.data || []).map((row) => normalizeOffer(row));
        applyCatalog(nextBanks, nextOffers);
      } catch (error) {
        if (!isCurrent) return;
        if (canUseLocalCreditCatalog()) {
          console.warn("Katalog Supabase jest niedostępny — używam lokalnych danych finansowania.", error);
          const localCatalog = readLocalCreditCatalog();
          applyCatalog(localCatalog.banks, localCatalog.offers, true);
          return;
        }
        console.error("Błąd ładowania ofert kredytowych", error);
        setStatus("Nie udało się pobrać ofert kredytowych. Spróbuj ponownie później.");
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    void loadCreditCatalog();

    function handleLocalCatalogUpdate() {
      if (!isCurrent) return;
      const localCatalog = readLocalCreditCatalog();
      applyCatalog(localCatalog.banks, localCatalog.offers, true);
    }

    window.addEventListener(LOCAL_CREDIT_CATALOG_EVENT, handleLocalCatalogUpdate);

    return () => {
      isCurrent = false;
      window.removeEventListener(LOCAL_CREDIT_CATALOG_EVENT, handleLocalCatalogUpdate);
    };
  }, []);

  const selectedBankOffers = useMemo(
    () => offers.filter((offer) => offer.bank_id === selectedBankId),
    [offers, selectedBankId]
  );
  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === selectedOfferId) ?? null,
    [offers, selectedOfferId]
  );
  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === selectedBankId) ?? null,
    [banks, selectedBankId]
  );

  const downPayment = parseMoneyInput(downPaymentInput);
  const creditAmount = Number.isFinite(downPayment)
    ? installationPrice - downPayment
    : Number.NaN;
  const downPaymentError = !Number.isFinite(downPayment)
    ? "Wpisz prawidłową kwotę wkładu własnego."
    : downPayment < 0
      ? "Wkład własny nie może być ujemny."
      : downPayment > installationPrice
        ? "Wkład własny nie może przekraczać ceny instalacji."
        : null;
  const amountError = selectedOffer && !downPaymentError
    ? validateCreditAmount(creditAmount, selectedOffer)
    : null;
  const termError = selectedOffer && (
    termMonths < selectedOffer.min_term_months || termMonths > selectedOffer.max_term_months
  )
    ? `Okres musi mieścić się w przedziale ${selectedOffer.min_term_months}–${selectedOffer.max_term_months} miesięcy.`
    : null;
  const calculation = selectedOffer && !downPaymentError && !amountError && !termError
    ? calculateCreditInstallment(
        creditAmount,
        selectedOffer.interest_rate,
        termMonths,
        selectedOffer.interest_rate_type
      )
    : null;

  function selectBank(bankId: number) {
    const firstOffer = offers.find((offer) => offer.bank_id === bankId) ?? null;

    setSelectedBankId(bankId);
    setSelectedOfferId(firstOffer?.id ?? null);
    setTermMonths(firstOffer?.min_term_months ?? 12);
  }

  function selectOffer(offerId: number) {
    const offer = offers.find((item) => item.id === offerId) ?? null;

    setSelectedOfferId(offer?.id ?? null);
    setTermMonths(offer?.min_term_months ?? 12);
  }

  async function downloadFinancingPdf() {
    if (!selectedBank || !selectedOffer || !calculation) return;

    setIsGeneratingPdf(true);
    setPdfStatus("Generowanie oferty finansowania...");

    try {
      const response = await fetch("/api/generate-financing-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationPrice,
          downPayment,
          creditAmount,
          totalCreditCost: calculation.totalCreditCost,
          totalRepayment: calculation.totalRepayment,
          nominalAnnualRate: calculation.nominalAnnualRate,
          rrso: calculation.rrso,
          bankName: selectedBank.name,
          bankLogoUrl: getCreditBankLogoUrl(selectedBank.logo_path),
          offerName: selectedOffer.name,
          termMonths,
          installment: calculation.installment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Nie udało się wygenerować PDF.");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeBankName = selectedBank.name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

      link.href = downloadUrl;
      link.download = `kalkulacja-finansowania-${safeBankName || "ideasol"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setPdfStatus("PDF został wygenerowany.");
    } catch (error) {
      console.error("Błąd generowania oferty finansowania", error);
      setPdfStatus(error instanceof Error ? error.message : "Nie udało się wygenerować PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  if (compact) {
    return (
      <section className={expanded ? "grid gap-5 lg:grid-cols-2" : "space-y-3"}>
        {status ? (
          <div className={`${expanded ? "lg:col-span-2 p-8 text-sm" : "p-5 text-xs"} rounded-[18px] border border-dashed border-slate-300 bg-white text-center leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`}>
            {status}
          </div>
        ) : (
          <>
            <div className={`${expanded ? "p-5 lg:col-span-2" : "p-3"} rounded-[18px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.18em] text-slate-400`}>Bank finansujący</p>
                <p className={`${expanded ? "text-sm" : "text-[10px]"} font-semibold text-slate-500`}>Cena: {moneyFormatter.format(installationPrice)}</p>
              </div>
              <div className={`${expanded ? "mt-4 gap-3 sm:grid-cols-3" : "grid-cols-2 gap-2"} grid`}>
                {banks.map((bank) => {
                  const hasOffers = offers.some((offer) => offer.bank_id === bank.id);
                  const isSelected = selectedBankId === bank.id;

                  return (
                    <label
                      key={bank.id}
                      className={`${expanded ? "min-h-20 gap-3 p-4" : "min-h-14 gap-2 p-2"} flex items-center rounded-xl border transition ${!hasOffers ? "cursor-not-allowed border-slate-100 opacity-40 dark:border-slate-800" : isSelected ? "cursor-pointer border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "cursor-pointer border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"}`}
                    >
                      <input type="radio" name="credit-bank" checked={isSelected} disabled={!hasOffers} onChange={() => selectBank(bank.id)} className="sr-only" />
                      {bank.logo_path ? (
                        <span className="h-8 w-12 shrink-0 rounded-md bg-white bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${getCreditBankLogoUrl(bank.logo_path)}")` }} aria-hidden="true" />
                      ) : (
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${isSelected ? "bg-white/10 dark:bg-slate-950/10" : "bg-white dark:bg-slate-900"}`} aria-hidden="true">
                          {bank.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className={`${expanded ? "text-sm" : "text-xs"} min-w-0 truncate font-bold`}>{bank.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className={`${expanded ? "p-5" : "p-3"} rounded-[18px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
              <label className="block">
                <span className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.18em] text-slate-400`}>Oferta banku</span>
                <select value={selectedOfferId ?? ""} onChange={(event) => selectOffer(Number(event.target.value))} disabled={selectedBankOffers.length === 0} className={`${expanded ? "py-3 text-sm" : "py-2.5 text-xs"} mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white`}>
                  {selectedBankOffers.length === 0 && <option value="">Brak aktywnych ofert</option>}
                  {selectedBankOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}
                </select>
              </label>

              <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                <label className="block">
                  <span className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.18em] text-slate-400`}>Wkład własny</span>
                  <div className="relative mt-2">
                    <input type="text" inputMode="decimal" value={downPaymentInput} onChange={(event) => setDownPaymentInput(event.target.value)} aria-invalid={Boolean(downPaymentError)} className={`${expanded ? "py-3.5 text-base" : "py-2.5 text-sm"} w-full rounded-xl border bg-slate-50 px-3 pr-8 font-bold text-slate-900 outline-none focus:border-emerald-500 dark:bg-slate-950 dark:text-white ${downPaymentError ? "border-red-400" : "border-slate-200 dark:border-slate-700"}`} />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-slate-400">zł</span>
                  </div>
                </label>
                <div className="pb-2 text-right">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">Kredyt</p>
                  <p className={`${expanded ? "mt-2 text-xl" : "mt-1 text-sm"} font-black text-slate-900 dark:text-white`}>{Number.isFinite(creditAmount) ? moneyFormatter.format(Math.max(0, creditAmount)) : "—"}</p>
                </div>
              </div>
              {downPaymentError && <p className="mt-2 text-[10px] font-semibold text-red-600">{downPaymentError}</p>}
            </div>

            {selectedOffer && (
              <div className={`${expanded ? "p-5" : "p-3"} rounded-[18px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.18em] text-slate-400`}>Okres finansowania</p>
                    <p className={`${expanded ? "mt-2 text-2xl" : "mt-1 text-sm"} font-black text-slate-900 dark:text-white`}>{termMonths} rat</p>
                  </div>
                  <p className="max-w-48 text-right text-[9px] leading-4 text-slate-400">
                    {selectedOffer.min_term_months}–{selectedOffer.max_term_months} mies. · {selectedOffer.interest_rate_type === "monthly_flat" ? `${selectedOffer.interest_rate.toLocaleString("pl-PL")}% / mies.` : `${selectedOffer.interest_rate.toLocaleString("pl-PL")}% nominalnie / rok`}
                  </p>
                </div>
                <input type="range" min={selectedOffer.min_term_months} max={selectedOffer.max_term_months} step="1" value={termMonths} onChange={(event) => setTermMonths(Number(event.target.value))} className="mt-3 w-full accent-emerald-500" aria-label="Liczba miesięcznych rat" />
              </div>
            )}

            {(amountError || termError) && (
              <div className={`${expanded ? "p-4 text-sm lg:col-span-2" : "p-3 text-[11px]"} rounded-xl border border-amber-300 bg-amber-50 font-semibold leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100`}>{amountError || termError}</div>
            )}

            {calculation && (
              <>
                <div className={`${expanded ? "p-6 lg:col-span-2" : "p-4"} rounded-[20px] border border-emerald-400/30 bg-slate-950 text-white`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`${expanded ? "text-xs" : "text-[9px]"} font-black uppercase tracking-[0.2em] text-emerald-400`}>Miesięczna rata</p>
                      <p className={`${expanded ? "mt-2 text-5xl" : "mt-1 text-3xl"} font-black tracking-tight`}>{moneyFormatter.format(calculation.installment)}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold text-white/60">{termMonths} rat</span>
                  </div>
                  <dl className={`${expanded ? "mt-6 grid-cols-4 gap-5 pt-5" : "mt-4 grid-cols-2 gap-x-3 gap-y-3 pt-3"} grid border-t border-white/10`}>
                    <div><dt className={`${expanded ? "text-xs" : "text-[9px]"} text-white/40`}>Suma spłat</dt><dd className={`${expanded ? "mt-2 text-base" : "mt-0.5 text-xs"} font-bold`}>{moneyFormatter.format(calculation.totalRepayment)}</dd></div>
                    <div><dt className={`${expanded ? "text-xs" : "text-[9px]"} text-white/40`}>Koszt kredytu</dt><dd className={`${expanded ? "mt-2 text-base" : "mt-0.5 text-xs"} font-bold`}>{moneyFormatter.format(calculation.totalCreditCost)}</dd></div>
                    <div><dt className={`${expanded ? "text-xs" : "text-[9px]"} text-white/40`}>Nominalne / rok</dt><dd className={`${expanded ? "mt-2 text-base" : "mt-0.5 text-xs"} font-bold`}>{percentFormatter.format(calculation.nominalAnnualRate)}%</dd></div>
                    <div><dt className={`${expanded ? "text-xs" : "text-[9px]"} text-white/40`}>RRSO</dt><dd className={`${expanded ? "mt-2 text-base" : "mt-0.5 text-xs"} font-bold`}>{percentFormatter.format(calculation.rrso)}%</dd></div>
                  </dl>
                </div>
                <button type="button" onClick={() => void downloadFinancingPdf()} disabled={isGeneratingPdf} className={`${expanded ? "py-4 text-sm lg:col-span-2" : "py-3 text-xs"} flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {isGeneratingPdf ? "Generuję PDF…" : "Pobierz kalkulację finansowania"}
                </button>
                {pdfStatus && <p className="text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">{pdfStatus}</p>}
              </>
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <section className={`${compact ? "" : "mt-6"} overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
      <div className="h-1.5 bg-gradient-to-r from-[#5300EB] via-blue-500 to-[#00C0EB]" />
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <div className={`flex flex-col gap-3 ${compact ? "" : "sm:flex-row sm:items-start sm:justify-between"}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Finansowanie aktywnej wyceny
            </p>
            <h2 className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-bold text-slate-950 dark:text-slate-100`}>
              Kalkulator ratalny
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Rata równa wyliczana według miesięcznej stawki banku od kwoty kredytu.
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-right dark:bg-blue-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              Cena instalacji
            </p>
            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
              {moneyFormatter.format(installationPrice)}
            </p>
          </div>
        </div>

        {status ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            {status}
          </div>
        ) : (
          <div className={`${compact ? "mt-4 space-y-4" : "mt-6 space-y-6"}`}>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">1. Wybierz bank</p>
              <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
                {banks.map((bank) => {
                  const hasOffers = offers.some((offer) => offer.bank_id === bank.id);
                  const isSelected = selectedBankId === bank.id;

                  return (
                    <label
                      key={bank.id}
                        className={`flex items-center gap-2 rounded-xl border ${compact ? "p-2.5" : "p-4"} transition ${
                        !hasOffers
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-950"
                          : isSelected
                            ? "cursor-pointer border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900"
                            : "cursor-pointer border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950"
                      }`}
                    >
                      <input
                        type="radio"
                        name="credit-bank"
                        checked={isSelected}
                        disabled={!hasOffers}
                        onChange={() => selectBank(bank.id)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {bank.logo_path && (
                        <span
                          className="h-9 w-16 shrink-0 rounded-lg bg-white bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url("${getCreditBankLogoUrl(bank.logo_path)}")` }}
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        <span className="block font-semibold text-slate-900 dark:text-slate-100">{bank.name}</span>
                        {!hasOffers && <span className="text-xs text-slate-500">Brak aktywnych ofert</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">2. Oferta kredytowa</span>
                <select
                  value={selectedOfferId ?? ""}
                  onChange={(event) => selectOffer(Number(event.target.value))}
                  disabled={selectedBankOffers.length === 0}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {selectedBankOffers.length === 0 && <option value="">Brak aktywnych ofert</option>}
                  {selectedBankOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>{offer.name}</option>
                  ))}
                </select>
                {selectedOffer && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Kwota {moneyFormatter.format(selectedOffer.min_amount)}–{moneyFormatter.format(selectedOffer.max_amount)} · okres {selectedOffer.min_term_months}–{selectedOffer.max_term_months} mies. · {selectedOffer.interest_rate_type === "monthly_flat" ? "stawka miesięczna" : "oprocentowanie nominalne roczne"} {selectedOffer.interest_rate.toLocaleString("pl-PL")}%
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">3. Wkład własny klienta</span>
                <div className="relative mt-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={downPaymentInput}
                    onChange={(event) => setDownPaymentInput(event.target.value)}
                    aria-invalid={Boolean(downPaymentError)}
                    className={`w-full rounded-2xl border bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:ring-4 dark:bg-slate-950 dark:text-slate-100 ${
                      downPaymentError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-blue-400 focus:ring-blue-100 dark:border-slate-700"
                    }`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-400">zł</span>
                </div>
                {downPaymentError && <p className="mt-2 text-sm font-medium text-red-600">{downPaymentError}</p>}
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kwota kredytu</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                    {Number.isFinite(creditAmount) ? moneyFormatter.format(Math.max(0, creditAmount)) : "—"}
                  </p>
                </div>
                {selectedOffer && (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">4. Liczba rat</p>
                    <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">{termMonths}</p>
                  </div>
                )}
              </div>

              {selectedOffer && (
                <div className="mt-4">
                  <input
                    type="range"
                    min={selectedOffer.min_term_months}
                    max={selectedOffer.max_term_months}
                    step="1"
                    value={termMonths}
                    onChange={(event) => setTermMonths(Number(event.target.value))}
                    className="w-full accent-blue-600"
                    aria-label="Liczba miesięcznych rat"
                  />
                  <div className="mt-1 flex justify-between text-xs font-medium text-slate-500">
                    <span>{selectedOffer.min_term_months} mies.</span>
                    <span>{selectedOffer.max_term_months} mies.</span>
                  </div>
                </div>
              )}
            </div>

            {(amountError || termError) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                {amountError || termError}
              </div>
            )}

            {calculation && (
              <div className="space-y-3">
                <div className={`grid gap-3 ${compact ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]"}`}>
                  <div className="flex min-h-36 flex-col justify-center rounded-2xl bg-gradient-to-br from-[#5300EB] to-blue-600 p-5 text-white shadow-md shadow-blue-100 dark:shadow-none">
                    <p className="text-sm font-semibold text-blue-100">Miesięczna rata</p>
                    <p className="mt-2 text-3xl font-bold">{moneyFormatter.format(calculation.installment)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Szczegóły finansowania
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
                      <div>
                        <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">Suma spłat</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {moneyFormatter.format(calculation.totalRepayment)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">Całkowity koszt kredytu</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {moneyFormatter.format(calculation.totalCreditCost)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">Oprocentowanie nominalne roczne</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {percentFormatter.format(calculation.nominalAnnualRate)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">RRSO</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {percentFormatter.format(calculation.rrso)}%
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 border-t border-slate-200 pt-2 text-[10px] leading-4 text-slate-400 dark:border-slate-700">
                      RRSO wyliczone dla równych rat miesięcznych, bez dodatkowych opłat i prowizji.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-between gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-center">
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Pobierz podsumowanie z wstępnym harmonogramem wszystkich rat.
                  </p>
                  <button
                    type="button"
                    onClick={() => void downloadFinancingPdf()}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isGeneratingPdf ? "Generowanie..." : "Pobierz kalkulację PDF"}
                  </button>
                </div>
                {pdfStatus && <p className="text-right text-xs font-medium text-slate-500 dark:text-slate-400">{pdfStatus}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
