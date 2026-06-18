"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import SubsidyOptimizer from "@/components/SubsidyOptimizer";

type Result = {
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
  storageCapacityKwh?: number;
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
  additionalServices?: {
    id: number | null;
    name: string;
    priceNet: number;
    quantity: number;
    totalNet: number;
  }[];
  additionalServicesNet?: number;
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

type CrmClientOption = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  postal_code?: string | null;
  street?: string | null;
  building_number?: string | null;
  lead_public_id?: string | null;
  client_public_id?: string | null;
  public_id?: string | null;
  [key: string]: unknown;
};

type OfferResultProps = {
  result: Result;
  panelCount: number;
  panelPowerWp: number;
  panelName: string;
  identicalSetCount?: number;
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
  saveOfferToCrm?: (clientIdOverride?: string) => Promise<string | null | void> | string | null | void;
  savingOffer?: boolean;
  saveOfferStatus?: string;
  savedOfferId?: string | null;
  selectedClientId?: string;
  crmClients?: CrmClientOption[];
  setSelectedClientId?: (clientId: string) => void;
  canSeeTechnicalView: boolean;
  currentUserRole?: string;
  advisorName?: string;
  advisorPhone?: string;
  advisorEmail?: string;
};


function FileTextIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export default function OfferResult({
  result,
  panelCount,
  panelPowerWp,
  panelName,
  identicalSetCount = 1,
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
  crmClients = [],
  setSelectedClientId,
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
  const [isMailPanelOpen, setIsMailPanelOpen] = useState(false);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [showClientRequiredModal, setShowClientRequiredModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [modalSelectedClientId, setModalSelectedClientId] = useState(selectedClientId || "");

  const selectedCrmClient = crmClients.find((client) => client.id === selectedClientId);
  const selectedCrmClientEmail = selectedCrmClient?.email?.trim() || "";
  const normalizedClientEmail = clientEmail.trim();
  const hasSelectedCrmClient = Boolean(selectedClientId);
  const hasSelectedCrmClientEmail = Boolean(selectedCrmClientEmail);
  const canSendOfferEmail = hasSelectedCrmClient && Boolean(normalizedClientEmail);

  useEffect(() => {
    if (!selectedClientId) {
      if (clientEmail) {
        setClientEmail("");
      }
      return;
    }

    if (selectedCrmClientEmail && clientEmail !== selectedCrmClientEmail) {
      setClientEmail(selectedCrmClientEmail);
    }
  }, [selectedClientId, selectedCrmClientEmail, clientEmail, setClientEmail]);

  const canSeeMarginSummary = canSeeTechnicalView;

  const normalizedClientSearchQuery = clientSearchQuery.trim().toLowerCase();

  const filteredCrmClients = normalizedClientSearchQuery
    ? crmClients
        .filter((client) => {
          const searchableText = Object.values(client)
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value))
            .join(" ")
            .toLowerCase();

          return searchableText.includes(normalizedClientSearchQuery);
        })
        .slice(0, 8)
    : [];

  function getClientDisplayName(client?: CrmClientOption) {
    if (!client) return "";

    const firstAndLastName = [client.first_name, client.last_name].filter(Boolean).join(" ").trim();

    return client.full_name || client.company_name || client.name || client.contact_person || firstAndLastName || client.email || client.phone || client.contact_phone || "Klient CRM";
  }

  function getClientDisplayMeta(client?: CrmClientOption) {
    if (!client) return "";

    return [
      client.lead_public_id || client.client_public_id || client.public_id,
      client.phone || client.contact_phone,
      client.email,
      [client.street, client.building_number, client.postal_code, client.city].filter(Boolean).join(" ").trim(),
    ]
      .filter(Boolean)
      .join(" · ");
  }

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
  const backupNetFromBreakdown = findBreakdownValue(["backup", "zasilania awaryjnego"]);
  const hasBackupForPdf = backupNetFromBreakdown > 0;

  const additionalServices = Array.isArray(result.additionalServices)
    ? result.additionalServices
    : [];
  const additionalServicesNet =
    result.additionalServicesNet ??
    additionalServices.reduce((sum, service) => sum + Number(service.totalNet || 0), 0);

  const hasSubsidyOptimization = Boolean(
    result.includeSubsidy || result.subsidyAllocation?.requested || result.subsidyAllocation?.enabled
  );

  const pvNetForPdf = Math.max(
    hasSubsidyOptimization
      ? result.subsidyAllocation?.pvNet || 0
      : result.finalNet -
          storageNetFromBreakdown -
          inverterNetFromBreakdown -
          emsNetFromBreakdown -
          additionalServicesNet,
    0
  );

  const storageNetForPdf = Math.max(
    hasSubsidyOptimization
      ? result.subsidyAllocation?.storageNet || storageNetFromBreakdown
      : storageNetFromBreakdown,
    0
  );

  const pvGrossForPdf = pvNetForPdf * (1 + result.vatRate / 100);
  const storageGrossForPdf = storageNetForPdf * (1 + result.vatRate / 100);
  const pdfQuantity = Math.max(Number(identicalSetCount || 1), 1);


  const inverterGrossForSubsidy = Math.round(
    inverterNetFromBreakdown * (1 + result.vatRate / 100)
  );
  const emsGrossForSubsidy = Math.round(
    emsNetFromBreakdown * (1 + result.vatRate / 100)
  );

  const inverterGrossFromBreakdown = inverterNetFromBreakdown * (1 + result.vatRate / 100);
  const emsGrossFromBreakdown = emsNetFromBreakdown * (1 + result.vatRate / 100);
  const backupGrossFromBreakdown = backupNetFromBreakdown * (1 + result.vatRate / 100);



  const sellerCommissionNet = Math.round(
    result.sellerCommissionNet ??
      result.sellerMarkupNet * (1 - (result.operatorPercent ?? 15) / 100)
  );

  function getInverterPdfParts() {
    if (!result.inverter || result.inverter === "Brak") {
      return {
        inverterProducer: "",
        inverterModel: "",
        inverterPowerKw: "",
      };
    }

    const inverterText = result.inverter.trim();
    const powerMatch = inverterText.match(/(\d+(?:[,.]\d+)?)\s*kW/i);
    const inverterPowerKw = powerMatch ? powerMatch[1].replace(",", ".") : "";
    const inverterWithoutType = inverterText.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    const inverterProducer = inverterWithoutType.split(" ")[0] || "";
    const inverterModel = inverterProducer
      ? inverterWithoutType.replace(inverterProducer, "").replace(/\s*-\s*\d+(?:[,.]\d+)?\s*kW/i, "").trim()
      : inverterWithoutType;

    return {
      inverterProducer,
      inverterModel,
      inverterPowerKw,
    };
  }

  async function generatePdfAfterCrmSave(clientIdForSave: string) {
    setIsGeneratingPdf(true);
    setPdfStatus("");

    try {
      if (saveOfferToCrm) {
        const savedId = await saveOfferToCrm(clientIdForSave);
        if (savedId === null) {
          setPdfStatus("Nie udało się zapisać oferty w CRM, więc PDF nie został wygenerowany.");
          return;
        }
      }

      const inverterPdfParts = getInverterPdfParts();

      const response = await fetch("/api/generate-offer-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName: clientName || clientEmail || "Klient",
          offerType: result.offerType,
          pdfQuantity,
          pvPowerKw: result.pvPowerKw,
          panelCount,
          panelPowerWp,
          panelName,
          inverter: result.inverter,
          inverterProducer: inverterPdfParts.inverterProducer,
          inverterModel: inverterPdfParts.inverterModel,
          inverterPowerKw: inverterPdfParts.inverterPowerKw,
          inverterNet: inverterNetFromBreakdown,
          inverterGross: inverterGrossFromBreakdown,
          energyStorage: result.energyStorage,
          pvNet: pvNetForPdf,
          pvGross: pvGrossForPdf,
          storageNet: storageNetForPdf,
          storageGross: storageGrossForPdf,
          withEms: Boolean(result.withEms),
          emsName: result.withEms
            ? "ZERONEST Świetlik D300 - zaawansowany system zarządzania energią EMS i integratora. Urządzenie w całości projektowane, produkowane i testowane w Polsce."
            : "",
          emsNet: result.withEms
            ? result.subsidyAllocation?.emsNet || emsNetFromBreakdown
            : 0,
          emsGross: result.withEms
            ? (result.subsidyAllocation?.emsNet || emsNetFromBreakdown) * (1 + result.vatRate / 100)
            : 0,
          withBackup: hasBackupForPdf,
          backupName: hasBackupForPdf ? "Backup zasilania awaryjnego" : "",
          backupNet: backupNetFromBreakdown,
          backupGross: backupGrossFromBreakdown,
          additionalServices,
          subsidyTotal: result.subsidyAllocation?.enabled ? result.subsidyAllocation.total || 0 : 0,
          subsidyAllocation: result.subsidyAllocation?.enabled ? result.subsidyAllocation : undefined,
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

  async function downloadOfferPdf() {
    const clientIdForPdf = selectedClientId || modalSelectedClientId;

    if (!clientIdForPdf) {
      setModalSelectedClientId("");
      setShowClientRequiredModal(true);
      return;
    }

    await generatePdfAfterCrmSave(clientIdForPdf);
  }

  async function handleSaveOfferToCrm() {
    if (!saveOfferToCrm) return;

    setShowSaveAnimation(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await saveOfferToCrm(selectedClientId);
    } finally {
      setShowSaveAnimation(false);
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
    <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-4 shadow-lg shadow-slate-200/70 ring-1 ring-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 dark:ring-slate-800 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-teal-400" />
      <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Krok 2</p>
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">Oferta dla klienta</h2>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setCopied(false);
              setEmailStatus("");
            }}
            className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Edytuj
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {result.offerType !== "storage" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Moc instalacji</p>
            <p className="text-xl font-bold text-slate-950 dark:text-slate-100 sm:text-2xl">{result.pvPowerKw} kWp</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {panelCount} paneli × {panelPowerWp} Wp
            </p>
          </div>
        )}

        {result.inverter !== "Brak" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Falownik</p>
            <p className="break-words text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">{result.inverter}</p>
          </div>
        )}

        {result.energyStorage !== "Brak" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Magazyn energii</p>
            <p className="break-words text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">{result.energyStorage}</p>
          </div>
        )}

        {additionalServices.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Usługi dodatkowe</p>
                <div className="mt-2 space-y-2">
                  {additionalServices.map((service) => (
                    <div
                      key={`${service.id}-${service.name}`}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {service.name}
                          {service.quantity > 1 ? ` x ${service.quantity}` : ""}
                        </p>
                        {service.quantity > 1 && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {Math.round(service.priceNet).toLocaleString("pl-PL")} zł netto / szt.
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 font-bold text-slate-900">
                        {Math.round(service.totalNet).toLocaleString("pl-PL")} zł netto
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="shrink-0 text-sm font-bold text-slate-900">
                {additionalServicesNet.toLocaleString("pl-PL")} zł netto
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Cena netto</p>
          <p className="text-xl font-bold text-slate-950 dark:text-slate-100 sm:text-2xl">
            {result.finalNet.toLocaleString("pl-PL")} zł
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-4 text-white shadow-xl shadow-emerald-200 dark:shadow-black/30 sm:p-5">
          <p className="text-sm font-semibold">Cena brutto {result.vatRate}%</p>
          <p className="break-words text-2xl font-black text-white sm:text-3xl">
            {result.finalGross.toLocaleString("pl-PL")} zł
          </p>
        </div>


        {saveOfferToCrm && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/25">
            {savedOfferId ? (
              <Link
                href={`/offers/${savedOfferId}?createSale=1`}
               className="inline-flex w-full items-center justify-center rounded-2xl bg-[#F54927] px-4 py-4 text-sm font-bold text-white shadow-md shadow-orange-100 transition hover:bg-[#d93f20] dark:shadow-black/30 sm:text-base"
              >
                Wygeneruj sprzedaż
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSaveOfferToCrm}
                disabled={savingOffer || showSaveAnimation || !selectedClientId}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:shadow-black/30 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 sm:text-base"
              >
                {savingOffer || showSaveAnimation ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Zapisywanie...
                  </span>
                ) : (
                  "Zapisz ofertę w CRM"
                )}
              </button>
            )}

            {!selectedClientId && !savedOfferId && (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Wybierz klienta w formularzu, żeby zapisać ofertę na jego karcie.
              </p>
            )}

            {saveOfferStatus && (
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                {saveOfferStatus}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={downloadOfferPdf}
              disabled={isGeneratingPdf}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#00AB87]/30 bg-white text-[#00AB87] shadow-none transition hover:border-[#00AB87] hover:bg-[#00AB87]/5 disabled:border-slate-200 disabled:text-slate-300 dark:bg-slate-950 dark:hover:bg-emerald-950/30 dark:disabled:border-slate-700 dark:disabled:text-slate-600"
              aria-label="Pobierz PDF"
              title="Pobierz PDF"
            >
              <FileTextIcon />
              <span className="sr-only">Pobierz PDF</span>
            </button>
            <span className="max-w-[90px] text-center text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">Pobierz PDF</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMailPanelOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#00AB87]/30 bg-white text-[#00AB87] shadow-none transition hover:border-[#00AB87] hover:bg-[#00AB87]/5 dark:bg-slate-950 dark:hover:bg-emerald-950/30"
              aria-expanded={isMailPanelOpen}
              aria-label="Pokaż wysyłkę mailem"
              title="Wyślij mailem"
            >
              <MailIcon />
            </button>
            <span className="max-w-[90px] text-center text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">Wyślij e-mail</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={copyOffer}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#00AB87]/30 bg-white text-[#00AB87] shadow-none transition hover:border-[#00AB87] hover:bg-[#00AB87]/5 dark:bg-slate-950 dark:hover:bg-emerald-950/30"
              aria-label="Kopiuj treść maila"
              title="Kopiuj treść maila"
            >
              <CopyIcon />
            </button>
            <span className="max-w-[90px] text-center text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">Kopiuj treść do schowka</span>
          </div>

          {isGeneratingPdf && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Generowanie PDF...</span>
          )}
        </div>

        {copied && (
          <p className="text-sm text-slate-600 dark:text-slate-300">Skopiowano treść maila do schowka.</p>
        )}

        {pdfStatus && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{pdfStatus}</p>
        )}


        {isMailPanelOpen && (
          <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-950/25">
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-200">E-mail klienta</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/20 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 sm:text-base"
                type="email"
                placeholder={selectedClientId ? "Wpisz e-mail klienta" : "Najpierw wybierz klienta CRM"}
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                disabled={!selectedClientId}
              />
            </label>

            {!hasSelectedCrmClient && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Najpierw wybierz klienta z CRM w formularzu kalkulatora. Wysyłka maila bez klienta CRM jest zablokowana.
              </p>
            )}

            {hasSelectedCrmClient && !hasSelectedCrmClientEmail && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Ten klient nie ma adresu e-mail na karcie CRM. Wpisany tutaj adres zostanie automatycznie zapisany na karcie klienta. Zmienić go lub usunąć może tylko administrator.
              </p>
            )}

            {hasSelectedCrmClient && hasSelectedCrmClientEmail && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                E-mail został pobrany z karty klienta CRM.
              </p>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSendMode("anonymous")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold border transition ${
                    sendMode === "anonymous"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  Jawnie
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!hasSelectedCrmClient) {
                    setEmailStatus(
                      "Wybierz klienta z CRM przed wysłaniem oferty mailowej."
                    );
                    return;
                  }
                  if (!normalizedClientEmail) {
                    setEmailStatus(
                      "Brakuje adresu e-mail klienta."
                    );
                    return;
                  }
                  setShowSendConfirm(true);
                }}
                disabled={sendingEmail || !canSendOfferEmail}
                className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-bold text-white shadow-md shadow-blue-100 transition hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:shadow-black/30 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 sm:text-base"
              >
                {sendingEmail ? "Wysyłanie..." : "Wyślij ofertę mailem"}
              </button>
            </div>
          </div>
        )}

        {result.energyStorage !== "Brak" &&
          (result.includeSubsidy || result.subsidyAllocation?.requested) && (
          <SubsidyOptimizer
            storageCapacity={result.storageCapacityKwh || result.subsidyAllocation?.storageCapacityKwh || 0}
            totalOfferNetPrice={result.finalNet}
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
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowMarginSummary((current) => !current)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              <>
                <span className="font-medium text-slate-500 dark:text-slate-300">
                  Zaawansowane dane finansowe
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  {showMarginSummary ? "Zwiń" : "Rozwiń"}
                </span>
              </>
            </button>

            {showMarginSummary && (
              <div className="mt-4 space-y-3">
                <div className="mb-4 flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span>Realna marża firmy</span>
                  <span>{result.companyMargin.toLocaleString("pl-PL")} zł</span>
                </div>

                <div className="space-y-2">
                  {(Array.isArray(result?.breakdown)
                    ? result.breakdown
                    : []).map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-3 text-sm text-slate-700 dark:text-slate-300"
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

      {showClientRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/60">
            <h3 className="mb-2 text-lg font-bold text-slate-950 dark:text-slate-100">
              Najpierw wybierz klienta z CRM
            </h3>

            <p className="mb-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Żeby wygenerować PDF, oferta zostanie najpierw zapisana na karcie klienta w CRM. Wybierz klienta, a potem kliknij OK.
            </p>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Wyszukaj klienta</span>
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(event) => setClientSearchQuery(event.target.value)}
                placeholder="Wpisz imię, nazwisko, firmę, telefon, e-mail albo LeadID"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
              />
            </label>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {!normalizedClientSearchQuery ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                  Zacznij wpisywać, żeby wyszukać klienta.
                </p>
              ) : filteredCrmClients.length > 0 ? (
                filteredCrmClients.map((client) => {
                  const isSelected = modalSelectedClientId === client.id;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setModalSelectedClientId(client.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-500/20"
                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-950/20"
                      }`}
                    >
                      <span className="block font-semibold text-slate-950 dark:text-slate-100">{getClientDisplayName(client)}</span>
                      {getClientDisplayMeta(client) && (
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{getClientDisplayMeta(client)}</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                  Brak klientów pasujących do wyszukiwania.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowClientRequiredModal(false)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Anuluj
              </button>

              <button
                type="button"
                disabled={!modalSelectedClientId || isGeneratingPdf}
                onClick={async () => {
                  if (!modalSelectedClientId) return;
                  setSelectedClientId?.(modalSelectedClientId);
                  setShowClientRequiredModal(false);
                  await generatePdfAfterCrmSave(modalSelectedClientId);
                }}
                className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
              >
                {isGeneratingPdf ? "Zapisywanie..." : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/60">
            <h3 className="mb-3 text-lg font-bold text-slate-950 dark:text-slate-100">
              {confirmationText.title}
            </h3>

            <p className="mb-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {confirmationText.body}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSendConfirm(false)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                Nie, wróć
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!canSendOfferEmail) {
                    setShowSendConfirm(false);
                    setEmailStatus(
                      "Oferta nie została wysłana. Wybierz klienta CRM i podaj adres e-mail."
                    );
                    return;
                  }

                  setShowSendConfirm(false);
                  sendOfferEmail(sendMode);
                }}
                className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
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