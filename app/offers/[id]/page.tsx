

"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";


type UserRole = "owner" | "admin" | "manager" | "seller" | "cc" | null;

type SaleCustomerType = "b2c" | "b2b";

type SaleFromOfferForm = {
  customerType: SaleCustomerType;
  fullName: string;
  companyName: string;
  nip: string;
  regon: string;
  representativeName: string;
  pesel: string;
  phone: string;
  email: string;
  contractStreet: string;
  contractBuildingNumber: string;
  contractPostalCode: string;
  contractCity: string;
  correspondenceSameAsContract: boolean;
  correspondenceAddress: string;
  installationSameAsContract: boolean;
  installationAddress: string;
  paymentMethod: string;
  ownContributionAmount: string;
  depositAmount: string;
  secondClientName: string;
  secondClientPesel: string;
  contractSequence: string;
  contractPlace: string;
  contractDate: string;
  depositDueDate: string;
  visitPreviouslyScheduled: boolean | null;
  realizationVariant: "1A" | "1B" | "";
  client1MarketingEmail: boolean;
  client1MarketingPhone: boolean;
  client1PhotoConsent: boolean;
  client2MarketingEmail: boolean;
  client2MarketingPhone: boolean;
  client2PhotoConsent: boolean;
};

type ClientOffer = {
  id: string;
  offer_public_id: string | null;
  client_id: string;
  created_by: string;
  offer_type: string | null;
  status: string | null;
  client_name: string | null;
  client_email: string | null;
  sale_price_net: number | null;
  sale_price_gross: number | null;
  vat_rate: number | null;
  seller_margin: number | null;
  company_margin: number | null;
  pv_power_kw: number | null;
  panel_model: string | null;
  panel_count: number | null;
  panel_power_wp: number | null;
  inverter: string | null;
  energy_storage: string | null;
  roof_type: string | null;
  offer_data: Record<string, any> | null;
  created_at: string;
  updated_at: string | null;
};

type ClientData = {
  id: string;
  public_id?: number | null;
  assigned_to?: string | null;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  city: string | null;
  pesel?: string | null;
  nip?: string | null;
  regon?: string | null;
  contact_person?: string | null;
};

type UserProfile = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: UserRole;
  name?: string | null;
  username?: string | null;
  user_number?: number | string | null;
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "Brak";

  return `${Number(value).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

function numberValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "Brak";
  return `${Number(value).toLocaleString("pl-PL")} ${suffix}`.trim();
}

function technicalValue(value: unknown, suffix = "") {
  if (value === null || value === undefined || value === "") return "Brak";

  if (typeof value === "number") {
    return `${value.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${suffix}`.trim();
  }

  return `${String(value)} ${suffix}`.trim();
}

function getTechnicalResultValue(result: Record<string, any> | null, keys: string[]) {
  if (!result) return null;

  for (const key of keys) {
    if (result[key] !== null && result[key] !== undefined && result[key] !== "") {
      return result[key];
    }
  }

  return null;
}

function humanizeKey(key: string) {
  const dictionary: Record<string, string> = {
    finalNet: "Cena sprzedaży netto",
    finalGross: "Cena sprzedaży brutto",
    vatRate: "VAT",
    companyMargin: "Marża firmy",
    sellerMarkup: "Narzut doradcy",
    pvPowerKw: "Moc PV",
    panelCostNet: "Koszt paneli netto",
    inverterCostNet: "Koszt falownika netto",
    storageCostNet: "Koszt magazynu netto",
    installationCostNet: "Koszt montażu netto",
    protectionsCostNet: "Koszt zabezpieczeń netto",
    wiringCostNet: "Koszt okablowania netto",
    transportCostNet: "Koszt transportu netto",
    documentationCostNet: "Koszt dokumentacji netto",
    marketingCostNet: "Koszt marketingu netto",
    warrantyCostNet: "Koszt gwarancji netto",
    operatorCostNet: "Koszt operatora netto",
    totalCostNet: "Koszt całkowity netto",
    baseCostNet: "Koszt bazowy netto",
    totalNetCost: "Koszt całkowity netto",
    totalEquipmentNet: "Koszt sprzętu netto",
    equipmentCostNet: "Koszt sprzętu netto",
    marginNet: "Marża netto",
    profitNet: "Zysk netto",
    basePriceNet: "Cena bazowa netto",
    managerOverrideGrossNet: "Narzut managerski netto",
    managerOverrideGrossPerOwnerNet: "Narzut managerski na właściciela netto",
    managerOverrideNet: "Narzut managerski netto",
    managerOverridePerOwnerNet: "Narzut managerski na właściciela netto",
    managerWarrantyFeeNet: "Opłata gwarancyjna managera netto",
    marketingNet: "Marketing netto",
    operatorFeeNet: "Opłata operatora netto",
    operatorFeePerOwnerNet: "Opłata operatora na właściciela netto",
    sellerCommissionNet: "Prowizja doradcy netto",
    sellerMarkupNet: "Marża doradcy netto",
    ownerMarginNet: "Marża właściciela netto",
    ownerMarginPerOwnerNet: "Marża na właściciela netto",
    warrantyFeeNet: "Opłata gwarancyjna netto",
    totalOwnerMarginNet: "Łączna marża właścicieli netto",
    totalSellerCostNet: "Łączny koszt doradcy netto",
    totalSystemCostNet: "Łączny koszt systemu netto",
    grossProfitNet: "Zysk brutto netto",
    netProfit: "Zysk netto",
  };

  if (dictionary[key]) return dictionary[key];

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\bnet\b/g, "netto")
    .replace(/\bgross\b/g, "brutto")
    .replace(/\bprice\b/g, "cena")
    .replace(/\bcost\b/g, "koszt")
    .replace(/\bfee\b/g, "opłata")
    .replace(/\bmargin\b/g, "marża")
    .replace(/\bcommission\b/g, "prowizja")
    .replace(/\bseller\b/g, "doradcy")
    .replace(/\bowner\b/g, "właściciela")
    .replace(/\bmanager\b/g, "manager")
    .replace(/\boperator\b/g, "operatora")
    .replace(/\bmarketing\b/g, "marketing")
    .replace(/^./, (char) => char.toUpperCase());
}

function shouldFormatAsMoney(key: string) {
  const lowered = key.toLowerCase();

  return (
    lowered.includes("cost") ||
    lowered.includes("price") ||
    lowered.includes("margin") ||
    lowered.includes("markupnet") ||
    lowered.includes("profit") ||
    lowered.includes("net") ||
    lowered.includes("gross") ||
    lowered.includes("commission")
  );
}

function shouldFormatAsPercent(key: string) {
  const lowered = key.toLowerCase();

  return lowered.includes("percent") || lowered.includes("rate") || lowered === "vat" || lowered === "vatrate";
}

function shouldSkipTechnicalField(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "object") return true;

  const lowered = key.toLowerCase();

  return ["emailbody", "clientemail", "clientname"].includes(lowered);
}

function formatTechnicalField(key: string, value: unknown) {
  if (typeof value === "number") {
    if (shouldFormatAsPercent(key)) return numberValue(value, "%");
    if (shouldFormatAsMoney(key)) return money(value);
    return numberValue(value);
  }

  return String(value);
}

function getTechnicalRows(result: Record<string, any> | null) {
  if (!result) return [];

  return Object.entries(result)
    .filter(([key, value]) => !shouldSkipTechnicalField(key, value))
    .map(([key, value]) => ({
      key,
      label: humanizeKey(key),
      value: formatTechnicalField(key, value),
      isMoneyLike: shouldFormatAsMoney(key),
    }))
    .sort((a, b) => {
      if (a.isMoneyLike && !b.isMoneyLike) return -1;
      if (!a.isMoneyLike && b.isMoneyLike) return 1;
      return a.label.localeCompare(b.label, "pl");
    });
}

function getSavedBreakdownRows(result: Record<string, any> | null) {
  if (!result || !Array.isArray(result.breakdown)) return [];

  return result.breakdown
    .filter((item) => item && typeof item.label === "string")
    .map((item) => ({
      label: item.label,
      value: typeof item.value === "number" ? item.value : Number(item.value || 0),
    }));
}

function getOfferAdditionalServices(offer: ClientOffer | null) {
  if (!offer) return [];

  const offerData = (offer.offer_data || {}) as Record<string, any>;
  const resultData = (offerData.result || {}) as Record<string, any>;
  const formData = (offerData.form || {}) as Record<string, any>;

  const source = Array.isArray(offerData.additionalServices)
    ? offerData.additionalServices
    : Array.isArray(offerData.additional_services)
      ? offerData.additional_services
      : Array.isArray(formData.additionalServices)
        ? formData.additionalServices
        : Array.isArray(formData.additional_services)
          ? formData.additional_services
          : Array.isArray(resultData.additionalServices)
            ? resultData.additionalServices
            : Array.isArray(resultData.additional_services)
              ? resultData.additional_services
              : [];

  return source
    .map((service: Record<string, any>) => {
      const priceNet = Number(service.price_net ?? service.priceNet ?? service.price_netto ?? 0);
      const quantity = Math.max(1, Math.round(Number(service.quantity || 1)));
      const totalNet = Number(service.totalNet ?? service.total_net ?? priceNet * quantity);

      return {
        id: service.id ?? null,
        name: String(service.name || service.label || service.title || "Usługa dodatkowa"),
        price_net: Number.isFinite(priceNet) ? priceNet : 0,
        priceNet: Number.isFinite(priceNet) ? priceNet : 0,
        allows_quantity: Boolean(service.allows_quantity ?? service.allowsQuantity),
        allowsQuantity: Boolean(service.allows_quantity ?? service.allowsQuantity),
        quantity,
        total_net: Number.isFinite(totalNet) ? totalNet : 0,
        totalNet: Number.isFinite(totalNet) ? totalNet : 0,
      };
    })
    .filter((service: Record<string, any>) => service.name.trim().length > 0);
}

function getOfferTypeLabel(offerType: string | null) {
  if (offerType === "pv") return "Fotowoltaika";
  if (offerType === "storage") return "Magazyn energii";
  if (offerType === "pv_storage") return "PV + magazyn energii";
  return offerType || "Oferta";
}

function getClientDisplayName(client: ClientData | null, offer: ClientOffer | null) {
  return (
    client?.full_name ||
    client?.company_name ||
    offer?.client_name ||
    "Klient"
  );
}

function getClientAddress(client: ClientData | null) {
  if (!client) return "Brak adresu";

  const streetLine = [client.street, client.building_number].filter(Boolean).join(" ");
  const cityLine = [client.postal_code, client.city].filter(Boolean).join(" ");

  return [streetLine, cityLine].filter(Boolean).join(", ") || "Brak adresu";
}


function getClientField(client: ClientData | null, keys: string[]) {
  if (!client) return "";

  const rawClient = client as Record<string, unknown>;

  for (const key of keys) {
    const value = rawClient[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }

  return "";
}

function splitStreetAndBuildingNumber(rawAddress: string) {
  const value = rawAddress.trim();

  if (!value) {
    return { street: "", buildingNumber: "" };
  }

  const match = value.match(/^(.+?)\s+((?:\d+[A-Za-z]?(?:[\/\-]\d+[A-Za-z]?)?)|(?:\d+[A-Za-z]?\s?\/\s?\d+[A-Za-z]?))$/);

  if (!match) {
    return { street: value, buildingNumber: "" };
  }

  return {
    street: match[1].trim(),
    buildingNumber: match[2].replace(/\s+/g, "").trim(),
  };
}

function getClientContractAddressParts(client: ClientData | null) {
  const rawStreet = getClientField(client, [
    "street",
    "ulica",
    "address_street",
    "contract_street",
    "address",
    "adres",
    "contract_address",
  ]);
  const rawBuildingNumber = getClientField(client, [
    "building_number",
    "house_number",
    "numer_domu",
    "address_number",
    "contract_building_number",
  ]);

  const splitAddress = splitStreetAndBuildingNumber(rawStreet);

  return {
    street: rawBuildingNumber ? rawStreet : splitAddress.street,
    buildingNumber: rawBuildingNumber || splitAddress.buildingNumber,
    postalCode: getClientField(client, ["postal_code", "kod_pocztowy", "zip_code", "address_postal_code", "contract_postal_code"]),
    city: getClientField(client, ["city", "miejscowosc", "miasto", "address_city", "contract_city"]),
  };
}

function buildFullAddress(
  street: string,
  buildingNumber: string,
  postalCode: string,
  city: string
) {
  return [
    [street, buildingNumber].filter(Boolean).join(" "),
    [postalCode, city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysLocalDate(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function calculateDefaultDepositAmount(grossValue: number | null | undefined) {
  const depositPercent = 25;
  const parsedGrossValue = Number(grossValue || 0);

  if (!Number.isFinite(parsedGrossValue) || parsedGrossValue <= 0) {
    return "";
  }

  const roundedDeposit = Math.round((parsedGrossValue * (depositPercent / 100)) / 100) * 100;

  return String(roundedDeposit);
}

function parseMoneyValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function findNestedValue(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = key.split(".").reduce<any>((current, part) => current?.[part], source);

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function findFirstMoneyValue(source: Record<string, any>, keys: string[]) {
  return parseMoneyValue(findNestedValue(source, keys));
}

function getOfferFinancialBreakdownForContract(offer: ClientOffer) {
  const offerData = (offer.offer_data || {}) as Record<string, any>;
  const resultData = (offerData.result || {}) as Record<string, any>;
  const contractBreakdown =
    (offerData.contractBreakdown ||
      offerData.contract_breakdown ||
      resultData.contractBreakdown ||
      resultData.contract_breakdown ||
      offerData.form?.contractBreakdown ||
      {}) as Record<string, any>;

  const getLineValue = (lineKey: string, valueKey: string) => {
    const snakeValueKey = valueKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const line =
      contractBreakdown?.[lineKey] ||
      contractBreakdown?.[lineKey.toLowerCase()] ||
      contractBreakdown?.[lineKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];

    return parseMoneyValue(
      line?.[valueKey] ??
        line?.[snakeValueKey] ??
        line?.[valueKey.toLowerCase()]
    );
  };

  const getResultValue = (keys: string[]) => {
    for (const key of keys) {
      const value = findNestedValue(
        {
          offerData,
          resultData,
          formData: offerData.form || {},
          contractBreakdown,
        },
        key.includes(".") ? [key] : [key, `offerData.${key}`, `resultData.${key}`, `formData.${key}`]
      );

      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return parseMoneyValue(value);
      }
    }

    return 0;
  };

  const totalGrossAfterDiscount =
    getLineValue("total", "grossAfterDiscount") ||
    parseMoneyValue(offer.sale_price_gross) ||
    parseMoneyValue(resultData.finalGross) ||
    0;

  const totalGrossBeforeDiscount =
    getLineValue("total", "grossBeforeDiscount") ||
    Math.round(totalGrossAfterDiscount * 1.1111 * 100) / 100;

  const pvGrossAfterDiscount =
    getLineValue("pv", "grossAfterDiscount") ||
    getResultValue(["contract_pv_gross_after_discount", "contractPvGrossAfterDiscount"]);
  const storageGrossAfterDiscount =
    getLineValue("storage", "grossAfterDiscount") ||
    getResultValue(["contract_storage_gross_after_discount", "contractStorageGrossAfterDiscount"]);
  const emsGrossAfterDiscount =
    getLineValue("ems", "grossAfterDiscount") ||
    getResultValue(["contract_ems_gross_after_discount", "contractEmsGrossAfterDiscount"]);
  const backupGrossAfterDiscount =
    getLineValue("backup", "grossAfterDiscount") ||
    getResultValue(["contract_backup_gross_after_discount", "contractBackupGrossAfterDiscount"]);
  const additionalServicesGrossAfterDiscount =
    getLineValue("additionalServices", "grossAfterDiscount") ||
    getLineValue("additional_services", "grossAfterDiscount") ||
    getResultValue(["contract_additional_services_gross_after_discount", "contractAdditionalServicesGrossAfterDiscount"]);

  const pvGrossBeforeDiscount =
    getLineValue("pv", "grossBeforeDiscount") ||
    getResultValue(["contract_pv_gross_before_discount", "contractPvGrossBeforeDiscount"]);
  const storageGrossBeforeDiscount =
    getLineValue("storage", "grossBeforeDiscount") ||
    getResultValue(["contract_storage_gross_before_discount", "contractStorageGrossBeforeDiscount"]);
  const emsGrossBeforeDiscount =
    getLineValue("ems", "grossBeforeDiscount") ||
    getResultValue(["contract_ems_gross_before_discount", "contractEmsGrossBeforeDiscount"]);
  const backupGrossBeforeDiscount =
    getLineValue("backup", "grossBeforeDiscount") ||
    getResultValue(["contract_backup_gross_before_discount", "contractBackupGrossBeforeDiscount"]) ||
    3000;
  const additionalServicesGrossBeforeDiscount =
    getLineValue("additionalServices", "grossBeforeDiscount") ||
    getLineValue("additional_services", "grossBeforeDiscount") ||
    getResultValue(["contract_additional_services_gross_before_discount", "contractAdditionalServicesGrossBeforeDiscount"]);

  const knownGrossAfterDiscount =
    pvGrossAfterDiscount +
    storageGrossAfterDiscount +
    emsGrossAfterDiscount +
    backupGrossAfterDiscount +
    additionalServicesGrossAfterDiscount;

  const missingGrossAfterDiscount = Math.max(totalGrossAfterDiscount - knownGrossAfterDiscount, 0);

  const knownGrossBeforeDiscount =
    pvGrossBeforeDiscount +
    storageGrossBeforeDiscount +
    emsGrossBeforeDiscount +
    backupGrossBeforeDiscount +
    additionalServicesGrossBeforeDiscount;

  const missingGrossBeforeDiscount = Math.max(totalGrossBeforeDiscount - knownGrossBeforeDiscount, 0);

  const offerHasPv =
    offer.offer_type === "pv" ||
    offer.offer_type === "pv_storage" ||
    Number(offer.pv_power_kw || 0) > 0;

  let finalPvGrossAfterDiscount = pvGrossAfterDiscount + missingGrossAfterDiscount;
  let finalStorageGrossAfterDiscount = storageGrossAfterDiscount;
  let finalEmsGrossAfterDiscount = emsGrossAfterDiscount;

  if (offerHasPv && finalPvGrossAfterDiscount <= 0) {
    finalPvGrossAfterDiscount = 1;

    if (finalStorageGrossAfterDiscount >= 1) {
      finalStorageGrossAfterDiscount -= 1;
    } else if (finalEmsGrossAfterDiscount >= 1) {
      finalEmsGrossAfterDiscount -= 1;
    }
  }

  const contractVatRate = Number(offer.vat_rate || resultData.vatRate || resultData.vat_rate || 8);
  const contractVatMultiplier = 1 + contractVatRate / 100;

  const finalPvGrossBeforeDiscount =
    finalPvGrossAfterDiscount > 0
      ? Math.round(finalPvGrossAfterDiscount * 1.1111 * 100) / 100
      : 0;

  const finalPvNetAfterDiscount =
    finalPvGrossAfterDiscount > 0
      ? Math.round((finalPvGrossAfterDiscount / contractVatMultiplier) * 100) / 100
      : 0;

  return {
    contract_total_gross_after_discount: totalGrossAfterDiscount,
    contract_total_gross_before_discount: totalGrossBeforeDiscount,
    contract_total_net_after_discount: getLineValue("total", "netAfterDiscount"),

    contract_pv_gross_after_discount: finalPvGrossAfterDiscount,
    contract_pv_gross_before_discount: finalPvGrossBeforeDiscount,
    contract_pv_net_after_discount: finalPvNetAfterDiscount,

    contract_storage_gross_after_discount: finalStorageGrossAfterDiscount,
    contract_storage_gross_before_discount: storageGrossBeforeDiscount,
    contract_storage_net_after_discount:
      getLineValue("storage", "netAfterDiscount") ||
      getResultValue(["contract_storage_net_after_discount", "contractStorageNetAfterDiscount"]),

    contract_ems_gross_after_discount: finalEmsGrossAfterDiscount,
    contract_ems_gross_before_discount: emsGrossBeforeDiscount,
    contract_ems_net_after_discount:
      getLineValue("ems", "netAfterDiscount") ||
      getResultValue(["contract_ems_net_after_discount", "contractEmsNetAfterDiscount"]),

    contract_backup_gross_after_discount: backupGrossAfterDiscount,
    contract_backup_gross_before_discount: backupGrossBeforeDiscount,
    contract_backup_net_after_discount: getLineValue("backup", "netAfterDiscount"),

    contract_additional_services_gross_after_discount: additionalServicesGrossAfterDiscount,
    contract_additional_services_gross_before_discount: additionalServicesGrossBeforeDiscount,
    contract_additional_services_net_after_discount: getLineValue("additionalServices", "netAfterDiscount"),

    contract_total_gross: totalGrossAfterDiscount,
    contract_pv_gross: finalPvGrossAfterDiscount,
    contract_storage_gross: finalStorageGrossAfterDiscount,
    contract_ems_gross: finalEmsGrossAfterDiscount,
    contract_backup_gross: backupGrossAfterDiscount,
    contract_additional_services_gross: additionalServicesGrossAfterDiscount,
  };
}

function formatTwoDigits(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "00";
  }

  return digits.padStart(2, "0").slice(-2);
}

function buildContractNumberPreview(
  userNumber: string | number | null | undefined,
  sequence: string,
  contractDate: string
) {
  const year = contractDate?.slice(0, 4) || "RRRR";
  const month = contractDate?.slice(5, 7) || "MM";

  return `${formatTwoDigits(userNumber)}/${formatTwoDigits(sequence)}/${year}/${month}/IS`;
}

function getContractNumberParts(contractNumber: string) {
  const match = contractNumber.match(/^(\d{2})\/(\d{2})\/(\d{4})\/(\d{2})\/IS$/);

  if (!match) {
    return null;
  }

  return {
    userNumber: match[1],
    sequence: Number(match[2]),
    year: match[3],
    month: match[4],
  };
}

async function findDuplicateClient(
  pesel: string,
  email: string,
  phone: string,
  currentClientId?: string
) {
  const conditions: string[] = [];

  if (pesel.trim()) {
    conditions.push(`pesel.eq.${pesel.trim()}`);
  }

  if (email.trim()) {
    conditions.push(`email.ilike.${email.trim()}`);
  }

  if (phone.trim()) {
    conditions.push(`phone.eq.${phone.trim()}`);
  }

  if (conditions.length === 0) {
    return null;
  }

  let query = supabase
    .from("clients")
    .select("id, public_id, full_name, company_name, assigned_to, assigned_user_id")
    .or(conditions.join(","))
    .limit(1);

  if (currentClientId) {
    query = query.neq("id", currentClientId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("DUPLICATE CLIENT CHECK ERROR", error);
    return null;
  }

  return data;
}

function emptySaleForm(): SaleFromOfferForm {
  const contractDate = todayLocalDate();
  return {
    customerType: "b2c",
    fullName: "",
    companyName: "",
    nip: "",
    regon: "",
    representativeName: "",
    pesel: "",
    phone: "",
    email: "",
    contractStreet: "",
    contractBuildingNumber: "",
    contractPostalCode: "",
    contractCity: "",
    correspondenceSameAsContract: true,
    correspondenceAddress: "",
    installationSameAsContract: true,
    installationAddress: "",
    paymentMethod: "gotówka",
    ownContributionAmount: "",
    depositAmount: "",
    secondClientName: "",
    secondClientPesel: "",
    contractSequence: "01",
    contractPlace: "",
    contractDate,
    depositDueDate: addDaysLocalDate(contractDate, 14),
    visitPreviouslyScheduled: null,
    realizationVariant: "",
    client1MarketingEmail: false,
    client1MarketingPhone: false,
    client1PhotoConsent: false,
    client2MarketingEmail: false,
    client2MarketingPhone: false,
    client2PhotoConsent: false,
  };
}

function isValidPesel(pesel: string) {
  const clean = pesel.replace(/\D/g, "");

  if (!/^\d{11}$/.test(clean)) {
    return false;
  }

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];

  const sum = weights.reduce((accumulator, weight, index) => {
    return accumulator + Number(clean[index]) * weight;
  }, 0);

  const checksum = (10 - (sum % 10)) % 10;

  return checksum === Number(clean[10]);
}


function normalizeRole(value: unknown): UserRole {
  if (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "seller" ||
    value === "cc"
  ) {
    return value;
  }

  return null;
}

// --- Automatic tagging for duplicate/conflict sale creation ---
async function getSystemClientTagId(name: string) {
  const { data: existingTag, error: existingTagError } = await supabase
    .from("client_tags")
    .select("id")
    .eq("name", name)
    .eq("is_active", true)
    .maybeSingle();

  if (existingTagError) {
    console.error(`Błąd sprawdzania tagu systemowego ${name}:`, existingTagError);
    return null;
  }

  if (!existingTag?.id) {
    console.warn(`Brak aktywnego tagu systemowego: ${name}. Utwórz go w panelu admina lub SQL.`);
    return null;
  }

  return existingTag.id as string;
}

async function addSystemTagToClient(clientId: string, tagName: string, color: string) {
  const { error } = await supabase.rpc("add_client_system_tag", {
    p_client_id: clientId,
    p_tag_name: tagName,
  });

  if (error) {
    console.error(`Błąd RPC dodawania tagu ${tagName}:`, error);
    alert(
      `Nie udało się dodać tagu ${tagName}: ${error.message || "brak szczegółów błędu"}`
    );
    return;
  }

}

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = String(params.id || "");
  const autoCreateSale = searchParams.get("createSale") === "1";
  const sourceEventId = searchParams.get("eventId");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [offer, setOffer] = useState<ClientOffer | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [creator, setCreator] = useState<UserProfile | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showCancelSaleModal, setShowCancelSaleModal] = useState(false);
  const [creatingSale, setCreatingSale] = useState(false);
  const [createSaleStatus, setCreateSaleStatus] = useState("");
  const [saleForm, setSaleForm] = useState<SaleFromOfferForm>(() => emptySaleForm());
  const [duplicateClientModal, setDuplicateClientModal] = useState<{
    open: boolean;
    client: {
      id: string;
      public_id?: number | null;
      full_name?: string | null;
      company_name?: string | null;
      assigned_to?: string | null;
      assigned_user_id?: string | null;
    } | null;
  }>({
    open: false,
    client: null,
  });

  const [allowDuplicateClientCreation, setAllowDuplicateClientCreation] = useState(false);
  const [selectedExistingClientId, setSelectedExistingClientId] = useState<string | null>(null);
  const [clientConflictDetected, setClientConflictDetected] = useState(false);
  const [duplicateDecision, setDuplicateDecision] = useState<
    "existing" | "new" | null
  >(null);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  const duplicateWorkflowRef = useRef<{
    decision: "existing" | "new" | null;
    clientId: string | null;
    conflictDetected: boolean;
  }>({
    decision: null,
    clientId: null,
    conflictDetected: false,
  });
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const canSeeFullFinancials = useMemo(
    () => ["owner", "admin"].includes(currentUserRole || ""),
    [currentUserRole]
  );

  const canSeeManagerFinancials = useMemo(
    () => currentUserRole === "manager",
    [currentUserRole]
  );
  async function loadVisibleUserIds(
    userId: string,
    role: UserRole
  ) {
    if (["admin", "owner"].includes(role || "")) {
      setVisibleUserIds(null);
      return null;
    }

    if (["seller", "cc"].includes(role || "")) {
      const ids = [userId];
      setVisibleUserIds(ids);
      return ids;
    }

    if (role === "manager") {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("manager_id", userId);

      if (error) {
        console.error("Błąd ładowania zespołu managera", error);

        const ids = [userId];
        setVisibleUserIds(ids);
        return ids;
      }

      const ids = [
        userId,
        ...(data || []).map((item) => item.id),
      ];

      setVisibleUserIds(ids);

      return ids;
    }

    const fallbackIds = [userId];

    setVisibleUserIds(fallbackIds);

    return fallbackIds;
  }

  useEffect(() => {
    loadOffer();
  }, [offerId]);
  useEffect(() => {
    if (!offer || !autoCreateSale || showSaleForm) return;
    if (offer.client_id && !client) return;

    openSaleFormFromOffer(client);
  }, [offer, client, autoCreateSale, showSaleForm]);
  async function loadOffer() {
    setLoading(true);
    setAccessDenied(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    setCurrentUserId(user.id);
    setCreateSaleStatus("");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Błąd ładowania profilu użytkownika:", profileError);
    }

    const role =
      normalizeRole(profileData?.role) ||
      normalizeRole(user.user_metadata?.role) ||
      normalizeRole(user.app_metadata?.role);
    setCurrentUserRole(role);
    const visibleIds = await loadVisibleUserIds(user.id, role);

    const { data: offerData, error: offerError } = await supabase
      .from("client_offers")
      .select("*")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      console.error("Błąd ładowania oferty:", offerError);
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    if (!offerData) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const loadedOffer = offerData as ClientOffer;
    const isPrivilegedUser = ["owner", "admin"].includes(role || "");
    const isOfferOwner = loadedOffer.created_by === user.id;
    const canManagerAccessOffer =
      role === "manager" &&
      visibleIds?.includes(loadedOffer.created_by);

    if (
      !isPrivilegedUser &&
      !isOfferOwner &&
      !canManagerAccessOffer
    ) {
      setOffer(null);
      setClient(null);
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setOffer(loadedOffer);

    if (loadedOffer.client_id) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", loadedOffer.client_id)
        .maybeSingle();

      if (clientError) {
        console.error("Błąd ładowania klienta oferty:", clientError);
      }

      setClient((clientData as ClientData) || null);
      if (autoCreateSale && clientData) {
        setTimeout(() => {
          openSaleFormFromOffer(clientData as ClientData);
        }, 0);
      }
    }

    if (loadedOffer.created_by) {
      const { data: creatorData, error: creatorError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", loadedOffer.created_by)
        .maybeSingle();

      if (creatorError) {
        console.error("Błąd ładowania autora oferty:", creatorError);
      }

      setCreator((creatorData as UserProfile) || null);
    }

    setLoading(false);
  }
  async function getNextContractSequenceForUser(
    userNumber: string | number | null | undefined,
    contractDate: string
  ) {
    const formattedUserNumber = formatTwoDigits(userNumber);
    const year = contractDate.slice(0, 4);
    const month = contractDate.slice(5, 7);

    if (!year || !month || formattedUserNumber === "00") {
      return "01";
    }

    const { data, error } = await supabase
      .from("sales")
      .select("contract_number")
      .like("contract_number", `${formattedUserNumber}/%/${year}/${month}/IS`);

    if (error) {
      console.error("Błąd pobierania ostatniego numeru umowy:", error);
      return "01";
    }

    const maxSequence = (data || []).reduce((max, item) => {
      const parts = getContractNumberParts(String(item.contract_number || ""));

      if (!parts) {
        return max;
      }

      if (parts.userNumber !== formattedUserNumber || parts.year !== year || parts.month !== month) {
        return max;
      }

      return Math.max(max, parts.sequence);
    }, 0);

    return formatTwoDigits(maxSequence + 1);
  }

  function updateSaleForm<K extends keyof SaleFromOfferForm>(
    key: K,
    value: SaleFromOfferForm[K]
  ) {
    setSaleForm((current) => ({
      ...current,
      [key]: value,
    }));

    setInvalidFields((current) => current.filter((field) => field !== key));
  }

  async function openSaleFormFromOffer(clientOverride?: ClientData | null) {
    if (!offer) return;

    const sourceClient = clientOverride ?? client;

    const address = getClientContractAddressParts(sourceClient);

    const inferredCustomerType: SaleCustomerType =
      sourceClient?.company_name || sourceClient?.nip ? "b2b" : "b2c";

    const contractAddress = buildFullAddress(
      address.street,
      address.buildingNumber,
      address.postalCode,
      address.city
    );

    const fullName = getClientField(sourceClient, ["full_name", "name", "client_name", "imie_nazwisko"]);
    const companyName = getClientField(sourceClient, ["company_name", "company", "nazwa_firmy"]);
    const nip = getClientField(sourceClient, ["nip", "tax_id"]);
    const regon = getClientField(sourceClient, ["regon"]);
    const representativeName = getClientField(sourceClient, ["contact_person", "representative_name", "osoba_reprezentujaca", "full_name"]);
    const pesel = getClientField(sourceClient, ["pesel"]);
    const phone = getClientField(sourceClient, ["phone", "contact_phone", "telefon", "phone_number"]);
    const email = getClientField(sourceClient, ["email", "contact_email", "mail"]);
    const correspondenceAddress = getClientField(sourceClient, ["correspondence_address", "adres_korespondencyjny"]);
    const installationAddress = getClientField(sourceClient, ["installation_address", "adres_montazu", "mounting_address"]);
    const defaultDepositAmount = calculateDefaultDepositAmount(offer.sale_price_gross);
    const contractDate = todayLocalDate();
    const defaultContractPlace = address.city || "";

    const userNumberRaw =
      creator?.user_number ||
      (creator as any)?.uid ||
      (creator as any)?.userNumber ||
      "00";

    const nextContractSequence = await getNextContractSequenceForUser(userNumberRaw, contractDate);

    setSaleForm({
      ...emptySaleForm(),
      customerType: inferredCustomerType,
      fullName: fullName || offer.client_name || "",
      companyName,
      nip,
      regon,
      representativeName: representativeName || fullName,
      pesel,
      phone,
      email: email || offer.client_email || "",
      contractStreet: address.street,
      contractBuildingNumber: address.buildingNumber,
      contractPostalCode: address.postalCode,
      contractCity: address.city,
      correspondenceSameAsContract: !correspondenceAddress,
      correspondenceAddress: correspondenceAddress || contractAddress,
      installationSameAsContract: !installationAddress,
      installationAddress: installationAddress || contractAddress,
      paymentMethod: "gotówka",
      ownContributionAmount: "",
      depositAmount: defaultDepositAmount,
      secondClientName: "",
      secondClientPesel: "",
      contractSequence: nextContractSequence,
      contractPlace: defaultContractPlace,
      contractDate,
      depositDueDate: addDaysLocalDate(contractDate, 14),
      visitPreviouslyScheduled: null,
      realizationVariant: "",
      client1MarketingEmail: false,
      client1MarketingPhone: false,
      client1PhotoConsent: false,
      client2MarketingEmail: false,
      client2MarketingPhone: false,
      client2PhotoConsent: false,
    });

    setCreateSaleStatus("");
    setShowSaleForm(true);
  }

  function validateSaleForm() {
    const errors: string[] = [];

    const contractAddressComplete =
      saleForm.contractStreet.trim() &&
      saleForm.contractBuildingNumber.trim() &&
      saleForm.contractPostalCode.trim() &&
      saleForm.contractCity.trim();

    if (!saleForm.contractSequence.trim()) {
      errors.push("contractSequence");
      setInvalidFields(errors);
      return "Uzupełnij numer kolejny umowy.";
    }

    if (saleForm.customerType === "b2c" && !saleForm.fullName.trim()) {
      errors.push("fullName");
      setInvalidFields(errors);
      return "Uzupełnij imię i nazwisko klienta.";
    }

    if (saleForm.customerType === "b2b") {
      if (!saleForm.companyName.trim()) {
        errors.push("companyName");
        setInvalidFields(errors);
        return "Uzupełnij nazwę firmy.";
      }

      if (!saleForm.nip.trim()) {
        errors.push("nip");
        setInvalidFields(errors);
        return "Uzupełnij NIP.";
      }

      if (!saleForm.regon.trim()) {
        errors.push("regon");
        setInvalidFields(errors);
        return "Uzupełnij REGON.";
      }

      if (!saleForm.representativeName.trim()) {
        errors.push("representativeName");
        setInvalidFields(errors);
        return "Uzupełnij osobę reprezentującą.";
      }
    }

    if (!contractAddressComplete) {
      if (!saleForm.contractStreet.trim()) errors.push("contractStreet");
      if (!saleForm.contractBuildingNumber.trim()) errors.push("contractBuildingNumber");
      if (!saleForm.contractPostalCode.trim()) errors.push("contractPostalCode");
      if (!saleForm.contractCity.trim()) errors.push("contractCity");

      setInvalidFields(errors);
      return "Uzupełnij pełny adres na umowie.";
    }

    if (!saleForm.pesel.trim()) {
      errors.push("pesel");
      setInvalidFields(errors);
      return "Uzupełnij PESEL.";
    }

    if (!isValidPesel(saleForm.pesel)) {
      errors.push("pesel");
      setInvalidFields(errors);
      return "Podany numer PESEL jest nieprawidłowy.";
    }

    const hasSecondClientName = saleForm.secondClientName.trim().length > 0;
    const hasSecondClientPesel = saleForm.secondClientPesel.trim().length > 0;

    if (hasSecondClientName || hasSecondClientPesel) {
      if (!hasSecondClientName) {
        errors.push("secondClientName");
        setInvalidFields(errors);
        return "Uzupełnij imię i nazwisko drugiego klienta albo usuń PESEL drugiego klienta.";
      }

      if (!hasSecondClientPesel) {
        errors.push("secondClientPesel");
        setInvalidFields(errors);
        return "Uzupełnij PESEL drugiego klienta albo usuń imię i nazwisko drugiego klienta.";
      }

      if (!isValidPesel(saleForm.secondClientPesel)) {
        errors.push("secondClientPesel");
        setInvalidFields(errors);
        return "PESEL drugiego klienta jest nieprawidłowy.";
      }
    }

    if (!saleForm.contractPlace.trim()) {
      errors.push("contractPlace");
      setInvalidFields(errors);
      return "Uzupełnij miejscowość podpisania umowy.";
    }

    if (!saleForm.contractDate.trim()) {
      errors.push("contractDate");
      setInvalidFields(errors);
      return "Uzupełnij datę podpisania umowy.";
    }

    if (saleForm.visitPreviouslyScheduled === null) {
      errors.push("visitPreviouslyScheduled");
      setInvalidFields(errors);
      return "Wybierz, czy wizyta była wcześniej umówiona.";
    }

    if (saleForm.visitPreviouslyScheduled && !saleForm.realizationVariant) {
      errors.push("realizationVariant");
      setInvalidFields(errors);
      return "Wybierz wariant realizacji umowy 1A albo 1B.";
    }

    if (!saleForm.phone.trim()) {
      errors.push("phone");
      setInvalidFields(errors);
      return "Uzupełnij numer telefonu.";
    }

    if (!saleForm.email.trim()) {
      errors.push("email");
      setInvalidFields(errors);
      return "Uzupełnij adres email.";
    }

    if (!saleForm.paymentMethod) {
      errors.push("paymentMethod");
      setInvalidFields(errors);
      return "Wybierz formę płatności.";
    }

    const parsedOwnContribution = Number(
      String(saleForm.ownContributionAmount || "0").replace(",", ".")
    );

    if (saleForm.paymentMethod === "kredyt") {
      if (!Number.isFinite(parsedOwnContribution) || parsedOwnContribution < 0) {
        errors.push("ownContributionAmount");
        setInvalidFields(errors);
        return "Wkład własny musi być liczbą większą lub równą 0.";
      }
    }

    const shouldRequireDeposit =
      saleForm.paymentMethod === "gotówka" ||
      (saleForm.paymentMethod === "kredyt" && parsedOwnContribution > 0);

    if (shouldRequireDeposit && !saleForm.depositAmount.trim()) {
      errors.push("depositAmount");
      setInvalidFields(errors);
      return "Uzupełnij wysokość zaliczki.";
    }

    const parsedDeposit = Number(String(saleForm.depositAmount || "0").replace(",", "."));

    if (shouldRequireDeposit && !Number.isFinite(parsedDeposit)) {
      errors.push("depositAmount");
      setInvalidFields(errors);
      return "Wysokość zaliczki musi być liczbą.";
    }

    if (shouldRequireDeposit && parsedDeposit < 0) {
      errors.push("depositAmount");
      setInvalidFields(errors);
      return "Wysokość zaliczki nie może być ujemna.";
    }

    if (saleForm.paymentMethod === "kredyt" && parsedDeposit > parsedOwnContribution) {
      errors.push("depositAmount");
      setInvalidFields(errors);
      return "Zaliczka nie może być większa niż wkład własny.";
    }

    if (shouldRequireDeposit && !saleForm.depositDueDate.trim()) {
      errors.push("depositDueDate");
      setInvalidFields(errors);
      return "Uzupełnij termin płatności zaliczki.";
    }

    setInvalidFields([]);

    return "";
  }

  function buildSoldItemsFromOffer() {
    return [
      offer?.pv_power_kw ? `Instalacja PV ${offer.pv_power_kw} kWp` : null,
      offer?.energy_storage && offer.energy_storage !== "Brak"
        ? `Magazyn energii ${offer.energy_storage}`
        : null,
      offer?.inverter && offer.inverter !== "Brak" ? `Falownik ${offer.inverter}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function createSaleFromOffer(workflowOverride?: {
    decision: "existing" | "new" | null;
    clientId: string | null;
    conflictDetected: boolean;
  }) {
    if (!offer) return;

    const validationError = validateSaleForm();

    if (validationError) {
      setCreateSaleStatus(validationError);
      return;
    }

    const duplicateWorkflow = workflowOverride || duplicateWorkflowRef.current;

    setClientConflictDetected(false);
    setDuplicateDecision(null);
    const shouldSkipDuplicateCheck =
      allowDuplicateClientCreation ||
      skipDuplicateCheck ||
      workflowOverride?.decision === "new" ||
      workflowOverride?.decision === "existing";

    const duplicateClient = shouldSkipDuplicateCheck
      ? null
      : await findDuplicateClient(
          saleForm.pesel,
          saleForm.email,
          saleForm.phone,
          offer.client_id
        );

    if (duplicateClient) {
      setDuplicateClientModal({
        open: true,
        client: duplicateClient,
      });

      setCreateSaleStatus("");

      return;
    }

    const contractAddress = buildFullAddress(
      saleForm.contractStreet,
      saleForm.contractBuildingNumber,
      saleForm.contractPostalCode,
      saleForm.contractCity
    );

    const correspondenceAddress = saleForm.correspondenceSameAsContract
      ? contractAddress
      : saleForm.correspondenceAddress;

    const installationAddress = saleForm.installationSameAsContract
      ? contractAddress
      : saleForm.installationAddress;

    const installationSplit = saleForm.installationSameAsContract
      ? {
          street: saleForm.contractStreet,
          buildingNumber: saleForm.contractBuildingNumber,
          postalCode: saleForm.contractPostalCode,
          city: saleForm.contractCity,
        }
      : {
          ...splitStreetAndBuildingNumber(saleForm.installationAddress),
          postalCode: "",
          city: "",
        };

    const ownContributionAmount = Number(String(saleForm.ownContributionAmount || "0").replace(",", "."));
    const depositAmount = Number(String(saleForm.depositAmount || "0").replace(",", "."));
    const contractFinancialBreakdown = getOfferFinancialBreakdownForContract(offer);

    // --- Contract number generation ---
    const userNumberRaw =
      creator?.user_number ||
      (creator as any)?.uid ||
      (creator as any)?.userNumber ||
      "00";

    const contractNumber = buildContractNumberPreview(
      userNumberRaw,
      saleForm.contractSequence,
      saleForm.contractDate
    );

    const { data: existingContracts, error: contractDuplicateError } = await supabase
      .from("sales")
      .select("id")
      .eq("contract_number", contractNumber)
      .limit(1);

    if (contractDuplicateError) {
      console.error("Błąd sprawdzania duplikatu numeru umowy:", contractDuplicateError);
      setCreateSaleStatus("Nie udało się sprawdzić numeru umowy. Spróbuj ponownie.");
      setCreatingSale(false);
      return;
    }

    if (Array.isArray(existingContracts) && existingContracts.length > 0) {
      setCreateSaleStatus("Umowa o wskazanym numerze istnieje w systemie.");
      setCreatingSale(false);
      return;
    }

    setCreatingSale(true);
    setCreateSaleStatus("");

    let effectiveClientId =
      duplicateWorkflow.decision === "existing" && duplicateWorkflow.clientId
        ? duplicateWorkflow.clientId
        : selectedExistingClientId || offer.client_id;

    if (duplicateWorkflow.decision === "new") {
      const newClientPayload = {
        client_type: saleForm.customerType === "b2b" ? "B2B" : "B2C",
        full_name: saleForm.customerType === "b2c" ? saleForm.fullName : saleForm.representativeName,
        company_name: saleForm.customerType === "b2b" ? saleForm.companyName : null,
        nip: saleForm.customerType === "b2b" ? saleForm.nip : null,
        regon: saleForm.customerType === "b2b" ? saleForm.regon : null,
        contact_person: saleForm.customerType === "b2b" ? saleForm.representativeName : null,
        pesel: saleForm.pesel,
        phone: saleForm.phone,
        email: saleForm.email,
        street: saleForm.contractStreet,
        building_number: saleForm.contractBuildingNumber,
        postal_code: saleForm.contractPostalCode,
        city: saleForm.contractCity,
        status: "Klient aktywny",
        assigned_user_id: offer.created_by,
      };

      const { data: newClient, error: newClientError } = await supabase
        .from("clients")
        .insert(newClientPayload)
        .select("id")
        .single();

      if (newClientError || !newClient) {
        console.error("Błąd tworzenia nowego klienta mimo dubla:", newClientError);
        setCreateSaleStatus(newClientError?.message || "Nie udało się utworzyć nowego klienta.");
        setCreatingSale(false);
        return;
      }

      effectiveClientId = newClient.id;
    }

    const salePayload = {
      client_id: effectiveClientId,
      seller_id: offer.created_by,
      source_offer_id: offer.id,
      contract_number: contractNumber,
      sale_date: new Date().toISOString(),
      contract_value: offer.sale_price_gross || 0,
      margin_value: offer.seller_margin || 0,
      sold_items: buildSoldItemsFromOffer() || getOfferTypeLabel(offer.offer_type),
      status: "Oczekuje na sprawdzenie dokumentów",
      customer_type: saleForm.customerType,
      customer_data: {
        customer_type: saleForm.customerType,
        full_name: saleForm.fullName,
        company_name: saleForm.companyName,
        nip: saleForm.nip,
        regon: saleForm.regon,
        representative_name: saleForm.representativeName,
        pesel: saleForm.pesel,
        phone: saleForm.phone,
        email: saleForm.email,
        contract_street: saleForm.contractStreet,
        contract_building_number: saleForm.contractBuildingNumber,
        contract_postal_code: saleForm.contractPostalCode,
        contract_city: saleForm.contractCity,
        contract_address: contractAddress,
        correspondence_same_as_contract: saleForm.correspondenceSameAsContract,
        correspondence_address: correspondenceAddress,
        installation_same_as_contract: saleForm.installationSameAsContract,
        installation_street: installationSplit.street,
        installation_building_number: installationSplit.buildingNumber,
        installation_postal_code: installationSplit.postalCode,
        installation_city: installationSplit.city,
        installation_address: installationAddress,
        second_client_name: saleForm.secondClientName,
        second_client_pesel: saleForm.secondClientPesel,
        contract_place: saleForm.contractPlace,
        contract_date: saleForm.contractDate,
        contract_number: contractNumber,
        contract_sequence: saleForm.contractSequence,
        deposit_due_date: saleForm.depositDueDate,
        visit_previously_scheduled: saleForm.visitPreviouslyScheduled,
        realization_variant: saleForm.realizationVariant,
        deposit_amount: depositAmount,
        own_contribution_amount: ownContributionAmount,
        payment_method: saleForm.paymentMethod,
        client1_marketing_email: saleForm.client1MarketingEmail,
        client1_marketing_phone: saleForm.client1MarketingPhone,
        client1_photo_consent: saleForm.client1PhotoConsent,
        client2_marketing_email: saleForm.client2MarketingEmail,
        client2_marketing_phone: saleForm.client2MarketingPhone,
        client2_photo_consent: saleForm.client2PhotoConsent,
        ...contractFinancialBreakdown,
      },
      offer_snapshot: offer,
      source_event_id: sourceEventId || null,
      payment_method: saleForm.paymentMethod,
      deposit_amount: depositAmount,
      // own_contribution_amount: ownContributionAmount, // Removed as requested
    };

    const { data: createdSale, error: saleError } = await supabase
      .from("sales")
      .insert(salePayload)
      .select("id")
      .single();
    if (saleError || !createdSale) {
      console.error("Błąd tworzenia sprzedaży z oferty:", saleError);
      setCreateSaleStatus(saleError?.message || "Nie udało się utworzyć sprzedaży.");
      setCreatingSale(false);
      return;
    }
const { error: updateClientStatusError } = await supabase
  .from("clients")
  .update({
    status: "Klient aktywny",
    street: saleForm.contractStreet,
    building_number: saleForm.contractBuildingNumber,
    postal_code: saleForm.contractPostalCode,
    city: saleForm.contractCity,
  })
  .eq("id", effectiveClientId);

if (updateClientStatusError) {
  console.error("Błąd aktualizacji statusu klienta po sprzedaży:", updateClientStatusError);
}
    const { error: updateOfferError } = await supabase
      .from("client_offers")
      .update({ status: "sale_created" })
      .eq("id", offer.id);

    if (updateOfferError) {
      console.error("Błąd aktualizacji statusu oferty:", updateOfferError);
    }

    if (
      duplicateWorkflow.decision === "existing" &&
      duplicateWorkflow.conflictDetected &&
      duplicateWorkflow.clientId
    ) {
      await addSystemTagToClient(
  effectiveClientId,
  "Możliwy konflikt",
  "red"
);
      const { data: adminUsers, error: adminUsersError } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "admin"]);

      if (adminUsersError) {
        console.error("Błąd pobierania adminów do powiadomienia konfliktowego:", adminUsersError);
      }

      const advisorName =
        creator?.display_name ||
        creator?.full_name ||
        creator?.name ||
        creator?.username ||
        creator?.email ||
        "Nieznany doradca";

      if (adminUsers?.length) {
        const { error: notificationError } = await supabase.from("notifications").insert(
          adminUsers.map((user) => ({
            user_id: user.id,
            title: "Możliwy konflikt klienta",
            body: `Doradca ${advisorName} utworzył sprzedaż na kliencie przypisanym do innego użytkownika. Zweryfikuj przypisanie klienta.`,
            client_id: effectiveClientId,
            is_read: false,
          }))
        );

        if (notificationError) {
          console.error("Błąd tworzenia powiadomienia konfliktowego:", notificationError);
        }
      }
    }

    if (
      duplicateWorkflow.decision === "new" &&
      effectiveClientId
    ) {
      await addSystemTagToClient(
        effectiveClientId,
        "Możliwy dubel",
        "amber"
      );

      const { data: adminUsers, error: adminUsersError } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "admin"]);

      if (adminUsersError) {
        console.error("Błąd pobierania adminów do powiadomienia o możliwym dublu:", adminUsersError);
      }

      const advisorName =
        creator?.display_name ||
        creator?.full_name ||
        creator?.name ||
        creator?.username ||
        creator?.email ||
        "Nieznany doradca";

      if (adminUsers?.length) {
        const { error: notificationError } = await supabase.from("notifications").insert(
          adminUsers.map((user) => ({
            user_id: user.id,
            title: "Możliwy dubel klienta",
            body: `Doradca ${advisorName} utworzył nowego klienta pomimo wykrycia podobnych danych. Zweryfikuj możliwy duplikat.`,
            client_id: effectiveClientId,
            is_read: false,
          }))
        );

        if (notificationError) {
          console.error("Błąd tworzenia powiadomienia o możliwym dublu:", notificationError);
        }
      }
    }

    if (sourceEventId) {
      await supabase
        .from("calendar_events")
        .update({
          status: "done",
          meeting_effect: "Sprzedaż",
        })
        .eq("id", sourceEventId);
    }
    setCreatingSale(false);
    setAllowDuplicateClientCreation(false);
    setSkipDuplicateCheck(false);
    duplicateWorkflowRef.current = {
      decision: null,
      clientId: null,
      conflictDetected: false,
    };
    setSelectedExistingClientId(null);
    setShowSaleForm(false);

    router.push(`/sales/${createdSale.id}`);
  }
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Ładowanie oferty...</p>
        </div>
      </main>
    );
  }

  if (accessDenied || !offer) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            Nie masz praw do podglądu tej oferty.
          </div>

          <Link
            href="/"
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Wróć do dashboardu
          </Link>
        </div>
      </main>
    );
  }

  const result = (offer.offer_data?.result || null) as Record<string, any> | null;
  const advisor = offer.offer_data?.advisor || null;
  const technicalRows = getTechnicalRows(result);
  const savedBreakdownRows = getSavedBreakdownRows(result);
  const formData = (offer.offer_data?.form || {}) as Record<string, any>;
  const contractNumberPreview = buildContractNumberPreview(
    creator?.user_number || (creator as any)?.uid || (creator as any)?.userNumber || "00",
    saleForm.contractSequence,
    saleForm.contractDate
  );
  const inputClass = (fieldName: string) =>
    `mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:ring-4 ${
      invalidFields.includes(fieldName)
        ? "border-red-400 focus:border-red-400 focus:ring-red-100"
        : "border-slate-300 focus:border-emerald-400 focus:ring-emerald-100"
    }`;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Szczegóły oferty</p>
            <h1 className="text-3xl font-black text-slate-950">
              {offer.offer_public_id || `O-${offer.id.slice(0, 8).toUpperCase()}`}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Utworzono: {new Date(offer.created_at).toLocaleString("pl-PL")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/clients/${offer.client_id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Otwórz klienta
            </Link>

            {!autoCreateSale && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  openSaleFormFromOffer(client);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Utwórz sprzedaż z oferty
              </button>
            )}
            {sourceEventId && (
              <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
                Sprzedaż tworzona z poziomu zakończonego spotkania
              </div>
            )}
          </div>
        </div>

        {showSaleForm && (
          <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Utwórz sprzedaż z oferty
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Uzupełnij wymagane dane do umowy. Część danych została pobrana z karty klienta.
                </p>
              </div>

            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Typ klienta</span>
                <select
                  value={saleForm.customerType}
                  onChange={(event) => {
                    const customerType = event.target.value as SaleCustomerType;
                    setSaleForm((current) => ({
                      ...current,
                      customerType,
                      paymentMethod: "gotówka",
                    }));
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="b2c">Klient B2C</option>
                  <option value="b2b">Klient B2B</option>
                </select>
              </label>

              {saleForm.customerType === "b2c" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Imię i nazwisko</span>
                  <input
                    value={saleForm.fullName}
                    onChange={(event) => updateSaleForm("fullName", event.target.value)}
                    className={inputClass("fullName")}
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Nazwa firmy</span>
                    <input
                      value={saleForm.companyName}
                      onChange={(event) => updateSaleForm("companyName", event.target.value)}
                      className={inputClass("companyName")}
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">NIP</span>
                    <input
                      value={saleForm.nip}
                      onChange={(event) => updateSaleForm("nip", event.target.value)}
                      className={inputClass("nip")}
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">REGON</span>
                    <input
                      value={saleForm.regon}
                      onChange={(event) => updateSaleForm("regon", event.target.value)}
                      className={inputClass("regon")}
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Osoba reprezentująca</span>
                    <input
                      value={saleForm.representativeName}
                      onChange={(event) => updateSaleForm("representativeName", event.target.value)}
                      className={inputClass("representativeName")}
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">PESEL</span>
                <input
                  value={saleForm.pesel}
                  onChange={(event) => updateSaleForm("pesel", event.target.value)}
                  className={inputClass("pesel")}
                />
              </label>

              {saleForm.customerType === "b2c" && (
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-900">Drugi klient na umowie</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Uzupełnij tylko wtedy, gdy umowa ma być zawarta z dwiema osobami.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Imię i nazwisko klienta 2</span>
                      <input
                        value={saleForm.secondClientName}
                        onChange={(event) => updateSaleForm("secondClientName", event.target.value)}
                        className={inputClass("secondClientName")}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">PESEL klienta 2</span>
                      <input
                        value={saleForm.secondClientPesel}
                        onChange={(event) => updateSaleForm("secondClientPesel", event.target.value)}
                        className={inputClass("secondClientPesel")}
                      />
                    </label>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Telefon</span>
                <input
                  value={saleForm.phone}
                  onChange={(event) => updateSaleForm("phone", event.target.value)}
                  className={inputClass("phone")}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email</span>
                <input
                  value={saleForm.email}
                  onChange={(event) => updateSaleForm("email", event.target.value)}
                  className={inputClass("email")}
                />
              </label>

              <div className="grid gap-4 md:col-span-2 md:grid-cols-4">
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Ulica</span>
                  <input
                    value={saleForm.contractStreet}
                    onChange={(event) => updateSaleForm("contractStreet", event.target.value)}
                    className={inputClass("contractStreet")}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nr domu/lokalu</span>
                  <input
                    value={saleForm.contractBuildingNumber}
                    onChange={(event) => updateSaleForm("contractBuildingNumber", event.target.value)}
                    className={inputClass("contractBuildingNumber")}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Kod pocztowy</span>
                  <input
                    value={saleForm.contractPostalCode}
                    onChange={(event) => updateSaleForm("contractPostalCode", event.target.value)}
                    className={inputClass("contractPostalCode")}
                  />
                </label>

                <label className="block md:col-span-4">
                  <span className="text-sm font-semibold text-slate-700">Miejscowość</span>
                  <input
                    value={saleForm.contractCity}
                    onChange={(event) => updateSaleForm("contractCity", event.target.value)}
                    className={inputClass("contractCity")}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={saleForm.correspondenceSameAsContract}
                  onChange={(event) => updateSaleForm("correspondenceSameAsContract", event.target.checked)}
                />
                Adres korespondencyjny taki sam jak adres na umowie
              </label>

              {!saleForm.correspondenceSameAsContract && (
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Adres korespondencyjny</span>
                  <input
                    value={saleForm.correspondenceAddress}
                    onChange={(event) => updateSaleForm("correspondenceAddress", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              )}

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={saleForm.installationSameAsContract}
                  onChange={(event) => updateSaleForm("installationSameAsContract", event.target.checked)}
                />
                Adres montażu taki sam jak adres na umowie
              </label>

              {!saleForm.installationSameAsContract && (
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Adres montażu</span>
                  <input
                    value={saleForm.installationAddress}
                    onChange={(event) => updateSaleForm("installationAddress", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Forma płatności</span>
                <select
                  value={saleForm.paymentMethod}
                  onChange={(event) => {
                    const paymentMethod = event.target.value;
                    updateSaleForm("paymentMethod", paymentMethod);

                    if (paymentMethod === "kredyt") {
                      updateSaleForm("ownContributionAmount", "0");
                      updateSaleForm("depositAmount", "");
                      updateSaleForm("depositDueDate", "");
                    }

                    if (paymentMethod === "gotówka") {
                      updateSaleForm("ownContributionAmount", "");
                      updateSaleForm("depositAmount", calculateDefaultDepositAmount(offer.sale_price_gross));
                      updateSaleForm("depositDueDate", addDaysLocalDate(saleForm.contractDate, 14));
                    }
                  }}
                  className={inputClass("paymentMethod")}
                >
                  <option value="gotówka">Gotówka</option>
                  <option value="kredyt">Kredyt</option>
                  {saleForm.customerType === "b2b" && <option value="leasing">Leasing</option>}
                </select>
              </label>

              {saleForm.paymentMethod === "kredyt" && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Wkład własny</span>
                  <span className="mt-1 block text-xs font-medium text-slate-400">
                    Wpisz 0, jeżeli całość finansowana jest kredytem.
                  </span>
                  <input
                    value={saleForm.ownContributionAmount}
                    onChange={(event) => {
                      updateSaleForm("ownContributionAmount", event.target.value);

                      const ownContribution = Number(String(event.target.value || "0").replace(",", "."));

                      if (Number.isFinite(ownContribution) && ownContribution <= 0) {
                        updateSaleForm("depositAmount", "");
                        updateSaleForm("depositDueDate", "");
                      }
                    }}
                    placeholder="np. 0 albo 30000"
                    className={inputClass("ownContributionAmount")}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Wysokość zaliczki</span>
                <span className="mt-1 block text-xs font-medium text-slate-400">
                  Przy gotówce domyślnie 25% wartości brutto. Przy kredycie zaliczka jest częścią wkładu własnego.
                </span>
                <input
                  value={saleForm.depositAmount}
                  onChange={(event) => updateSaleForm("depositAmount", event.target.value)}
                  placeholder="np. 5000"
                  className={inputClass("depositAmount")}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Termin płatności zaliczki</span>
                <input
                  type="date"
                  value={saleForm.depositDueDate}
                  onChange={(event) => updateSaleForm("depositDueDate", event.target.value)}
                  className={inputClass("depositDueDate")}
                />
              </label>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Dane umowy</p>
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Pełny numer umowy
                  </p>
                  <p className="mt-1 font-mono text-lg font-black text-emerald-950">
                    {contractNumberPreview}
                  </p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Numer kolejny umowy (XX)</span>
                    <input
                      value={saleForm.contractSequence}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "");
                        updateSaleForm(
                          "contractSequence",
                          digits ? digits.padStart(2, "0").slice(-2) : ""
                        );
                      }}
                      placeholder="01"
                      className={inputClass("contractSequence")}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Miejscowość podpisania umowy</span>
                    <input
                      value={saleForm.contractPlace}
                      onChange={(event) => updateSaleForm("contractPlace", event.target.value)}
                      className={inputClass("contractPlace")}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Data podpisania umowy</span>
                    <input
                      type="date"
                      value={saleForm.contractDate}
                      onChange={(event) => updateSaleForm("contractDate", event.target.value)}
                      className={inputClass("contractDate")}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      checked={saleForm.visitPreviouslyScheduled === true}
                      onChange={() => updateSaleForm("visitPreviouslyScheduled", true)}
                    />
                    Wizyta wcześniej umówiona
                  </label>

                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      checked={saleForm.visitPreviouslyScheduled === false}
                      onChange={() => {
                        updateSaleForm("visitPreviouslyScheduled", false);
                        updateSaleForm("realizationVariant", "");
                      }}
                    />
                    Wizyta nieumówiona
                  </label>
                </div>

                {saleForm.visitPreviouslyScheduled === true && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        checked={saleForm.realizationVariant === "1A"}
                        onChange={() => updateSaleForm("realizationVariant", "1A")}
                      />
                      Wariant 1A — start przed upływem 14 dni
                    </label>

                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        checked={saleForm.realizationVariant === "1B"}
                        onChange={() => updateSaleForm("realizationVariant", "1B")}
                      />
                      Wariant 1B — start po upływie 14 dni
                    </label>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-sm font-black text-slate-900">Zgody marketingowe i wizerunkowe</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Zgody zostaną przeniesione do Załącznika nr 3 umowy.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={saleForm.client1MarketingEmail}
                        onChange={(event) => updateSaleForm("client1MarketingEmail", event.target.checked)}
                      />
                      Klient 1 — email marketingowy
                    </label>

                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={saleForm.client1MarketingPhone}
                        onChange={(event) => updateSaleForm("client1MarketingPhone", event.target.checked)}
                      />
                      Klient 1 — kontakt telefoniczny
                    </label>

                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={saleForm.client1PhotoConsent}
                        onChange={(event) => updateSaleForm("client1PhotoConsent", event.target.checked)}
                      />
                      Klient 1 — zdjęcia realizacji
                    </label>
                  </div>

                  {saleForm.secondClientName.trim() && (
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={saleForm.client2MarketingEmail}
                          onChange={(event) => updateSaleForm("client2MarketingEmail", event.target.checked)}
                        />
                        Klient 2 — email marketingowy
                      </label>

                      <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={saleForm.client2MarketingPhone}
                          onChange={(event) => updateSaleForm("client2MarketingPhone", event.target.checked)}
                        />
                        Klient 2 — kontakt telefoniczny
                      </label>

                      <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={saleForm.client2PhotoConsent}
                          onChange={(event) => updateSaleForm("client2PhotoConsent", event.target.checked)}
                        />
                        Klient 2 — zdjęcia realizacji
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {duplicateClientModal.open && duplicateClientModal.client && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                <div>
                  <p className="text-lg font-black text-red-900">
                    Możliwy duplikat klienta
                  </p>

                  <p className="mt-2 text-sm font-medium text-red-800">
                    W systemie istnieje już klient o podobnych danych.
                  </p>

                  <div className="mt-4 rounded-xl border border-red-200 bg-white p-4">
                    <p className="text-sm font-bold text-slate-900">
                      Lead-ID #{duplicateClientModal.client.public_id || "BRAK"}
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {duplicateClientModal.client.full_name ||
                        duplicateClientModal.client.company_name ||
                        "Nieznany klient"}
                    </p>
                  </div>

                  <p className="mt-4 text-sm text-red-800">
                    Chcesz kontynuować na istniejącym kliencie czy utworzyć nowego klienta?
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!duplicateClientModal.client) {
                        return;
                      }

                      const assignedUserId =
                        duplicateClientModal.client.assigned_user_id ||
                        duplicateClientModal.client.assigned_to ||
                        null;

                      const hasConflict =
                        !!assignedUserId &&
                        assignedUserId !== currentUserId;

                      setClientConflictDetected(hasConflict);
                      setDuplicateDecision("existing");
                      duplicateWorkflowRef.current = {
                        decision: "existing",
                        clientId: duplicateClientModal.client.id,
                        conflictDetected: hasConflict,
                      };

                      setSelectedExistingClientId(duplicateClientModal.client.id);
                      setSkipDuplicateCheck(true);

                      setDuplicateClientModal({
                        open: false,
                        client: null,
                      });

                      const workflow = {
                        decision: "existing" as const,
                        clientId: duplicateClientModal.client.id,
                        conflictDetected: hasConflict,
                      };

                      duplicateWorkflowRef.current = workflow;

                      setTimeout(() => {
                        createSaleFromOffer(workflow);
                      }, 50);
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Kontynuuj na istniejącym
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateDecision("new");
                      const workflow = {
                        decision: "new" as const,
                        clientId: null,
                        conflictDetected: false,
                      };

                      duplicateWorkflowRef.current = workflow;
                      setDuplicateClientModal({
                        open: false,
                        client: null,
                      });

                      setAllowDuplicateClientCreation(true);

                      setTimeout(() => {
                        createSaleFromOffer(workflow);
                      }, 0);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Utwórz nowego klienta
                  </button>
                </div>
              </div>
            )}
            {clientConflictDetected && duplicateDecision === "existing" && (
              <div className="mt-4 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
                Wykryto potencjalny konflikt klienta. Klient jest przypisany do innego doradcy. W kolejnym kroku dodamy tag „Możliwy konflikt” i powiadomienie owner/admin.
              </div>
            )}

            {duplicateDecision === "new" && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                Utworzono nowego klienta pomimo wykrycia podobnych danych. W kolejnym kroku dodamy tag „Możliwy dubel” oraz powiadomienie owner/admin do weryfikacji.
              </div>
            )}
            {showCancelSaleModal && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-lg font-black text-red-900">
                  Czy na pewno chcesz przerwać dodawanie sprzedaży?
                </p>

                <p className="mt-2 text-sm text-red-800">
                  Wprowadzone dane zostaną utracone.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelSaleModal(false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Wróć do formularza
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelSaleModal(false);
                      setShowSaleForm(false);
                      router.push('/sales');
                    }}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                  >
                    Przerwij dodawanie
                  </button>
                </div>
              </div>
            )}
            {createSaleStatus && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {createSaleStatus}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelSaleModal(true)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Zamknij
              </button>

              <button
                type="button"
                onClick={() => createSaleFromOffer()}
                disabled={creatingSale}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500"
              >
                {creatingSale ? "Tworzenie sprzedaży..." : "Zapisz sprzedaż"}
              </button>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                {getOfferTypeLabel(offer.offer_type)}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {offer.status || "draft"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Klient</p>
                <p className="mt-1 font-black text-slate-900">
                  {getClientDisplayName(client, offer)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {client?.email || offer.client_email || "Brak maila"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {client?.phone || "Brak telefonu"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Adres</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {getClientAddress(client)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Doradca</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {creator?.display_name || creator?.full_name || creator?.name || creator?.username || advisor?.name || creator?.email || "Brak danych"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {advisor?.phone || "Brak telefonu"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Parametry</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  PV: {numberValue(offer.pv_power_kw, "kWp")}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Magazyn: {offer.energy_storage || "Brak"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Finanse</p>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Cena brutto</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {money(offer.sale_price_gross)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Cena netto</p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {money(offer.sale_price_net)}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  {canSeeFullFinancials
                    ? "Marża firmy"
                    : canSeeManagerFinancials
                      ? "Marża handlowca"
                      : "Moja marża"}
                </p>
                <p className="mt-1 text-xl font-black text-emerald-950">
                  {money(canSeeFullFinancials ? offer.company_margin : offer.seller_margin)}
                </p>
              </div>

              {canSeeFullFinancials && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">Marża doradcy</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {money(offer.seller_margin)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Technika</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Panele</p>
                <p className="mt-1 font-semibold text-slate-900">{offer.panel_model || "Brak"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {offer.panel_count || "Brak"} szt. · {numberValue(offer.panel_power_wp, "Wp")}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Falownik</p>
                <p className="mt-1 font-semibold text-slate-900">{offer.inverter || "Brak"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Dach</p>
                <p className="mt-1 font-semibold text-slate-900">{offer.roof_type || "Brak"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">VAT</p>
                <p className="mt-1 font-semibold text-slate-900">{numberValue(offer.vat_rate, "%")}</p>
              </div>
            </div>
          </div>

          {canSeeFullFinancials ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Widok techniczny</h2>
              <p className="mt-1 text-sm text-slate-500">
                Dane techniczne i kosztowe zapisane z kalkulatora. Widoczne tylko dla admina i ownera.
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Konfiguracja z formularza
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(formData)
                    .filter(([, value]) => value !== null && value !== undefined && value !== "")
                    .map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-slate-400">
                          {humanizeKey(key)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                          {String(value)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
                    Rozpiska kosztów i zysków z kalkulatora
                  </h3>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    {savedBreakdownRows.length} pozycji
                  </span>
                </div>

                {savedBreakdownRows.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                    W tej ofercie nie zapisano listy kosztów `result.breakdown`.
                    Dla nowych ofert zapis powinien pobrać listę z komponentu OfferResult.
                  </div>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-black text-slate-900">
                        Realna marża firmy
                      </p>
                      <p className="shrink-0 text-base font-black text-emerald-700">
                        {money(result?.companyMargin ?? offer.company_margin)}
                      </p>
                    </div>

                    {savedBreakdownRows.map((item, index) => (
                      <div
                        key={`${item.label}-${index}`}
                        className={`flex items-center justify-between gap-4 px-4 py-2.5 ${
                          index !== savedBreakdownRows.length - 1 ? "border-b border-slate-100" : ""
                        }`}
                      >
                        <p className="min-w-0 text-sm text-slate-700">
                          {item.label}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-slate-900">
                          {money(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-bold text-slate-900">
                  Pokaż pełne dane techniczne zapisane w ofercie
                </summary>

                <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(offer.offer_data || {}, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

