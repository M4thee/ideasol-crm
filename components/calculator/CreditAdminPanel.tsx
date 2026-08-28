"use client";

import { useEffect, useState } from "react";

import type {
  CreditBank,
  CreditInterestRateType,
  CreditOffer,
} from "@/lib/calculator/creditCalculator";
import {
  getCreditBankLogoUrl,
  readImageAsDataUrl,
} from "@/lib/calculator/creditBankLogo";
import {
  canUseLocalCreditCatalog,
  getNextLocalId,
  readLocalCreditCatalog,
  writeLocalCreditCatalog,
} from "@/lib/calculator/localCreditCatalog";
import { supabase } from "@/lib/supabase";

type OfferForm = {
  bank_id: string;
  name: string;
  min_term_months: string;
  max_term_months: string;
  min_amount: string;
  max_amount: string;
  interest_rate_type: CreditInterestRateType;
  interest_rate: string;
};

const EMPTY_OFFER_FORM: OfferForm = {
  bank_id: "",
  name: "",
  min_term_months: "12",
  max_term_months: "120",
  min_amount: "5000",
  max_amount: "150000",
  interest_rate_type: "monthly_flat",
  interest_rate: "0.45",
};

function parseDecimal(value: string | number) {
  return Number(String(value).replace(",", "."));
}

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

function validateOffer(offer: Omit<CreditOffer, "id" | "active">) {
  if (!offer.name.trim()) return "Uzupełnij nazwę oferty.";
  if (!Number.isInteger(offer.min_term_months) || offer.min_term_months <= 0) {
    return "Minimalny okres musi być dodatnią liczbą miesięcy.";
  }
  if (!Number.isInteger(offer.max_term_months) || offer.max_term_months < offer.min_term_months) {
    return "Maksymalny okres nie może być krótszy niż minimalny.";
  }
  if (!Number.isFinite(offer.min_amount) || offer.min_amount <= 0) {
    return "Minimalna kwota musi być większa od 0 zł.";
  }
  if (!Number.isFinite(offer.max_amount) || offer.max_amount < offer.min_amount) {
    return "Maksymalna kwota nie może być niższa niż minimalna.";
  }
  if (!Number.isFinite(offer.interest_rate) || offer.interest_rate < 0) {
    return "Oprocentowanie nie może być ujemne.";
  }
  return null;
}

const inputClass = "rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function CreditAdminPanel() {
  const [banks, setBanks] = useState<CreditBank[]>([]);
  const [offers, setOffers] = useState<CreditOffer[]>([]);
  const [bankName, setBankName] = useState("");
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM);
  const [status, setStatus] = useState("Ładowanie banków i ofert...");
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [uploadingBankId, setUploadingBankId] = useState<number | null>(null);

  function applyLocalCatalog(message = "Tryb lokalny: dane są zapisywane tylko w tej przeglądarce.") {
    const catalog = readLocalCreditCatalog();
    setBanks(catalog.banks);
    setOffers(catalog.offers);
    setOfferForm((current) => ({
      ...current,
      bank_id: current.bank_id || String(catalog.banks[0]?.id || ""),
    }));
    setIsLocalMode(true);
    setStatus(message);
  }

  async function loadCatalog() {
    if (isLocalMode) {
      applyLocalCatalog();
      return;
    }

    const [banksResult, offersResult] = await Promise.all([
      supabase
        .from("credit_banks")
        .select("id, name, logo_path, display_order, active")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("credit_offers")
        .select("id, bank_id, name, min_term_months, max_term_months, min_amount, max_amount, interest_rate_type, interest_rate, active")
        .order("name", { ascending: true }),
    ]);

    if (banksResult.error || offersResult.error) {
      console.error("Błąd ładowania konfiguracji kredytowej", {
        banksError: banksResult.error,
        offersError: offersResult.error,
      });
      if (canUseLocalCreditCatalog()) {
        applyLocalCatalog();
        return;
      }
      setStatus("Nie udało się pobrać banków i ofert.");
      return;
    }

    const nextBanks = (banksResult.data || []).map((row) => normalizeBank(row));
    setBanks(nextBanks);
    setOffers((offersResult.data || []).map((row) => normalizeOffer(row)));
    setOfferForm((current) => ({
      ...current,
      bank_id: current.bank_id || String(nextBanks[0]?.id || ""),
    }));
    setStatus("");
  }

  useEffect(() => {
    let isCurrent = true;

    void Promise.all([
      supabase
        .from("credit_banks")
        .select("id, name, logo_path, display_order, active")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("credit_offers")
        .select("id, bank_id, name, min_term_months, max_term_months, min_amount, max_amount, interest_rate_type, interest_rate, active")
        .order("name", { ascending: true }),
    ]).then(([banksResult, offersResult]) => {
      if (!isCurrent) return;

      if (banksResult.error || offersResult.error) {
        console.error("Błąd ładowania konfiguracji kredytowej", {
          banksError: banksResult.error,
          offersError: offersResult.error,
        });
        if (canUseLocalCreditCatalog()) {
          applyLocalCatalog();
          return;
        }
        setStatus("Nie udało się pobrać banków i ofert.");
        return;
      }

      const nextBanks = (banksResult.data || []).map((row) => normalizeBank(row));
      setBanks(nextBanks);
      setOffers((offersResult.data || []).map((row) => normalizeOffer(row)));
      setOfferForm((current) => ({
        ...current,
        bank_id: current.bank_id || String(nextBanks[0]?.id || ""),
      }));
      setStatus("");
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function addBank() {
    const name = bankName.trim();
    if (!name) {
      setStatus("Uzupełnij nazwę banku.");
      return;
    }

    if (isLocalMode) {
      const catalog = readLocalCreditCatalog();
      const nextBank: CreditBank = {
        id: getNextLocalId(catalog.banks),
        name,
        logo_path: null,
        display_order: catalog.banks.length,
        active: true,
      };
      writeLocalCreditCatalog({ ...catalog, banks: [...catalog.banks, nextBank] });
      setBankName("");
      applyLocalCatalog("Bank został dodany lokalnie.");
      return;
    }

    setStatus("Dodawanie banku...");
    const { error } = await supabase.from("credit_banks").insert({
      name,
      display_order: banks.length,
      active: true,
    });

    if (error) {
      setStatus(`Nie udało się dodać banku: ${error.message}`);
      return;
    }

    setBankName("");
    await loadCatalog();
    setStatus("Bank został dodany.");
  }

  function updateBank<K extends keyof CreditBank>(bankId: number, field: K, value: CreditBank[K]) {
    setBanks((current) => current.map((bank) =>
      bank.id === bankId ? { ...bank, [field]: value } : bank
    ));
  }

  async function uploadBankLogo(bank: CreditBank, file: File) {
    const allowedExtensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
    };
    const extension = allowedExtensions[file.type];

    if (!extension || file.size === 0 || file.size > 2 * 1024 * 1024) {
      setStatus("Wybierz logo PNG lub JPG o rozmiarze do 2 MB.");
      return;
    }

    setUploadingBankId(bank.id);
    setStatus(`Wgrywanie logo banku ${bank.name}...`);

    try {
      if (isLocalMode) {
        const logoPath = await readImageAsDataUrl(file);
        const catalog = readLocalCreditCatalog();
        writeLocalCreditCatalog({
          ...catalog,
          banks: catalog.banks.map((item) => item.id === bank.id ? { ...item, logo_path: logoPath } : item),
        });
        applyLocalCatalog("Logo banku zostało zapisane lokalnie.");
        return;
      }

      const logoPath = await readImageAsDataUrl(file);
      const { error: updateError } = await supabase
        .from("credit_banks")
        .update({ logo_path: logoPath, updated_at: new Date().toISOString() })
        .eq("id", bank.id);

      if (updateError) throw updateError;

      await loadCatalog();
      setStatus("Logo banku zostało zapisane.");
    } catch (error) {
      console.error("Błąd wgrywania logo banku", error);
      setStatus(error instanceof Error ? error.message : "Nie udało się wgrać logo banku.");
    } finally {
      setUploadingBankId(null);
    }
  }

  async function removeBankLogo(bank: CreditBank) {
    if (!bank.logo_path) return;

    setUploadingBankId(bank.id);
    setStatus(`Usuwanie logo banku ${bank.name}...`);

    try {
      if (isLocalMode) {
        const catalog = readLocalCreditCatalog();
        writeLocalCreditCatalog({
          ...catalog,
          banks: catalog.banks.map((item) => item.id === bank.id ? { ...item, logo_path: null } : item),
        });
        applyLocalCatalog("Logo banku zostało usunięte lokalnie.");
        return;
      }

      const { error: updateError } = await supabase
        .from("credit_banks")
        .update({ logo_path: null, updated_at: new Date().toISOString() })
        .eq("id", bank.id);
      if (updateError) throw updateError;

      await loadCatalog();
      setStatus("Logo banku zostało usunięte.");
    } catch (error) {
      console.error("Błąd usuwania logo banku", error);
      setStatus(error instanceof Error ? error.message : "Nie udało się usunąć logo banku.");
    } finally {
      setUploadingBankId(null);
    }
  }

  async function saveBank(bank: CreditBank) {
    if (!bank.name.trim()) {
      setStatus("Nazwa banku nie może być pusta.");
      return;
    }

    if (isLocalMode) {
      const catalog = readLocalCreditCatalog();
      writeLocalCreditCatalog({
        ...catalog,
        banks: catalog.banks.map((item) => item.id === bank.id ? { ...bank, name: bank.name.trim() } : item),
      });
      applyLocalCatalog("Bank został zapisany lokalnie.");
      return;
    }

    setStatus(`Zapisywanie banku ${bank.name}...`);
    const { error } = await supabase
      .from("credit_banks")
      .update({
        name: bank.name.trim(),
        display_order: Number(bank.display_order),
        active: bank.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bank.id);

    if (error) {
      setStatus(`Nie udało się zapisać banku: ${error.message}`);
      return;
    }

    await loadCatalog();
    setStatus("Bank został zapisany.");
  }

  function updateOffer<K extends keyof CreditOffer>(offerId: number, field: K, value: CreditOffer[K]) {
    setOffers((current) => current.map((offer) =>
      offer.id === offerId ? { ...offer, [field]: value } : offer
    ));
  }

  async function saveOffer(offer: CreditOffer) {
    const validationError = validateOffer(offer);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    if (isLocalMode) {
      const catalog = readLocalCreditCatalog();
      writeLocalCreditCatalog({
        ...catalog,
        offers: catalog.offers.map((item) => item.id === offer.id ? { ...offer, name: offer.name.trim() } : item),
      });
      applyLocalCatalog("Oferta została zapisana lokalnie.");
      return;
    }

    setStatus(`Zapisywanie oferty ${offer.name}...`);
    const { error } = await supabase
      .from("credit_offers")
      .update({
        bank_id: offer.bank_id,
        name: offer.name.trim(),
        min_term_months: offer.min_term_months,
        max_term_months: offer.max_term_months,
        min_amount: offer.min_amount,
        max_amount: offer.max_amount,
        interest_rate_type: offer.interest_rate_type,
        interest_rate: offer.interest_rate,
        active: offer.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer.id);

    if (error) {
      setStatus(`Nie udało się zapisać oferty: ${error.message}`);
      return;
    }

    await loadCatalog();
    setStatus("Oferta została zapisana.");
  }

  async function addOffer() {
    const parsedOffer = {
      bank_id: Number(offerForm.bank_id),
      name: offerForm.name.trim(),
      min_term_months: Number(offerForm.min_term_months),
      max_term_months: Number(offerForm.max_term_months),
      min_amount: parseDecimal(offerForm.min_amount),
      max_amount: parseDecimal(offerForm.max_amount),
      interest_rate_type: offerForm.interest_rate_type,
      interest_rate: parseDecimal(offerForm.interest_rate),
    };
    const validationError = validateOffer(parsedOffer);

    if (!banks.some((bank) => bank.id === parsedOffer.bank_id)) {
      setStatus("Najpierw wybierz bank dla oferty.");
      return;
    }
    if (validationError) {
      setStatus(validationError);
      return;
    }

    if (isLocalMode) {
      const catalog = readLocalCreditCatalog();
      const nextOffer: CreditOffer = {
        id: getNextLocalId(catalog.offers),
        ...parsedOffer,
        active: true,
      };
      writeLocalCreditCatalog({ ...catalog, offers: [...catalog.offers, nextOffer] });
      setOfferForm({ ...EMPTY_OFFER_FORM, bank_id: offerForm.bank_id });
      applyLocalCatalog("Oferta została dodana lokalnie.");
      return;
    }

    setStatus("Dodawanie oferty...");
    const { error } = await supabase.from("credit_offers").insert({
      ...parsedOffer,
      active: true,
    });

    if (error) {
      setStatus(`Nie udało się dodać oferty: ${error.message}`);
      return;
    }

    setOfferForm({ ...EMPTY_OFFER_FORM, bank_id: offerForm.bank_id });
    await loadCatalog();
    setStatus("Oferta została dodana.");
  }

  return (
    <div className="space-y-6">
      {isLocalMode && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Tryb lokalny — banki i oferty są zapisane wyłącznie w tej przeglądarce. Baza produkcyjna nie została zmieniona.
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h3 className="text-xl font-bold text-slate-950 dark:text-slate-100">Banki</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kolejność określa układ banków w kalkulatorze doradcy. Nieaktywny bank nie jest wyświetlany.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
            placeholder="Nazwa banku"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => void addBank()}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-400"
          >
            Dodaj bank
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {banks.map((bank) => (
            <div key={bank.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950 sm:grid-cols-[92px_1fr_100px_auto_auto] sm:items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="h-14 w-20 rounded-xl border border-slate-200 bg-white bg-contain bg-center bg-no-repeat dark:border-slate-700"
                  style={bank.logo_path ? { backgroundImage: `url("${getCreditBankLogoUrl(bank.logo_path)}")` } : undefined}
                  aria-label={bank.logo_path ? `Logo banku ${bank.name}` : "Brak logo banku"}
                >
                  {!bank.logo_path && <span className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-400">Brak logo</span>}
                </div>
                <label className="cursor-pointer text-center text-[11px] font-semibold text-blue-600 hover:text-blue-500">
                  {uploadingBankId === bank.id ? "Wgrywanie..." : bank.logo_path ? "Zmień logo" : "Wgraj logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    disabled={uploadingBankId === bank.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadBankLogo(bank, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {bank.logo_path && (
                  <button
                    type="button"
                    onClick={() => void removeBankLogo(bank)}
                    disabled={uploadingBankId === bank.id}
                    className="text-[10px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    Usuń
                  </button>
                )}
              </div>
              <input
                value={bank.name}
                onChange={(event) => updateBank(bank.id, "name", event.target.value)}
                className={inputClass}
                aria-label="Nazwa banku"
              />
              <input
                type="number"
                value={bank.display_order}
                onChange={(event) => updateBank(bank.id, "display_order", Number(event.target.value))}
                className={inputClass}
                aria-label="Kolejność banku"
              />
              <button
                type="button"
                onClick={() => updateBank(bank.id, "active", !bank.active)}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${bank.active ? "bg-emerald-600 text-white" : "border border-slate-200 bg-slate-100 text-slate-500"}`}
              >
                {bank.active ? "Aktywny" : "Nieaktywny"}
              </button>
              <button
                type="button"
                onClick={() => void saveBank(bank)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
              >
                Zapisz
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h3 className="text-xl font-bold text-slate-950 dark:text-slate-100">Dodaj ofertę kredytową</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Wybierz sposób liczenia podany przez bank. Stawka miesięczna liczy koszt prosty, a oprocentowanie nominalne roczne — ratę annuitetową.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={offerForm.bank_id}
            onChange={(event) => setOfferForm({ ...offerForm, bank_id: event.target.value })}
            className={inputClass}
          >
            <option value="">Wybierz bank</option>
            {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
          </select>
          <input
            value={offerForm.name}
            onChange={(event) => setOfferForm({ ...offerForm, name: event.target.value })}
            placeholder="Nazwa oferty"
            className={`${inputClass} xl:col-span-2`}
          />
          <select
            value={offerForm.interest_rate_type}
            onChange={(event) => setOfferForm({ ...offerForm, interest_rate_type: event.target.value === "annual_nominal" ? "annual_nominal" : "monthly_flat" })}
            className={inputClass}
          >
            <option value="monthly_flat">Stawka miesięczna (koszt prosty)</option>
            <option value="annual_nominal">Oprocentowanie nominalne roczne</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={offerForm.interest_rate}
            onChange={(event) => setOfferForm({ ...offerForm, interest_rate: event.target.value })}
            placeholder={offerForm.interest_rate_type === "monthly_flat" ? "Stawka miesięczna %" : "Oprocentowanie roczne %"}
            className={inputClass}
          />
          <input type="number" min="1" value={offerForm.min_term_months} onChange={(event) => setOfferForm({ ...offerForm, min_term_months: event.target.value })} placeholder="Min. okres (mies.)" className={inputClass} />
          <input type="number" min="1" value={offerForm.max_term_months} onChange={(event) => setOfferForm({ ...offerForm, max_term_months: event.target.value })} placeholder="Maks. okres (mies.)" className={inputClass} />
          <input type="number" min="0" step="0.01" value={offerForm.min_amount} onChange={(event) => setOfferForm({ ...offerForm, min_amount: event.target.value })} placeholder="Min. kwota" className={inputClass} />
          <input type="number" min="0" step="0.01" value={offerForm.max_amount} onChange={(event) => setOfferForm({ ...offerForm, max_amount: event.target.value })} placeholder="Maks. kwota" className={inputClass} />
        </div>
        <button
          type="button"
          onClick={() => void addOffer()}
          disabled={banks.length === 0}
          className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dodaj ofertę
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-slate-950 dark:text-slate-100">Oferty w bazie</h3>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400" role="status">{status}</span>
        </div>

        <div className="mt-5 space-y-4">
          {offers.map((offer) => (
            <div key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select value={offer.bank_id} onChange={(event) => updateOffer(offer.id, "bank_id", Number(event.target.value))} className={inputClass} aria-label="Bank oferty">
                  {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                </select>
                <input value={offer.name} onChange={(event) => updateOffer(offer.id, "name", event.target.value)} className={`${inputClass} xl:col-span-2`} aria-label="Nazwa oferty" />
                <label className="text-xs font-semibold text-slate-500">Sposób liczenia<select value={offer.interest_rate_type} onChange={(event) => updateOffer(offer.id, "interest_rate_type", event.target.value === "annual_nominal" ? "annual_nominal" : "monthly_flat")} className={`${inputClass} mt-1 w-full`}><option value="monthly_flat">Stawka miesięczna (koszt prosty)</option><option value="annual_nominal">Oprocentowanie nominalne roczne</option></select></label>
                <label className="text-xs font-semibold text-slate-500">{offer.interest_rate_type === "monthly_flat" ? "Stawka miesięczna %" : "Oprocentowanie roczne %"}<input type="number" min="0" step="0.0001" value={offer.interest_rate} onChange={(event) => updateOffer(offer.id, "interest_rate", parseDecimal(event.target.value))} className={`${inputClass} mt-1 w-full`} /></label>
                <label className="text-xs font-semibold text-slate-500">Min. okres (mies.)<input type="number" min="1" value={offer.min_term_months} onChange={(event) => updateOffer(offer.id, "min_term_months", Number(event.target.value))} className={`${inputClass} mt-1 w-full`} /></label>
                <label className="text-xs font-semibold text-slate-500">Maks. okres (mies.)<input type="number" min="1" value={offer.max_term_months} onChange={(event) => updateOffer(offer.id, "max_term_months", Number(event.target.value))} className={`${inputClass} mt-1 w-full`} /></label>
                <label className="text-xs font-semibold text-slate-500">Min. kwota (zł)<input type="number" min="0" step="0.01" value={offer.min_amount} onChange={(event) => updateOffer(offer.id, "min_amount", parseDecimal(event.target.value))} className={`${inputClass} mt-1 w-full`} /></label>
                <label className="text-xs font-semibold text-slate-500">Maks. kwota (zł)<input type="number" min="0" step="0.01" value={offer.max_amount} onChange={(event) => updateOffer(offer.id, "max_amount", parseDecimal(event.target.value))} className={`${inputClass} mt-1 w-full`} /></label>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => updateOffer(offer.id, "active", !offer.active)} className={`rounded-xl px-3 py-2 text-sm font-bold ${offer.active ? "bg-emerald-600 text-white" : "border border-slate-200 bg-slate-100 text-slate-500"}`}>
                  {offer.active ? "Aktywna" : "Nieaktywna"}
                </button>
                <button type="button" onClick={() => void saveOffer(offer)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">
                  Zapisz ofertę
                </button>
              </div>
            </div>
          ))}
          {offers.length === 0 && !status && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Brak ofert kredytowych.</p>
          )}
        </div>
      </div>
    </div>
  );
}
