"use client";

import { useState } from "react";
import SubsidyOptimizer from "@/components/SubsidyOptimizer";

type Result = {
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
  offerType: string;
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
  sendOfferEmail: () => void;
  sendingEmail: boolean;
  emailStatus: string;
  saveOfferToCrm?: () => void;
  savingOffer?: boolean;
  saveOfferStatus?: string;
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

  const isSeller = currentUserRole === "seller";
  const canSeeMarginSummary = canSeeTechnicalView || isSeller;

  function findBreakdownValue(keywords: string[]) {
    const item = result.breakdown.find((breakdownItem) => {
      const label = breakdownItem.label.toLowerCase();
      return keywords.some((keyword) => label.includes(keyword));
    });

    return item?.value || 0;
  }

  const storageNetFromBreakdown = findBreakdownValue(["magazyn", "storage"]);
  const inverterNetFromBreakdown = findBreakdownValue(["falownik", "inverter"]);

  const storageGrossForSubsidy = Math.round(
    storageNetFromBreakdown * (1 + result.vatRate / 100)
  );

  const inverterGrossForSubsidy = Math.round(
    inverterNetFromBreakdown * (1 + result.vatRate / 100)
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

  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-emerald-50">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-teal-400" />
      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Krok 2</p>
          <h2 className="text-xl font-bold text-slate-950">Oferta dla klienta</h2>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setCopied(false);
              setEmailStatus("");
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 text-sm transition"
          >
            Edytuj
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-sm transition"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {result.offerType !== "storage" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500 text-sm">Moc instalacji</p>
            <p className="text-2xl font-bold text-slate-950">{result.pvPowerKw} kWp</p>
            <p className="text-xs text-slate-500 mt-1">
              {panelCount} paneli × {panelPowerWp} Wp
            </p>
          </div>
        )}

        {result.inverter !== "Brak" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500 text-sm">Falownik</p>
            <p className="text-xl font-bold text-slate-950">{result.inverter}</p>
          </div>
        )}

        {result.energyStorage !== "Brak" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500 text-sm">Magazyn energii</p>
            <p className="text-xl font-bold text-slate-950">{result.energyStorage}</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-slate-500 text-sm">Cena netto</p>
          <p className="text-2xl font-bold text-slate-950">
            {result.finalNet.toLocaleString("pl-PL")} zł
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-white shadow-xl shadow-emerald-200">
          <p className="text-sm font-semibold">Cena brutto {result.vatRate}%</p>
          <p className="text-3xl font-black text-white">
            {result.finalGross.toLocaleString("pl-PL")} zł
          </p>
        </div>

        <button
          onClick={copyOffer}
          className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-bold text-slate-950 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
        >
          {copied ? "Skopiowano maila" : "Skopiuj ofertę do schowka"}
        </button>

        {saveOfferToCrm && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
            <button
              type="button"
              onClick={saveOfferToCrm}
              disabled={savingOffer || !selectedClientId}
              className="w-full rounded-2xl bg-emerald-600 p-4 font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {savingOffer ? "Zapisywanie oferty..." : "Zapisz ofertę w CRM"}
            </button>

            {!selectedClientId && (
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
          className="w-full rounded-2xl bg-amber-400 p-4 font-bold text-slate-950 shadow-md shadow-amber-100 transition hover:bg-amber-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
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
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              type="email"
              placeholder="klient@example.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </label>

          <button
            onClick={sendOfferEmail}
            disabled={sendingEmail || !clientEmail}
            className="w-full rounded-2xl bg-blue-600 p-4 font-bold text-white shadow-md shadow-blue-100 transition hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {sendingEmail ? "Wysyłanie..." : "Wyślij ofertę mailem"}
          </button>

          {emailStatus && (
            <p className="text-sm text-slate-600">{emailStatus}</p>
          )}
        </div>

        {result.energyStorage !== "Brak" && (
          <SubsidyOptimizer
            storageCapacity={(() => {
              const match = result.energyStorage.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);

              return match
                ? Number(match[1].replace(",", "."))
                : 0;
            })()}
            storageGrossPrice={result.finalNet}
            inverterGrossPrice={inverterGrossForSubsidy}
            isNetBilling={true}
            isEuStorage={true}
            isEuHybridInverter={true}
          />
        )}

        {canSeeMarginSummary && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowMarginSummary((current) => !current)}
              className={
                isSeller
                  ? "w-full flex items-center justify-end rounded-xl bg-transparent px-1 py-1 text-left"
                  : "w-full flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition"
              }
            >
              {isSeller ? (
                <span className="text-slate-500 text-sm">
                  {showMarginSummary ? "−" : "+"}
                </span>
              ) : (
                <>
                  <span className="font-medium text-slate-500">
                    Widok techniczny — tylko do testów
                  </span>
                  <span className="text-slate-400">
                    {showMarginSummary ? "Zwiń" : "Rozwiń"}
                  </span>
                </>
              )}
            </button>

            {showMarginSummary && (
              <div className="mt-4 space-y-3">
                {isSeller ? (
                  <div className="text-right text-sm text-slate-500 font-normal">
                    {sellerCommissionNet.toLocaleString("pl-PL")} zł
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm text-slate-600 mb-4 font-semibold">
                      <span>Realna marża firmy</span>
                      <span>{result.companyMargin.toLocaleString("pl-PL")} zł</span>
                    </div>

                    <div className="space-y-2">
                      {result.breakdown.map((item) => (
                        <div
                          key={item.label}
                          className="flex justify-between text-sm text-slate-700"
                        >
                          <span>{item.label}</span>
                          <span>{item.value.toLocaleString("pl-PL")} zł</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}