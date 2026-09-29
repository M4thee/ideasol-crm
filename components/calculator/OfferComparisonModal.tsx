"use client";

import { useEffect, useState } from "react";

import {
  OFFER_COMPARISON_LIMIT,
  collectUniqueComparisonCatalogCards,
  formatComparisonMoney,
  type OfferComparisonVariant,
} from "@/lib/offerComparison";

type OfferComparisonModalProps = {
  open: boolean;
  variants: OfferComparisonVariant[];
  clientEmail: string;
  status: string;
  sending: boolean;
  generatingPdf: boolean;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onDownloadPdf: () => void | Promise<void>;
  onSend: (options: {
    email: string;
    note: string;
    mode: "anonymous" | "public";
  }) => void | Promise<void>;
};

function displayValue(value: string) {
  return value && value !== "Brak" ? value : "—";
}

export default function OfferComparisonModal({
  open,
  variants,
  clientEmail,
  status,
  sending,
  generatingPdf,
  onClose,
  onRename,
  onRemove,
  onClear,
  onDownloadPdf,
  onSend,
}: OfferComparisonModalProps) {
  const [email, setEmail] = useState(clientEmail);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"anonymous" | "public">("public");

  useEffect(() => {
    if (!open) return;

    const frameId = window.requestAnimationFrame(() => setEmail(clientEmail));
    return () => window.cancelAnimationFrame(frameId);
  }, [clientEmail, open]);

  if (!open) return null;

  const canExport = variants.length >= 2;
  const canSend = canExport && email.trim().includes("@");
  const clientName = variants[0]?.clientName || "Klient";
  const catalogCardCount = collectUniqueComparisonCatalogCards(variants).length;
  const rows = [
    {
      label: "Instalacja PV",
      value: (variant: OfferComparisonVariant) =>
        variant.pvPowerKw > 0 ? `${variant.pvPowerKw.toLocaleString("pl-PL")} kWp` : "—",
    },
    { label: "Panele", value: (variant: OfferComparisonVariant) => displayValue(variant.panelDescription) },
    { label: "Magazyn energii", value: (variant: OfferComparisonVariant) => displayValue(variant.energyStorage) },
    {
      label: "Falownik",
      value: (variant: OfferComparisonVariant) =>
        variant.inverter === "Brak" ? "Własny klienta / bez falownika" : variant.inverter,
    },
    { label: "Cena netto", value: (variant: OfferComparisonVariant) => `${formatComparisonMoney(variant.finalNet)} zł` },
    { label: "VAT", value: (variant: OfferComparisonVariant) => `${variant.vatRate}%` },
    { label: "Cena brutto", value: (variant: OfferComparisonVariant) => `${formatComparisonMoney(variant.finalGross)} zł` },
    {
      label: "Szacowana dotacja",
      value: (variant: OfferComparisonVariant) =>
        variant.subsidyTotal > 0 ? `${formatComparisonMoney(variant.subsidyTotal)} zł` : "—",
    },
    {
      label: "Cena po dotacji",
      highlight: true,
      value: (variant: OfferComparisonVariant) =>
        variant.subsidyTotal > 0 ? `${formatComparisonMoney(variant.finalAfterSubsidy)} zł` : "—",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-comparison-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-50 shadow-2xl dark:bg-slate-950">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-[#0c2349] px-5 py-5 text-white dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Kalkulator ofertowy</p>
            <h2 id="offer-comparison-title" className="mt-1 text-2xl font-black">Porównanie wariantów</h2>
            <p className="mt-1 text-sm text-white/65">{clientName} · {variants.length}/{OFFER_COMPARISON_LIMIT} wariantów</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canExport || generatingPdf}
              onClick={() => void onDownloadPdf()}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generatingPdf ? "Generowanie…" : "Pobierz PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#0c2349] transition hover:bg-cyan-50"
            >
              Zamknij
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-4 sm:p-7">
          {variants.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-lg font-black text-slate-900 dark:text-white">Brak wariantów do porównania</p>
              <p className="mt-2 text-sm text-slate-500">Przelicz ofertę i kliknij „Dodaj do porównania”.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="w-44 border-b border-r border-slate-200 px-4 py-4 text-xs font-black uppercase tracking-wide text-slate-500 dark:border-slate-700">Parametr</th>
                      {variants.map((variant) => (
                        <th key={variant.id} className="min-w-44 border-b border-r border-slate-200 p-3 last:border-r-0 dark:border-slate-700">
                          <div className="flex items-start gap-2">
                            <input
                              value={variant.name}
                              maxLength={80}
                              onChange={(event) => onRename(variant.id, event.target.value)}
                              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-[#0c2349] outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              aria-label={`Nazwa wariantu ${variant.name}`}
                            />
                            <button
                              type="button"
                              onClick={() => onRemove(variant.id)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-lg text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                              aria-label={`Usuń ${variant.name}`}
                              title="Usuń wariant"
                            >
                              ×
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={row.label} className={row.highlight ? "bg-emerald-50 dark:bg-emerald-950/20" : rowIndex % 2 ? "bg-slate-50/70 dark:bg-slate-950/35" : undefined}>
                        <th className="border-b border-r border-slate-200 px-4 py-3 font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200">{row.label}</th>
                        {variants.map((variant) => (
                          <td key={variant.id} className={`border-b border-r border-slate-200 px-4 py-3 align-top last:border-r-0 dark:border-slate-800 ${row.highlight ? "font-black text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}>
                            {row.value(variant)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {variants.length < 2 && (
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Dodaj jeszcze co najmniej jeden wariant, aby wygenerować porównanie.
                </p>
              )}

              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">Lista wariantów</h3>
                      <p className="mt-1 text-xs text-slate-500">Możesz wrócić do kalkulatora i dodać kolejne wyceny.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Usunąć wszystkie warianty z porównania?")) onClear();
                      }}
                      className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                    >
                      Wyczyść
                    </button>
                  </div>
                  <ol className="mt-4 space-y-2">
                    {variants.map((variant, index) => (
                      <li key={variant.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{index + 1}. {variant.name}</span>
                        <span className="text-sm font-black text-[#1f6dd6]">{formatComparisonMoney(variant.finalGross)} zł</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">Wyślij klientowi</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Mail zawiera tabelę i PDF oraz {catalogCardCount > 0
                        ? `karty katalogowe unikalnych urządzeń (liczba załączników: ${catalogCardCount})`
                        : "dostępne karty katalogowe"} urządzeń. Powtarzające się modele są dołączane tylko raz.
                    </p>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">E-mail klienta</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="klient@example.com"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Wiadomość od handlowca</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={2000}
                      className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="Opcjonalna wiadomość dla klienta"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMode("anonymous")} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${mode === "anonymous" ? "border-[#0c2349] bg-[#0c2349] text-white" : "border-slate-200 dark:border-slate-700"}`}>Anonimowo</button>
                    <button type="button" onClick={() => setMode("public")} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${mode === "public" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 dark:border-slate-700"}`}>Jawnie</button>
                  </div>
                  <button
                    type="button"
                    disabled={!canSend || sending}
                    onClick={() => void onSend({ email: email.trim(), note: note.trim(), mode })}
                    className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800"
                  >
                    {sending ? "Wysyłanie…" : "Wyślij porównanie, PDF i karty"}
                  </button>
                  {status && <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{status}</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
