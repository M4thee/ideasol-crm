

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";


type UserRole = "owner" | "admin" | "seller" | "cc" | null;

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
  depositAmount: string;
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

function emptySaleForm(): SaleFromOfferForm {
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
    depositAmount: "",
  };
}

function normalizeRole(value: unknown): UserRole {
  if (value === "owner" || value === "admin" || value === "seller" || value === "cc") {
    return value;
  }

  return null;
}

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [offer, setOffer] = useState<ClientOffer | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [creator, setCreator] = useState<UserProfile | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [creatingSale, setCreatingSale] = useState(false);
  const [createSaleStatus, setCreateSaleStatus] = useState("");
  const [saleForm, setSaleForm] = useState<SaleFromOfferForm>(() => emptySaleForm());

  const canSeeFullFinancials = useMemo(
    () => ["owner", "admin"].includes(currentUserRole || ""),
    [currentUserRole]
  );

  useEffect(() => {
    loadOffer();
  }, [offerId]);

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
      .from("user_profiles")
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
    const isManager = ["owner", "admin"].includes(role || "");
    const isOfferOwner = loadedOffer.created_by === user.id;

    if (!isManager && !isOfferOwner) {
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
    }

    if (loadedOffer.created_by) {
      const { data: creatorData, error: creatorError } = await supabase
        .from("user_profiles")
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
  function updateSaleForm<K extends keyof SaleFromOfferForm>(
    key: K,
    value: SaleFromOfferForm[K]
  ) {
    setSaleForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openSaleFormFromOffer() {
    if (!offer) return;

    const address = getClientContractAddressParts(client);

    const inferredCustomerType: SaleCustomerType =
      client?.company_name || client?.nip ? "b2b" : "b2c";

    const contractAddress = buildFullAddress(
      address.street,
      address.buildingNumber,
      address.postalCode,
      address.city
    );

    const fullName = getClientField(client, ["full_name", "name", "client_name", "imie_nazwisko"]);
    const companyName = getClientField(client, ["company_name", "company", "nazwa_firmy"]);
    const nip = getClientField(client, ["nip", "tax_id"]);
    const regon = getClientField(client, ["regon"]);
    const representativeName = getClientField(client, ["contact_person", "representative_name", "osoba_reprezentujaca", "full_name"]);
    const pesel = getClientField(client, ["pesel"]);
    const phone = getClientField(client, ["phone", "contact_phone", "telefon", "phone_number"]);
    const email = getClientField(client, ["email", "contact_email", "mail"]);
    const correspondenceAddress = getClientField(client, ["correspondence_address", "adres_korespondencyjny"]);
    const installationAddress = getClientField(client, ["installation_address", "adres_montazu", "mounting_address"]);

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
      depositAmount: "",
    });

    setCreateSaleStatus("");
    setShowSaleForm(true);
  }

  function validateSaleForm() {
    const contractAddressComplete =
      saleForm.contractStreet.trim() &&
      saleForm.contractBuildingNumber.trim() &&
      saleForm.contractPostalCode.trim() &&
      saleForm.contractCity.trim();

    if (saleForm.customerType === "b2c" && !saleForm.fullName.trim()) {
      return "Uzupełnij imię i nazwisko klienta.";
    }

    if (saleForm.customerType === "b2b") {
      if (!saleForm.companyName.trim()) return "Uzupełnij nazwę firmy.";
      if (!saleForm.nip.trim()) return "Uzupełnij NIP.";
      if (!saleForm.regon.trim()) return "Uzupełnij REGON.";
      if (!saleForm.representativeName.trim()) return "Uzupełnij osobę reprezentującą.";
    }

    if (!contractAddressComplete) return "Uzupełnij pełny adres na umowie.";
    if (!saleForm.pesel.trim()) return "Uzupełnij PESEL.";
    if (!saleForm.phone.trim()) return "Uzupełnij numer telefonu.";
    if (!saleForm.email.trim()) return "Uzupełnij adres email.";
    if (!saleForm.paymentMethod) return "Wybierz formę płatności.";
    if (!saleForm.depositAmount.trim()) return "Uzupełnij wysokość zaliczki.";

    const parsedDeposit = Number(saleForm.depositAmount.replace(",", "."));
    if (!Number.isFinite(parsedDeposit)) return "Wysokość zaliczki musi być liczbą.";

    return "";
  }

  function buildSoldItemsFromOffer() {
    return [
      offer?.pv_power_kw ? `PV ${offer.pv_power_kw} kWp` : null,
      offer?.energy_storage && offer.energy_storage !== "Brak"
        ? `Magazyn energii ${offer.energy_storage}`
        : null,
      offer?.inverter && offer.inverter !== "Brak" ? `Falownik ${offer.inverter}` : null,
    ]
      .filter(Boolean)
      .join(" + ");
  }

  async function createSaleFromOffer() {
    if (!offer) return;

    const validationError = validateSaleForm();

    if (validationError) {
      setCreateSaleStatus(validationError);
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

    const depositAmount = Number(saleForm.depositAmount.replace(",", "."));

    setCreatingSale(true);
    setCreateSaleStatus("");

    const salePayload = {
      client_id: offer.client_id,
      seller_id: offer.created_by,
      source_offer_id: offer.id,
      sale_date: new Date().toISOString(),
      contract_value: offer.sale_price_gross || 0,
      margin_value: offer.seller_margin || 0,
      sold_items: buildSoldItemsFromOffer() || getOfferTypeLabel(offer.offer_type),
      status: "Oczekiwanie na zaksięgowanie zaliczki",
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
        contract_address: contractAddress,
        correspondence_address: correspondenceAddress,
        installation_address: installationAddress,
      },
      offer_snapshot: offer,
      payment_method: saleForm.paymentMethod,
      deposit_amount: depositAmount,
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

    const { error: updateOfferError } = await supabase
      .from("client_offers")
      .update({ status: "sale_created" })
      .eq("id", offer.id);

    if (updateOfferError) {
      console.error("Błąd aktualizacji statusu oferty:", updateOfferError);
    }

    setCreatingSale(false);
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

            <button
              type="button"
              onClick={openSaleFormFromOffer}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Utwórz sprzedaż z oferty
            </button>
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

              <button
                type="button"
                onClick={() => setShowSaleForm(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Zamknij
              </button>
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
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Nazwa firmy</span>
                    <input
                      value={saleForm.companyName}
                      onChange={(event) => updateSaleForm("companyName", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">NIP</span>
                    <input
                      value={saleForm.nip}
                      onChange={(event) => updateSaleForm("nip", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">REGON</span>
                    <input
                      value={saleForm.regon}
                      onChange={(event) => updateSaleForm("regon", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Osoba reprezentująca</span>
                    <input
                      value={saleForm.representativeName}
                      onChange={(event) => updateSaleForm("representativeName", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">PESEL</span>
                <input
                  value={saleForm.pesel}
                  onChange={(event) => updateSaleForm("pesel", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Telefon</span>
                <input
                  value={saleForm.phone}
                  onChange={(event) => updateSaleForm("phone", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email</span>
                <input
                  value={saleForm.email}
                  onChange={(event) => updateSaleForm("email", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <div className="grid gap-4 md:col-span-2 md:grid-cols-4">
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Ulica</span>
                  <input
                    value={saleForm.contractStreet}
                    onChange={(event) => updateSaleForm("contractStreet", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nr domu/lokalu</span>
                  <input
                    value={saleForm.contractBuildingNumber}
                    onChange={(event) => updateSaleForm("contractBuildingNumber", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Kod pocztowy</span>
                  <input
                    value={saleForm.contractPostalCode}
                    onChange={(event) => updateSaleForm("contractPostalCode", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="block md:col-span-4">
                  <span className="text-sm font-semibold text-slate-700">Miejscowość</span>
                  <input
                    value={saleForm.contractCity}
                    onChange={(event) => updateSaleForm("contractCity", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                  onChange={(event) => updateSaleForm("paymentMethod", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="gotówka">Gotówka</option>
                  <option value="kredyt">Kredyt</option>
                  {saleForm.customerType === "b2b" && <option value="leasing">Leasing</option>}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Wysokość zaliczki</span>
                <input
                  value={saleForm.depositAmount}
                  onChange={(event) => updateSaleForm("depositAmount", event.target.value)}
                  placeholder="np. 5000"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>

            {createSaleStatus && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {createSaleStatus}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaleForm(false)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={createSaleFromOffer}
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
                  {canSeeFullFinancials ? "Marża firmy" : "Moja marża"}
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

