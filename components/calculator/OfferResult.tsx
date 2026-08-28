"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import SubsidyOptimizer from "@/components/SubsidyOptimizer";
import type { CustomPaymentSchedule } from "@/lib/customPaymentSchedule";
import { normalizeCustomOfferTitle } from "@/lib/calculator/customOffer";

type Result = {
  pvPowerKw: number;
  inverter: string;
  energyStorage: string;
  storage?: string;
  storageVoltageType?: "low_voltage" | "high_voltage";
  storageVoltageLabel?: string;
  storageCapacityKwh?: number;
  offerType: string;
  customOfferTitle?: string;
  customPaymentTerms?: string;
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
    euBonus?: number;
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
    qualifyingStorageCost?: number;
    qualifyingVat?: number;
    qualifyVat?: boolean;
    euBonusEligible?: boolean;
    storageIsEu?: boolean;
    inverterIsEu?: boolean;
  };
  basePriceNet: number;
  sellerMarkupNet: number;
  finalNet: number;
  finalGross: number;
  additionalServices?: {
    id: number | null;
    name: string;
    unitLabel?: string;
    unit_label?: string;
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

type CatalogCardEmailAttachment = {
  title: string;
  fileName: string;
  url: string;
};

type QuickEditOption = {
  value: string;
  label: string;
};

export type EquipmentQuickEdit = {
  panel?: {
    value: string;
    options: QuickEditOption[];
    onChange: (value: string) => void;
  };
  storage?: {
    value: string;
    options: QuickEditOption[];
    onChange: (value: string) => void;
  };
  inverter?: {
    value: string;
    options: QuickEditOption[];
    onChange: (value: string) => void;
  };
};

export type OfferEmailOptions = {
  sellerNote: string;
  includeOfferPdf: boolean;
  offerPdfPayload: Record<string, unknown>;
};

type OfferResultProps = {
  result: Result;
  panelCount: number;
  panelPowerWp: number;
  panelName: string;
  identicalSetCount?: number;
  customPaymentSchedule?: CustomPaymentSchedule;
  copied: boolean;
  copyOffer: () => void;
  resetForm: () => void;
  setResult: (value: Result | null) => void;
  setCopied: (value: boolean) => void;
  setEmailStatus: (value: string) => void;
  catalogCards?: CatalogCardEmailAttachment[];
  includeCatalogCards?: boolean;
  setIncludeCatalogCards?: (value: boolean) => void;
  clientEmail: string;
  clientName: string;
  setClientEmail: (value: string) => void;
  sendOfferEmail: (
    mode?: "anonymous" | "public",
    options?: OfferEmailOptions
  ) => void | Promise<void>;
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
  compact?: boolean;
  wide?: boolean;
  hideSubsidy?: boolean;
  equipmentQuickEdit?: EquipmentQuickEdit;
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

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export default function OfferResult({
  result,
  panelCount,
  panelPowerWp,
  panelName,
  identicalSetCount = 1,
  customPaymentSchedule,
  copied,
  copyOffer,
  resetForm,
  setResult,
  setCopied,
  setEmailStatus,
  catalogCards = [],
  includeCatalogCards = false,
  setIncludeCatalogCards,
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
  compact = false,
  wide = false,
  hideSubsidy = false,
  equipmentQuickEdit,
}: OfferResultProps) {
  const [showMarginSummary, setShowMarginSummary] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  const [sendMode, setSendMode] = useState<"anonymous" | "public">("anonymous");
  const [sellerNote, setSellerNote] = useState("");
  const [includeOfferPdf, setIncludeOfferPdf] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isMailPanelOpen, setIsMailPanelOpen] = useState(false);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [showClientRequiredModal, setShowClientRequiredModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [modalSelectedClientId, setModalSelectedClientId] = useState(selectedClientId || "");
  const [quickEditTarget, setQuickEditTarget] = useState<"panel" | "storage" | "inverter" | null>(null);

  const selectedCrmClient = crmClients.find((client) => client.id === selectedClientId);
  const selectedCrmClientEmail = selectedCrmClient?.email?.trim() || "";
  const normalizedClientEmail = clientEmail.trim();
  const hasSelectedCrmClient = Boolean(selectedClientId);
  const hasSelectedCrmClientEmail = Boolean(selectedCrmClientEmail);
  const canSendOfferEmail = hasSelectedCrmClient && Boolean(normalizedClientEmail);
  const storageDisplayName = result.energyStorage || result.storage || "Brak";
  const hasCatalogCards = catalogCards.length > 0;

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


  const inverterGrossFromBreakdown = inverterNetFromBreakdown * (1 + result.vatRate / 100);
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

  function getOfferPdfPayload(): Record<string, unknown> {
    const inverterPdfParts = getInverterPdfParts();

    return {
      clientName: clientName || clientEmail || "Klient",
      offerType: result.offerType,
      customOfferTitle:
        result.offerType === "custom"
          ? normalizeCustomOfferTitle(result.customOfferTitle)
          : undefined,
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
      energyStorage: storageDisplayName,
      pvNet: pvNetForPdf,
      pvGross: pvGrossForPdf,
      storageNet: storageNetForPdf,
      storageGross: storageGrossForPdf,
      // EMS jest funkcją falownika, więc nie trafia do PDF jako osobna pozycja cenowa.
      withEms: false,
      emsName: "",
      emsNet: 0,
      emsGross: 0,
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
      customPaymentSchedule,
      customPaymentTerms: result.customPaymentTerms,
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

      const response = await fetch("/api/generate-offer-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(getOfferPdfPayload()),
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

  const compactSubsidyTotal = result.subsidyAllocation?.enabled
    ? Number(result.subsidyAllocation.total || 0)
    : 0;

  function renderQuickEditor(target: "panel" | "storage" | "inverter") {
    const editor = equipmentQuickEdit?.[target];

    if (!editor || quickEditTarget !== target) return null;

    return (
      <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
        <label className="sr-only" htmlFor={`quick-edit-${target}`}>Wybierz nowy model</label>
        <select
          id={`quick-edit-${target}`}
          autoFocus
          value={editor.value}
          onChange={(event) => {
            editor.onChange(event.target.value);
            setQuickEditTarget(null);
          }}
          onBlur={() => setQuickEditTarget(null)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-900/30"
        >
          {editor.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    );
  }

  function renderEditButton(target: "panel" | "storage" | "inverter", label: string) {
    if (!equipmentQuickEdit?.[target]) return null;

    return (
      <button
        type="button"
        aria-label={`Edytuj ${label}`}
        aria-expanded={quickEditTarget === target}
        onClick={() => setQuickEditTarget((current) => current === target ? null : target)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
      >
        <PencilIcon />
      </button>
    );
  }

  return (
    <section className={compact ? "relative" : "relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-lg shadow-slate-200/70 ring-1 ring-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 dark:ring-slate-800 sm:p-6"}>
      {compact ? (
        <div className={wide ? "space-y-5" : "space-y-3"}>
          <div className={wide ? "grid items-start gap-5 lg:grid-cols-[0.8fr_1.2fr]" : "contents"}>
          <div className={`${wide ? "p-5" : "p-3"} rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/55 shadow-sm shadow-emerald-100/40 dark:border-emerald-900/50 dark:from-slate-900 dark:to-emerald-950/20`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`${wide ? "text-xs" : "text-[10px]"} font-black uppercase tracking-[0.16em] text-slate-400`}>Rozliczenie</p>
                {clientName && <p className={`${wide ? "text-sm" : "text-xs"} mt-1 truncate font-bold text-slate-700 dark:text-slate-200`}>{clientName}</p>}
              </div>
              <button
                type="button"
                onClick={resetForm}
                className={`${wide ? "px-4 py-2 text-xs" : "px-3 py-1.5 text-[10px]"} rounded-full bg-slate-100 font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:hover:text-white`}
              >
                Wyczyść
              </button>
            </div>

            <div className={`${wide ? "mt-5 gap-4 pt-5" : "mt-3 gap-2 pt-3"} grid grid-cols-3 border-t border-slate-100 dark:border-slate-800`}>
              <div><p className={`${wide ? "text-[11px]" : "text-[9px]"} uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70`}>Netto</p><p className={`${wide ? "mt-2 text-lg" : "mt-1 text-xs"} font-bold text-slate-900 dark:text-white`}>{result.finalNet.toLocaleString("pl-PL")} zł</p></div>
              <div><p className={`${wide ? "text-[11px]" : "text-[9px]"} uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70`}>VAT</p><p className={`${wide ? "mt-2 text-lg" : "mt-1 text-xs"} font-bold text-slate-900 dark:text-white`}>{result.vatRate}%</p></div>
              <div><p className={`${wide ? "text-[11px]" : "text-[9px]"} uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70`}>{result.offerType === "custom" ? "Pozycji" : "Dotacja"}</p><p className={`${wide ? "mt-2 text-lg" : "mt-1 text-xs"} font-bold text-emerald-700 dark:text-emerald-300`}>{result.offerType === "custom" ? additionalServices.length : compactSubsidyTotal > 0 ? `${compactSubsidyTotal.toLocaleString("pl-PL")} zł` : "—"}</p></div>
            </div>
          </div>

          {result.offerType !== "custom" ? <div className={`${wide ? "p-5" : "p-3"} rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
            <p className={`${wide ? "mb-3 text-xs" : "mb-2 text-[10px]"} font-black uppercase tracking-[0.16em] text-slate-400`}>Konfiguracja</p>
            <div className="space-y-2">
              {result.offerType !== "storage" && result.offerType !== "custom" && (
                <div className={`${wide ? "p-4" : "p-3"} rounded-xl border border-sky-100 bg-sky-50/65 dark:border-sky-900/40 dark:bg-sky-950/20`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" /><p className={`${wide ? "text-base" : "text-xs"} font-bold text-slate-900 dark:text-white`}>Fotowoltaika</p>{renderEditButton("panel", "fotowoltaikę")}</div><p className={`${wide ? "mt-1.5 text-sm" : "mt-1 text-[10px]"} truncate text-slate-500`}>{panelCount} × {panelPowerWp} Wp · {panelName}</p></div>
                    <p className={`${wide ? "text-xl" : "text-sm"} shrink-0 font-black text-sky-700 dark:text-sky-300`}>{result.pvPowerKw} kWp</p>
                  </div>
                  {renderQuickEditor("panel")}
                </div>
              )}
              {storageDisplayName !== "Brak" && (
                <div className={`${wide ? "p-4" : "p-3"} rounded-xl border border-violet-100 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-400" /><p className={`${wide ? "text-base" : "text-xs"} font-bold text-slate-900 dark:text-white`}>Magazyn energii</p>{renderEditButton("storage", "magazyn energii")}</div><p className={`${wide ? "mt-1.5 text-sm" : "mt-1 text-[10px]"} break-words text-slate-500`}>{storageDisplayName}</p></div>
                    <p className={`${wide ? "text-sm" : "text-xs"} shrink-0 font-bold text-violet-700 dark:text-violet-300`}>{result.storageVoltageLabel || ""}</p>
                  </div>
                  {renderQuickEditor("storage")}
                </div>
              )}
              {result.inverter !== "Brak" && (
                <div className={`${wide ? "p-4" : "p-3"} rounded-xl border border-amber-100 bg-amber-50/65 dark:border-amber-900/40 dark:bg-amber-950/20`}>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /><p className={`${wide ? "text-base" : "text-xs"} font-bold text-slate-900 dark:text-white`}>Falownik</p>{renderEditButton("inverter", "falownik")}</div>
                  <p className={`${wide ? "mt-1.5 text-sm leading-5" : "mt-1 text-[10px] leading-4"} break-words text-slate-500`}>{result.inverter}</p>
                  {renderQuickEditor("inverter")}
                </div>
              )}
            </div>
          </div> : null}
          </div>

          {additionalServices.length > 0 && (
            <div className={`${wide ? "p-5" : "p-3"} rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
              <div className="flex items-center justify-between gap-3"><p className={`${wide ? "text-base" : "text-xs"} font-bold text-slate-900 dark:text-white`}>{result.offerType === "custom" ? "Pozycje oferty" : "Usługi dodatkowe"}</p><p className={`${wide ? "text-base" : "text-xs"} font-black`}>{additionalServicesNet.toLocaleString("pl-PL")} zł netto</p></div>
              <p className={`${wide ? "mt-2 text-sm leading-5" : "mt-1 text-[10px] leading-4"} line-clamp-2 text-slate-500`}>{additionalServices.map((service) => service.name).join(" · ")}</p>
            </div>
          )}

          <div className={`${wide ? "gap-4" : "gap-2"} grid grid-cols-3`}>
            <button type="button" onClick={downloadOfferPdf} disabled={isGeneratingPdf} className={`${wide ? "min-h-24 p-4" : "min-h-20 p-2"} flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>
              <FileTextIcon /><span className={`${wide ? "text-sm" : "text-[10px]"} font-bold`}>PDF</span>
            </button>
            <button type="button" onClick={() => setIsMailPanelOpen((current) => !current)} aria-expanded={isMailPanelOpen} className={`${wide ? "min-h-24 p-4" : "min-h-20 p-2"} flex flex-col items-center justify-center gap-2 rounded-2xl border transition ${isMailPanelOpen ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>
              <MailIcon /><span className={`${wide ? "text-sm" : "text-[10px]"} font-bold`}>E-mail</span>
            </button>
            <button type="button" onClick={copyOffer} className={`${wide ? "min-h-24 p-4" : "min-h-20 p-2"} flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>
              <CopyIcon /><span className={`${wide ? "text-sm" : "text-[10px]"} font-bold`}>Kopiuj</span>
            </button>
          </div>

          {saveOfferToCrm && (
            savedOfferId ? (
              <Link href={`/offers/${savedOfferId}?createSale=1`} className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400">Wygeneruj sprzedaż</Link>
            ) : (
              <button type="button" onClick={handleSaveOfferToCrm} disabled={savingOffer || showSaveAnimation || !selectedClientId} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800">
                {savingOffer || showSaveAnimation ? "Zapisywanie..." : "Zapisz ofertę w CRM"}
              </button>
            )
          )}

          {isMailPanelOpen && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">E-mail klienta</span><input type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} disabled={!selectedClientId} placeholder={selectedClientId ? "Wpisz e-mail klienta" : "Najpierw wybierz klienta CRM"} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Notatka</span><textarea value={sellerNote} onChange={(event) => setSellerNote(event.target.value)} maxLength={2000} placeholder="Opcjonalna wiadomość" className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={includeOfferPdf} onChange={(event) => setIncludeOfferPdf(event.target.checked)} className="h-4 w-4 accent-slate-950 dark:accent-white" />Dołącz ofertę PDF</label>
              {hasCatalogCards && <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={includeCatalogCards} onChange={(event) => setIncludeCatalogCards?.(event.target.checked)} className="h-4 w-4 accent-slate-950 dark:accent-white" />Dołącz karty katalogowe</label>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSendMode("anonymous")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${sendMode === "anonymous" ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>Anonimowo</button>
                <button type="button" onClick={() => setSendMode("public")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${sendMode === "public" ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>Jawnie</button>
              </div>
              <button type="button" disabled={sendingEmail || !canSendOfferEmail} onClick={() => setShowSendConfirm(true)} className="w-full rounded-xl bg-slate-950 px-3 py-3 text-xs font-black text-white disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-950 dark:disabled:bg-slate-800">{sendingEmail ? "Wysyłanie..." : "Wyślij ofertę"}</button>
            </div>
          )}

          {(copied || pdfStatus || saveOfferStatus || emailStatus) && (
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] leading-4 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{copied ? "Skopiowano treść oferty. " : ""}{pdfStatus || saveOfferStatus || emailStatus}</div>
          )}

          {canSeeMarginSummary && (
            <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
              <button type="button" onClick={() => setShowMarginSummary((current) => !current)} className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-500"><span>Dane techniczne</span><span>{showMarginSummary ? "Zwiń" : "Rozwiń"}</span></button>
              {showMarginSummary && <div className="mt-3 space-y-1.5 text-[10px] text-slate-500"><div className="flex justify-between gap-3 font-bold"><span>Marża firmy</span><span>{result.companyMargin.toLocaleString("pl-PL")} zł</span></div>{result.breakdown.map((item) => <div key={item.label} className="flex justify-between gap-3"><span>{item.label}</span><span className="shrink-0">{item.value.toLocaleString("pl-PL")} zł</span></div>)}</div>}
            </div>
          )}
        </div>
      ) : (
        <>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-teal-400" />
      <div className={`${compact ? "mb-3" : "mb-6"} flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">{wide ? "Wycena" : "Krok 2"}</p>
          <h2 className={`${wide ? "text-2xl" : "text-lg sm:text-xl"} font-bold text-slate-950 dark:text-slate-100`}>{wide ? "Szczegóły oferty" : "Oferta dla klienta"}</h2>
        </div>

        <div className={`${compact ? "flex w-full justify-end sm:w-auto" : "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"}`}>
          {!compact && (
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
          )}

          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className={compact ? "space-y-2.5" : "space-y-4"}>
        <div className={compact ? "grid grid-cols-2 gap-2" : wide ? "grid gap-4 lg:grid-cols-2" : "contents"}>
        {result.offerType !== "storage" && result.offerType !== "custom" && (
          <div className={`${compact ? "rounded-xl p-3" : "rounded-2xl p-4 shadow-sm ring-1 ring-slate-100"} border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">Moc instalacji</p>
            <p className="text-xl font-bold text-slate-950 dark:text-slate-100 sm:text-2xl">{result.pvPowerKw} kWp</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {panelCount} paneli × {panelPowerWp} Wp
            </p>
          </div>
        )}

        {result.inverter !== "Brak" && (
          <div className={`${compact ? "rounded-xl p-3" : "rounded-2xl p-4 shadow-sm ring-1 ring-slate-100"} border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">Falownik</p>
            <p className="break-words text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">{result.inverter}</p>
          </div>
        )}

        {storageDisplayName !== "Brak" && (
          <div className={`${compact ? "col-span-2 rounded-xl p-3" : `rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 ${wide ? "lg:col-span-2" : ""}`} border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">Magazyn energii</p>
            <p className="break-words text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">{storageDisplayName}</p>
          </div>
        )}
        </div>

        {hasCatalogCards && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm ring-1 ring-blue-100 dark:border-blue-500/30 dark:bg-blue-950/25 dark:ring-blue-500/20">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Karty katalogowe</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {catalogCards.map((card) => (
                <a
                  key={`${card.title}-${card.url}`}
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-slate-950 dark:text-blue-200 dark:hover:bg-blue-950/40 sm:text-sm"
                  title={`Otwórz kartę katalogową: ${card.title}`}
                >
                  <FileTextIcon />
                  PDF - {card.title}
                </a>
              ))}
            </div>
          </div>
        )}

        {additionalServices.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {result.offerType === "custom" ? "Pozycje oferty" : "Usługi dodatkowe"}
                </p>
                <div className="mt-2 space-y-2">
                  {additionalServices.map((service) => (
                    <div
                      key={`${service.id}-${service.name}`}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {service.name}
                          {service.quantity > 1
                            ? ` x ${service.quantity} ${service.unitLabel || service.unit_label || "szt."}`
                            : ""}
                        </p>
                        {service.quantity > 1 && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {Math.round(service.priceNet).toLocaleString("pl-PL")} zł netto / {service.unitLabel || service.unit_label || "szt."}
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

        {result.offerType === "custom" && result.customPaymentTerms?.trim() ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className={`${wide ? "text-base" : "text-sm"} font-bold text-slate-900 dark:text-white`}>
              Forma rozliczenia / warunki płatności
            </p>
            <p className={`${wide ? "mt-3 text-sm leading-6" : "mt-2 text-xs leading-5"} whitespace-pre-wrap text-slate-600 dark:text-slate-300`}>
              {result.customPaymentTerms.trim()}
            </p>
          </section>
        ) : null}

        <div className={compact ? "grid grid-cols-2 gap-2" : wide ? "grid gap-4 lg:grid-cols-2" : "contents"}>
        <div className={`${compact ? "rounded-xl p-3" : "rounded-2xl p-4 shadow-sm ring-1 ring-slate-100"} border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800`}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cena netto</p>
          <p className="text-xl font-bold text-slate-950 dark:text-slate-100 sm:text-2xl">
            {result.finalNet.toLocaleString("pl-PL")} zł
          </p>
        </div>

        <div className={`${compact ? "rounded-xl p-3" : "rounded-3xl p-4 shadow-xl shadow-emerald-200 sm:p-5"} bg-gradient-to-br from-emerald-600 to-teal-500 text-white dark:shadow-black/30`}>
          <p className="text-sm font-semibold">Cena brutto {result.vatRate}%</p>
          <p className="break-words text-2xl font-black text-white sm:text-3xl">
            {result.finalGross.toLocaleString("pl-PL")} zł
          </p>
        </div>
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

        <div className={wide ? "grid gap-4 sm:grid-cols-3" : "flex flex-wrap items-start gap-6"}>
          <div className={wide ? "" : "flex flex-col items-center gap-1"}>
            <button
              type="button"
              onClick={downloadOfferPdf}
              disabled={isGeneratingPdf}
              className={`${wide ? "h-16 w-full gap-3 px-4 text-base font-bold" : "h-11 w-11"} inline-flex items-center justify-center rounded-xl border border-[#00AB87]/30 bg-white text-[#00AB87] shadow-none transition hover:border-[#00AB87] hover:bg-[#00AB87]/5 disabled:border-slate-200 disabled:text-slate-300 dark:bg-slate-950 dark:hover:bg-emerald-950/30 dark:disabled:border-slate-700 dark:disabled:text-slate-600`}
              aria-label="Pobierz PDF"
              title="Pobierz PDF"
            >
              <FileTextIcon />
              <span className={wide ? "" : "sr-only"}>Pobierz PDF</span>
            </button>
            {!wide && <span className="max-w-[90px] text-center text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">Pobierz PDF</span>}
          </div>

          <div className={wide ? "" : "flex flex-col items-center gap-1"}>
            <button
              type="button"
              onClick={() => setIsMailPanelOpen((current) => !current)}
              className={`${wide ? "h-16 w-full gap-3 px-4 text-base font-bold" : "h-11 w-11"} inline-flex items-center justify-center rounded-xl border border-[#00AB87]/30 bg-white text-[#00AB87] shadow-none transition hover:border-[#00AB87] hover:bg-[#00AB87]/5 dark:bg-slate-950 dark:hover:bg-emerald-950/30`}
              aria-expanded={isMailPanelOpen}
              aria-label="Pokaż wysyłkę mailem"
              title="Wyślij mailem"
            >
              <MailIcon />
              {wide && <span>Wyślij e-mail</span>}
            </button>
            {!wide && <span className="max-w-[90px] text-center text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">Wyślij e-mail</span>}
          </div>

          <div className={wide ? "" : "flex flex-col items-center gap-1"}>
            <button
              type="button"
              onClick={copyOffer}
              className={`${wide ? "h-16 w-full gap-3 px-4 text-base font-bold" : "h-11 w-11"} inline-flex items-center justify-center rounded-xl border border-[#00AB87]/30 bg-white text-[#00AB87] shadow-none transition hover:border-[#00AB87] hover:bg-[#00AB87]/5 dark:bg-slate-950 dark:hover:bg-emerald-950/30`}
              aria-label="Kopiuj treść maila"
              title="Kopiuj treść maila"
            >
              <CopyIcon />
              {wide && <span>Kopiuj treść</span>}
            </button>
            {!wide && <span className="max-w-[90px] text-center text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">Kopiuj treść do schowka</span>}
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

            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Notatka od handlowca (opcjonalnie)
              </span>
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/20 sm:text-base"
                placeholder="Wpisz własną wiadomość, która pojawi się w treści maila."
                value={sellerNote}
                maxLength={2000}
                onChange={(event) => setSellerNote(event.target.value)}
              />
              <span className="mt-1 block text-right text-xs text-slate-500 dark:text-slate-400">
                {sellerNote.length}/2000
              </span>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={includeOfferPdf}
                  onChange={(event) => setIncludeOfferPdf(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Dołącz ofertę PDF
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    Do maila zostanie dołączony ten sam dokument, który można pobrać przyciskiem „Pobierz PDF”.
                  </span>
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  checked={includeCatalogCards && hasCatalogCards}
                  disabled={!hasCatalogCards || !setIncludeCatalogCards}
                  onChange={(event) => setIncludeCatalogCards?.(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Dołącz karty katalogowe jako załączniki PDF
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {hasCatalogCards
                      ? `Do maila zostanie dołączone ${catalogCards.length} plik(i): ${catalogCards
                        .map((card) => card.title)
                        .join(", ")}.`
                      : "Brak przypisanych kart katalogowych dla wybranych urządzeń."}
                  </span>
                </span>
              </label>
            </div>

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

        {!hideSubsidy && storageDisplayName !== "Brak" &&
          (result.includeSubsidy || result.subsidyAllocation?.requested) && (
          <SubsidyOptimizer
            totalOfferNetPrice={result.finalNet}
            allocation={result.subsidyAllocation}
            compact={compact}
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

        </>
      )}

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
                  void sendOfferEmail(sendMode, {
                    sellerNote: sellerNote.trim(),
                    includeOfferPdf,
                    offerPdfPayload: getOfferPdfPayload(),
                  });
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
