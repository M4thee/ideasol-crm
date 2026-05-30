"use client";

import { useState } from "react";
import Link from "next/link";
import SubsidyOptimizer from "@/components/SubsidyOptimizer";

type Result = {
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
  offerType: string;
  billingSystem?: "net_billing" | "net_metering";
  withEms?: boolean;
  includeSubsidy?: boolean;
  subsidyProgramCap?: number;
  subsidyAllocation?: {
    enabled: boolean;
    requested?: boolean;
    billingSystem: "net_billing" | "net_metering";
    pvNet: number;
    storageNet: number;
    emsNet: number;
    storageSubsidy: number;
    emsBonus: number;
    total: number;
    programCap: number;
    storageCapByKwh: number;
    maxStorageSubsidy: number;
    existingPvPowerKw?: number;
    newPvPowerKw?: number;
    totalPvPowerForSubsidyKw?: number;
    requiredStorageCapacityKwh?: number;
    storageCapacityKwh?: number;
    hasStorageMinimumCapacity?: boolean;
    hasRequiredStorageToPvRatio?: boolean;
  };
  basePriceNet: number;
  sellerMarkupNet: number;
  finalNet: number;
  finalGross: number;
  vatRate: number;
  companyMargin: number;
  operatorPercent?: number;
  sellerCommissionNet?: number;
  sellerWarrantyFeeNet?: number;
  breakdown: {
    label: string;
    value: number;
  }[];
};

type OfferResultProps = {
  result: Result;
  panelCount: number;
  panelPowerWp: number;
  panelName: string;
  copied: boolean;
  copyOffer: () => void;
  resetForm: () => void;
  setResult: (value: Result | null) => void;
  setCopied: (value: boolean) => void;
  setEmailStatus: (value: string) => void;
  clientEmail: string;
  clientName: string;
  setClientEmail: (value: string) => void;
  sendOfferEmail: (mode?: "anonymous" | "public") => void;
  sendingEmail: boolean;
  emailStatus: string;
  saveOfferToCrm?: () => void;
  savingOffer?: boolean;
  saveOfferStatus?: string;
  savedOfferId?: string | null;
  selectedClientId?: string;
  canSeeTechnicalView: boolean;
  currentUserRole?: string;
  advisorName?: string;
  advisorPhone?: string;
  advisorEmail?: string;
};

export default function OfferResult({
  result,
  panelCount,
  panelPowerWp,
  panelName,
  copied,
  copyOffer,
  resetForm,
  setResult,
  setCopied,
  setEmailStatus,
  clientEmail,
  clientName,
  setClientEmail,
  sendOfferEmail,
  sendingEmail,
  emailStatus,
  saveOfferToCrm,
  savingOffer = false,
  saveOfferStatus = "",
  savedOfferId = null,
  selectedClientId = "",
  canSeeTechnicalView,
  currentUserRole,
  advisorName,
  advisorPhone,
  advisorEmail,
}: OfferResultProps) {
  const [showMarginSummary, setShowMarginSummary] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [sendMode, setSendMode] = useState<"anonymous" | "public">("anonymous");
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const canSeeMarginSummary = canSeeTechnicalView;

  function findBreakdownValue(keywords: string[]) {
    const breakdown = Array.isArray(result?.breakdown)
      ? result.breakdown
      : [];

    const item = breakdown.find((breakdownItem) => {
      const label = breakdownItem.label.toLowerCase();

      return keywords.some((keyword) =>
        label.includes(keyword)
      );
    });

    return item?.value || 0;
  }

  const storageNetFromBreakdown = findBreakdownValue(["magazyn", "storage"]);
  const inverterNetFromBreakdown = findBreakdownValue(["falownik", "inverter"]);
  const emsNetFromBreakdown = findBreakdownValue(["ems"]);

  const storageGrossForSubsidy = Math.round(
    storageNetFromBreakdown * (1 + result.vatRate / 100)
  );

  const inverterGrossForSubsidy = Math.round(
    inverterNetFromBreakdown * (1 + result.vatRate / 100)
  );
  const emsGrossForSubsidy = Math.round(
    emsNetFromBreakdown * (1 + result.vatRate / 100)
  );

  const sellerCommissionNet = Math.round(
    result.sellerCommissionNet ??
      result.sellerMarkupNet * (1 - (result.operatorPercent ?? 15) / 100)
  );

  async function downloadOfferPdf() {
    setIsGeneratingPdf(true);
    setPdfStatus("");

    try {
      const response = await fetch("/api/generate-offer-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName: clientName || clientEmail || "Klient",
          offerType: result.offerType,
          pvPowerKw: result.pvPowerKw,
          panelCount,
          panelPowerWp,
          panelName,
          inverter: result.inverter,
          energyStorage: result.energyStorage,
          finalNet: result.finalNet,
          finalGross: result.finalGross,
          vatRate: result.vatRate,
          advisorName,
          advisorPhone,
          advisorEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("PDF generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "oferta-ideasol.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setPdfStatus("PDF został wygenerowany");
    } catch (error) {
      console.error(error);
      setPdfStatus("Nie udało się wygenerować PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  const confirmationText =
    sendMode === "anonymous"
      ? {
          title: "Uwaga! Wysyłasz mail z ofertą anonimowo.",
          body: "Klient nie będzie znał Twojego imienia, nazwiska, telefonu i adresu e-mail. Ewentualna odpowiedź na maila będzie kierowana na skrzynkę ogólną. Czy chcesz kontynuować?",
          confirm: "Tak, wyślij anonimowo",
        }
      : {
          title: "Uwaga! Wysyłasz mail z ofertą w wersji jawnej.",
          body: "Klient otrzyma wiadomość z Twoim imieniem i nazwiskiem, numerem telefonu i adresem e-mail, a odpowiedź na maila będzie kierowana na Twój służbowy e-mail. Czy chcesz kontynuować?",
          confirm: "Tak, wyślij jawnie",
        };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-4 shadow-lg shadow-slate-200/70 ring-1 ring-emerald-50 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-teal-400" />
      <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Krok 2</p>
          <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Oferta dla klienta</h2>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setCopied(false);
              setEmailStatus("");
            }}
            className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-200"
          >
            Edytuj
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {result.offerType !== "storage" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500 text-sm">Moc instalacji</p>
            <p className="text-xl font-bold text-slate-950 sm:text-2xl">{result.pvPowerKw} kWp</p>
            <p className="text-xs text-slate-500 mt-1">
              {panelCount} paneli × {panelPowerWp} Wp
            </p>
          </div>
        )}

        {result.inverter !== "Brak" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500 text-sm">Falownik</p>
            <p className="break-words text-lg font-bold text-slate-950 sm:text-xl">{result.inverter}</p>
          </div>
        )}

        {result.energyStorage !== "Brak" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500 text-sm">Magazyn energii</p>
            <p className="break-words text-lg font-bold text-slate-950 sm:text-xl">{result.energyStorage}</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-slate-500 text-sm">Cena netto</p>
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {result.finalNet.toLocaleString("pl-PL")} zł
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-4 text-white shadow-xl shadow-emerald-200 sm:p-5">
          <p className="text-sm font-semibold">Cena brutto {result.vatRate}%</p>
          <p className="break-words text-2xl font-black text-white sm:text-3xl">
            {result.finalGross.toLocaleString("pl-PL")} zł
          </p>
        </div>

        <button
          onClick={copyOffer}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold sm:text-base text-slate-950 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
        >
          {copied ? "Skopiowano maila" : "Skopiuj ofertę do schowka"}
        </button>

        {saveOfferToCrm && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
            {savedOfferId ? (
              <Link
                href={`/offers/${savedOfferId}?createSale=1`}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-500 sm:text-base"
              >
                Wygeneruj sprzedaż
              </Link>
            ) : (
              <button
                type="button"
                onClick={saveOfferToCrm}
                disabled={savingOffer || !selectedClientId}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-bold sm:text-base text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                {savingOffer ? "Zapisywanie oferty..." : "Zapisz ofertę w CRM"}
              </button>
            )}

            {!selectedClientId && !savedOfferId && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Wybierz klienta w formularzu, żeby zapisać ofertę na jego karcie.
              </p>
            )}

            {saveOfferStatus && (
              <p className="mt-2 text-sm font-medium text-slate-700">
                {saveOfferStatus}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={downloadOfferPdf}
          disabled={isGeneratingPdf}
          className="w-full rounded-2xl bg-amber-400 px-4 py-4 text-sm font-bold sm:text-base text-slate-950 shadow-md shadow-amber-100 transition hover:bg-amber-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {isGeneratingPdf ? "Generowanie PDF..." : "Pobierz ofertę PDF"}
        </button>

        {pdfStatus && (
          <p className="text-sm text-slate-600">{pdfStatus}</p>
        )}

        <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
          <label className="block">
            <span className="text-sm text-slate-700">E-mail klienta</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:text-base"
              type="email"
              placeholder="klient@example.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </label>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSendMode("anonymous")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold border transition ${
                  sendMode === "anonymous"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Anonimowo
              </button>

              <button
                type="button"
                onClick={() => setSendMode("public")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold border transition ${
                  sendMode === "public"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Jawnie
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSendConfirm(true)}
              disabled={sendingEmail || !clientEmail}
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-bold sm:text-base text-white shadow-md shadow-blue-100 transition hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {sendingEmail ? "Wysyłanie..." : "Wyślij ofertę mailem"}
            </button>
          </div>
        </div>

        {result.energyStorage !== "Brak" &&
          (result.includeSubsidy || result.subsidyAllocation?.requested) && (
          <SubsidyOptimizer
            storageCapacity={(() => {
              const match = result.energyStorage.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);

              return match
                ? Number(match[1].replace(",", "."))
                : 0;
            })()}
            storageGrossPrice={result.finalNet}
            inverterGrossPrice={result.withEms ? emsGrossForSubsidy : inverterGrossForSubsidy}
            isNetBilling={result.billingSystem !== "net_metering"}
            isEuStorage={true}
            isEuHybridInverter={true}
            subsidyEnabled={Boolean(result.subsidyAllocation?.enabled)}
            withEms={Boolean(result.withEms)} 
            requiredStorageCapacityKwh={result.subsidyAllocation?.requiredStorageCapacityKwh || 0}
            totalPvPowerForSubsidyKw={result.subsidyAllocation?.totalPvPowerForSubsidyKw || result.pvPowerKw || 0}
          />
        )}

        {canSeeMarginSummary && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowMarginSummary((current) => !current)}
              className="w-full flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition"
            >
              <>
                <span className="font-medium text-slate-500">
                  Zaawansowane dane finansowe
                </span>
                <span className="text-slate-400">
                  {showMarginSummary ? "Zwiń" : "Rozwiń"}
                </span>
              </>
            </button>

            {showMarginSummary && (
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm text-slate-600 mb-4 font-semibold">
                  <span>Realna marża firmy</span>
                  <span>{result.companyMargin.toLocaleString("pl-PL")} zł</span>
                </div>

                <div className="space-y-2">
                  {(Array.isArray(result?.breakdown)
                    ? result.breakdown
                    : []).map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-3 text-sm text-slate-700"
                    >
                      <span className="min-w-0 break-words">{item.label}</span>
                      <span className="shrink-0">{item.value.toLocaleString("pl-PL")} zł</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950 mb-3">
              {confirmationText.title}
            </h3>

            <p className="text-sm text-slate-600 leading-6 mb-6">
              {confirmationText.body}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSendConfirm(false)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
              >
                Nie, wróć
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSendConfirm(false);
                  sendOfferEmail(sendMode);
                }}
                className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white"
              >
                {confirmationText.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}