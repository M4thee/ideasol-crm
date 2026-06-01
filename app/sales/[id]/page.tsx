"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Sale = {
  id: string;
  public_id: number | null;
  sale_public_id?: string | null;
  sale_number?: number | null;
  event_id: string | null;
  client_id: string | null;
  seller_id: string | null;
  source_offer_id?: string | null;
  contract_number?: string | null;
  sale_date: string;
  contract_value: number | null;
  margin_value: number | null;
  sold_items: string | null;
  status: string;
  customer_type?: string | null;
  customer_data?: Record<string, any> | null;
  offer_snapshot?: Record<string, any> | null;
  payment_method?: string | null;
  deposit_amount?: number | null;
  created_at: string;
};

type SaleDocument = {
  id: string;
  sale_id: string;
  client_id: string | null;
  uploaded_by: string;
  description: string;
  document_type?: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

type SaleNote = {
  id: string;
  sale_id: string;
  client_id: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
};

type Client = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  street?: string | null;
  building_number?: string | null;
  postal_code?: string | null;
  address?: string | null;
};

type SellerProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};


type ActiveTab = "sale" | "documents" | "financial" | "notes";

type UserRole = "owner" | "admin" | "manager" | "seller" | "cc" | null;


const SALE_STATUSES = [
  "Oczekiwanie na zaksięgowanie zaliczki",
  "Umówione do montażu",
  "Zamontowany",
  "Oczekiwanie na pełną wpłatę",
  "Zakończona",
  "Anulowana",
];

const DOCUMENT_TYPES = [
  "Umowa",
  "Zdjęcia",
  "Potwierdzenie wpłaty",
  "Umowa kredytowa",
  "Protokół montażu",
  "Dokumenty związane z dotacją",
  "Inne",
];

function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Brak danych";
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/\s/g, "").replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return "Brak danych";
  }

  return `${parsed.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

function getCustomerMoneyValue(customerData: Record<string, any> | null | undefined, key: string) {
  const value = customerData?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/\s/g, "").replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

function getContractPriceRows(customerData: Record<string, any> | null | undefined) {
  const rows = [
    {
      label: "Instalacja fotowoltaiczna wraz z montażem",
      netAfterDiscount: getCustomerMoneyValue(customerData, "contract_pv_net_after_discount"),
      beforeDiscount: getCustomerMoneyValue(customerData, "contract_pv_gross_before_discount"),
      afterDiscount:
        getCustomerMoneyValue(customerData, "contract_pv_gross_after_discount") ??
        getCustomerMoneyValue(customerData, "contract_pv_gross"),
    },
    {
      label: "Magazyn energii wraz z montażem",
      netAfterDiscount: getCustomerMoneyValue(customerData, "contract_storage_net_after_discount"),
      beforeDiscount: getCustomerMoneyValue(customerData, "contract_storage_gross_before_discount"),
      afterDiscount:
        getCustomerMoneyValue(customerData, "contract_storage_gross_after_discount") ??
        getCustomerMoneyValue(customerData, "contract_storage_gross"),
    },
    {
      label: "System zarządzania energią (EMS)",
      netAfterDiscount: getCustomerMoneyValue(customerData, "contract_ems_net_after_discount"),
      beforeDiscount: getCustomerMoneyValue(customerData, "contract_ems_gross_before_discount"),
      afterDiscount:
        getCustomerMoneyValue(customerData, "contract_ems_gross_after_discount") ??
        getCustomerMoneyValue(customerData, "contract_ems_gross"),
    },
    {
      label: "Zasilanie awaryjne budynku z magazynu energii (Backup)",
      netAfterDiscount: getCustomerMoneyValue(customerData, "contract_backup_net_after_discount"),
      beforeDiscount: getCustomerMoneyValue(customerData, "contract_backup_gross_before_discount"),
      afterDiscount:
        getCustomerMoneyValue(customerData, "contract_backup_gross_after_discount") ??
        getCustomerMoneyValue(customerData, "contract_backup_gross"),
    },
    {
      label: "Usługi dodatkowe wymienione w §1 umowy",
      netAfterDiscount: getCustomerMoneyValue(customerData, "contract_additional_services_net_after_discount"),
      beforeDiscount: getCustomerMoneyValue(customerData, "contract_additional_services_gross_before_discount"),
      afterDiscount:
        getCustomerMoneyValue(customerData, "contract_additional_services_gross_after_discount") ??
        getCustomerMoneyValue(customerData, "contract_additional_services_gross"),
    },
  ];

  const totalBeforeDiscount = getCustomerMoneyValue(customerData, "contract_total_gross_before_discount");
  const totalNetAfterDiscount = getCustomerMoneyValue(customerData, "contract_total_net_after_discount");
  const totalAfterDiscount =
    getCustomerMoneyValue(customerData, "contract_total_gross_after_discount") ??
    getCustomerMoneyValue(customerData, "contract_total_gross");

  return {
    rows,
    totalNetAfterDiscount,
    totalBeforeDiscount,
    totalAfterDiscount,
    hasAnyValue: rows.some((row) => row.beforeDiscount !== null || row.afterDiscount !== null),
  };
}

function formatDateOnly(value: unknown) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "Brak";
  }

  const date = new Date(`${rawValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  return date.toLocaleDateString("pl-PL");
}

function formatYesNo(value: unknown) {
  if (value === true) return "Tak";
  if (value === false) return "Nie";
  return "Brak";
}

export default function SalePage() {
  const params = useParams<{ id: string }>();
  const saleId = params.id;

  const [sale, setSale] = useState<Sale | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [editingSaleData, setEditingSaleData] = useState(false);
  const [savingSaleData, setSavingSaleData] = useState(false);
  const [contractValueInput, setContractValueInput] = useState("");
  const [marginValueInput, setMarginValueInput] = useState("");
  const [soldItemsInput, setSoldItemsInput] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("sale");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(null);
  const [documents, setDocuments] = useState<SaleDocument[]>([]);
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentType, setDocumentType] = useState("Umowa");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentStatus, setDocumentStatus] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [saleNotes, setSaleNotes] = useState<SaleNote[]>([]);
  const [newSaleNote, setNewSaleNote] = useState("");
  const [savingSaleNote, setSavingSaleNote] = useState(false);
  const [saleNoteStatus, setSaleNoteStatus] = useState("");

  useEffect(() => {
    loadSale();
  }, [saleId]);

  async function loadSale() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);

      const { data: currentProfileData, error: currentProfileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (currentProfileError) {
        console.error("Błąd ładowania roli aktualnego użytkownika z profiles:", currentProfileError);
      }

      let resolvedRole = (currentProfileData?.role || null) as UserRole;

      if (!resolvedRole) {
        const { data: currentUserProfileData, error: currentUserProfileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (currentUserProfileError) {
          console.error("Błąd ładowania roli aktualnego użytkownika z user_profiles:", currentUserProfileError);
        }

        resolvedRole = (currentUserProfileData?.role || null) as UserRole;
      }

      setCurrentUserRole(resolvedRole);
    }

    const { data: saleData, error } = await supabase
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (error || !saleData) {
      console.error("Błąd ładowania sprzedaży:", error);
      setLoading(false);
      return;
    }

    setSale(saleData as Sale);
    setContractValueInput(
      saleData.contract_value !== null && saleData.contract_value !== undefined
        ? String(saleData.contract_value)
        : ""
    );
    setMarginValueInput(
      saleData.margin_value !== null && saleData.margin_value !== undefined
        ? String(saleData.margin_value)
        : ""
    );
    setSoldItemsInput(saleData.sold_items || "");

      if (saleData.client_id) {
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select("id, full_name, company_name, phone, email, city, street, building_number, postal_code, address")
          .eq("id", saleData.client_id)
          .maybeSingle();

      if (clientError) {
        console.error("Błąd ładowania klienta sprzedaży:", clientError);
      }

      setClient((clientData as Client) || null);
    }
    if (saleData.seller_id) {
      const { data: sellerData, error: sellerError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("id", saleData.seller_id)
        .maybeSingle();

      if (sellerError) {
        console.error("Błąd ładowania sprzedawcy sprzedaży:", sellerError);
      }

      setSellerProfile((sellerData as SellerProfile) || null);
    } else {
      setSellerProfile(null);
    }

    const { data: documentsData, error: documentsError } = await supabase
      .from("sale_documents")
      .select("*")
      .eq("sale_id", saleData.id)
      .order("created_at", { ascending: false });

    if (documentsError) {
      console.error("Błąd ładowania dokumentów sprzedaży:", documentsError);
    }

    setDocuments((documentsData as SaleDocument[]) || []);

    const { data: saleNotesData, error: saleNotesError } = await supabase
      .from("sale_notes")
      .select("*")
      .eq("sale_id", saleData.id)
      .order("created_at", { ascending: false });

    if (saleNotesError) {
      console.error("Błąd ładowania notatek sprzedaży:", saleNotesError);
    }

    setSaleNotes((saleNotesData as SaleNote[]) || []);

    setLoading(false);
  }

  async function updateSaleStatus(status: string) {
    if (!sale) return;

    try {
      setSavingStatus(true);

      const { error } = await supabase
        .from("sales")
        .update({ status })
        .eq("id", sale.id);

      if (error) {
        console.error("Błąd zmiany statusu sprzedaży:", error);
        alert("Nie udało się zmienić statusu sprzedaży.");
        return;
      }

      setSale({
        ...sale,
        status,
      });
    } catch (error) {
      console.error("Nieoczekiwany błąd zmiany statusu:", error);
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveSaleData() {
    if (!sale) return;

    const normalizedContractValue = contractValueInput.trim().replace(",", ".");
    const normalizedMarginValue = marginValueInput.trim().replace(",", ".");

    const contractValue = normalizedContractValue
      ? Number(normalizedContractValue)
      : null;

    const marginValue = normalizedMarginValue
      ? Number(normalizedMarginValue)
      : null;

    if (contractValue !== null && Number.isNaN(contractValue)) {
      alert("Wartość umowy musi być liczbą.");
      return;
    }

    if (marginValue !== null && Number.isNaN(marginValue)) {
      alert("Marża doradcy musi być liczbą.");
      return;
    }

    try {
      setSavingSaleData(true);

      const { error } = await supabase
        .from("sales")
        .update({
          contract_value: contractValue,
          margin_value: marginValue,
          sold_items: soldItemsInput.trim() || null,
        })
        .eq("id", sale.id);

      if (error) {
        console.error("Błąd zapisu danych sprzedaży:", error);
        alert("Nie udało się zapisać danych sprzedaży.");
        return;
      }

      setSale({
        ...sale,
        contract_value: contractValue,
        margin_value: marginValue,
        sold_items: soldItemsInput.trim() || null,
      });

      setEditingSaleData(false);
    } catch (error) {
      console.error("Nieoczekiwany błąd zapisu danych sprzedaży:", error);
      alert("Wystąpił nieoczekiwany błąd podczas zapisu danych sprzedaży.");
    } finally {
      setSavingSaleData(false);
    }
  }

  async function uploadSaleDocument() {
    if (!sale || !documentFile || !currentUserId) {
      setDocumentStatus("Wybierz plik dokumentu.");
      return;
    }
    try {
      setUploadingDocument(true);
      setDocumentStatus("");

      const safeFileName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${sale.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("sale-documents")
        .upload(filePath, documentFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Błąd uploadu dokumentu:", uploadError);
        setDocumentStatus(uploadError.message || "Nie udało się przesłać dokumentu.");
        return;
      }

      const { data: insertedDocument, error: insertError } = await supabase
        .from("sale_documents")
        .insert({
          sale_id: sale.id,
          client_id: sale.client_id,
          uploaded_by: currentUserId,
          description: documentDescription.trim() || documentType,
          document_type: documentType,
          file_name: documentFile.name,
          file_path: filePath,
          file_type: documentFile.type || null,
          file_size: documentFile.size,
        })
        .select("*")
        .single();

      if (insertError || !insertedDocument) {
        console.error("Błąd zapisu metadanych dokumentu:", insertError);
        setDocumentStatus(insertError?.message || "Plik wysłany, ale nie zapisano danych dokumentu.");
        return;
      }

      setDocuments((current) => [insertedDocument as SaleDocument, ...current]);
      setDocumentDescription("");
      setDocumentType("Umowa");
      setDocumentFile(null);
      setDocumentStatus("Dokument został dodany.");
    } catch (error) {
      console.error("Nieoczekiwany błąd uploadu dokumentu:", error);
      setDocumentStatus("Wystąpił nieoczekiwany błąd podczas dodawania dokumentu.");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function deleteSaleDocument(document: SaleDocument) {
    if (!canDeleteDocuments) return;

    const confirmed = window.confirm("Czy na pewno usunąć ten dokument?");

    if (!confirmed) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("sale-documents")
        .remove([document.file_path]);

      if (storageError) {
        console.error("Błąd usuwania pliku dokumentu:", storageError);
        alert("Nie udało się usunąć pliku dokumentu.");
        return;
      }

      const { error: dbError } = await supabase
        .from("sale_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) {
        console.error("Błąd usuwania dokumentu z bazy:", dbError);
        alert("Plik usunięty, ale nie udało się usunąć wpisu dokumentu z bazy.");
        return;
      }

      setDocuments((current) =>
        current.filter((item) => item.id !== document.id)
      );
    } catch (error) {
      console.error("Nieoczekiwany błąd usuwania dokumentu:", error);
      alert("Wystąpił nieoczekiwany błąd podczas usuwania dokumentu.");
    }
  }

  async function addSaleNote() {
    if (!sale || !currentUserId || !newSaleNote.trim()) {
      setSaleNoteStatus("Wpisz treść notatki.");
      return;
    }

    try {
      setSavingSaleNote(true);
      setSaleNoteStatus("");

      const cleanContent = newSaleNote.trim();

      const { data: insertedSaleNote, error: saleNoteError } = await supabase
        .from("sale_notes")
        .insert({
          sale_id: sale.id,
          client_id: sale.client_id,
          content: cleanContent,
          created_by: currentUserId,
        })
        .select("*")
        .single();

      if (saleNoteError || !insertedSaleNote) {
        console.error("Błąd zapisu notatki sprzedaży:", saleNoteError);
        setSaleNoteStatus(saleNoteError?.message || "Nie udało się zapisać notatki sprzedaży.");
        return;
      }

      if (sale.client_id) {
        const clientNoteContent = `${visibleSaleId}: ${cleanContent}`;

        const { error: clientNoteError } = await supabase
          .from("client_notes")
          .insert({
            client_id: sale.client_id,
            content: clientNoteContent,
            created_by: currentUserId,
          });

        if (clientNoteError) {
          console.error("Błąd zapisu notatki na karcie klienta:", clientNoteError);
          setSaleNoteStatus("Notatka zapisana na sprzedaży, ale nie udało się dodać jej na karcie klienta.");
        } else {
          setSaleNoteStatus("Notatka została zapisana na sprzedaży i karcie klienta.");
        }
      } else {
        setSaleNoteStatus("Notatka została zapisana na sprzedaży.");
      }

      setSaleNotes((current) => [insertedSaleNote as SaleNote, ...current]);
      setNewSaleNote("");
    } catch (error) {
      console.error("Nieoczekiwany błąd zapisu notatki sprzedaży:", error);
      setSaleNoteStatus("Wystąpił nieoczekiwany błąd podczas zapisu notatki.");
    } finally {
      setSavingSaleNote(false);
    }
  }
async function deleteSale() {
  if (!sale || !canDeleteSale) return;

  const confirmed = window.confirm(
    "Czy na pewno chcesz usunąć tę sprzedaż? Operacja jest nieodwracalna."
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from("sales")
      .delete()
      .eq("id", sale.id);

    if (error) {
      console.error("Błąd usuwania sprzedaży:", error);
      alert("Nie udało się usunąć sprzedaży.");
      return;
    }

    alert("Sprzedaż została usunięta.");

    window.location.href = "/sales";
  } catch (error) {
    console.error("Nieoczekiwany błąd usuwania sprzedaży:", error);
    alert("Wystąpił nieoczekiwany błąd podczas usuwania sprzedaży.");
  }
}
  if (loading) {
    return (
      <main>
        <p className="text-slate-500">Ładowanie sprzedaży...</p>
      </main>
    );
  }

  if (!sale) {
    return (
      <main>
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Nie znaleziono sprzedaży
          </h1>

          <p className="text-slate-600 break-all">
            Szukane ID: {saleId}
          </p>
        </div>
      </main>
    );
  }

  const visibleSaleId = sale.sale_public_id
    ? sale.sale_public_id
    : sale.public_id
      ? `SID${String(sale.public_id).padStart(6, "0")}`
      : `SID-${sale.id.slice(0, 8).toUpperCase()}`;
  const clientName = client?.full_name || client?.company_name || "Brak klienta";

  const saleCustomerData = sale.customer_data || {};
  const contractPriceRows = getContractPriceRows(saleCustomerData);

  const contractNumber =
    sale.contract_number ||
    saleCustomerData.contract_number ||
    "Brak";

  const ownershipLabel =
    saleCustomerData.ownership_type === "co_owner"
      ? "Współwłasność"
      : saleCustomerData.ownership_type === "single"
        ? "Własność"
        : "Brak";

  const visitLabel = formatYesNo(saleCustomerData.visit_previously_scheduled);
  const realizationVariantLabel = saleCustomerData.realization_variant || "Nie dotyczy";

  function joinAddressParts(parts: Array<string | number | null | undefined>) {
    return parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  }

  function formatPostalCity(postalCode?: string | null, city?: string | null) {
    return [postalCode, city]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  }

  function buildMultilineAddress(line1?: string | null, line2?: string | null) {
    const cleanLine1 = String(line1 || "").trim();
    const cleanLine2 = String(line2 || "").trim();

    return [cleanLine1, cleanLine2].filter(Boolean).join("\n") || "Brak";
  }

  const contractAddress = buildMultilineAddress(
    joinAddressParts([
      saleCustomerData.contractStreet || saleCustomerData.street || client?.street || client?.address,
      saleCustomerData.contractBuildingNumber || saleCustomerData.buildingNumber || client?.building_number,
    ]),
    formatPostalCity(
      saleCustomerData.contractPostalCode || saleCustomerData.postalCode || client?.postal_code,
      saleCustomerData.contractCity || saleCustomerData.city || client?.city
    )
  );

  const installationAddress = buildMultilineAddress(
    joinAddressParts([
      saleCustomerData.installationStreet || saleCustomerData.mountingStreet || saleCustomerData.contractStreet || client?.street || client?.address,
      saleCustomerData.installationBuildingNumber || saleCustomerData.mountingBuildingNumber || saleCustomerData.contractBuildingNumber || client?.building_number,
    ]),
    formatPostalCity(
      saleCustomerData.installationPostalCode || saleCustomerData.mountingPostalCode || saleCustomerData.contractPostalCode || client?.postal_code,
      saleCustomerData.installationCity || saleCustomerData.mountingCity || saleCustomerData.contractCity || client?.city
    )
  );

  const soldItemsList = String(sale.sold_items || "")
    .split(/\n|\s\+\s/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const financialData = sale.offer_snapshot?.offer_data?.result || null;
  const financialBreakdown = Array.isArray(financialData?.breakdown)
    ? financialData.breakdown
    : [];

  const companyMargin =
    typeof financialData?.companyMargin === "number"
      ? financialData.companyMargin
      : null;

  const canSeeFullFinancials =
  currentUserRole === "owner" || currentUserRole === "admin";

const canSeeManagerFee =
  currentUserRole === "owner" ||
  currentUserRole === "admin" ||
  currentUserRole === "manager";

const canSeeSellerCommission =
  currentUserRole === "owner" ||
  currentUserRole === "admin" ||
  currentUserRole === "manager" ||
  currentUserRole === "seller";

function isSellerCommissionItem(label?: string | null) {
  const normalizedLabel = String(label || "").toLowerCase();

  return (
    normalizedLabel.includes("prowizja handlowca") ||
    normalizedLabel.includes("handlowca") ||
    normalizedLabel.includes("seller commission")
  );
}

function isManagerFeeItem(label?: string | null) {
  const normalizedLabel = String(label || "").toLowerCase();

  return (
    normalizedLabel.includes("manager fee") ||
    normalizedLabel.includes("manager override") ||
    normalizedLabel.includes("opłata manager") ||
    normalizedLabel.includes("oplata manager") ||
    normalizedLabel.includes("prowizja manager") ||
    normalizedLabel.includes("prowizja menedżer") ||
    normalizedLabel.includes("prowizja menedzer")
  );
}

function canShowFinancialBreakdownItem(label?: string | null) {
  if (canSeeFullFinancials) return true;

  if (isSellerCommissionItem(label)) {
    return canSeeSellerCommission;
  }

  if (isManagerFeeItem(label)) {
    return canSeeManagerFee;
  }

  return false;
}


  const canManageSaleStatus =
    currentUserRole === "owner" || currentUserRole === "admin";
  const canDeleteDocuments = currentUserRole === "admin";
  const canDeleteSale = currentUserRole === "admin";
  return (
    <main className="text-slate-900">
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-500 mb-1">{visibleSaleId}</p>

            <h1 className="text-3xl font-bold text-slate-900">
              Karta sprzedaży
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/sales/${sale.id}/contract`;
              }}
              className="rounded-xl bg-[#119182] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f7f72]"
            >
              Generuj umowę
            </button>

            {sale.client_id && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/clients/${sale.client_id}`;
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Karta klienta
              </button>
            )}

            {canDeleteSale && (
              <button
                type="button"
                onClick={deleteSale}
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Usuń sprzedaż
              </button>
            )}
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-slate-500 mb-1">Klient</p>
              <h2 className="text-2xl font-bold text-slate-900">
                {clientName}
              </h2>
            </div>

            <div className="min-w-[320px]">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status sprzedaży
              </label>

              {canManageSaleStatus ? (
                <select
                  value={sale.status}
                  onChange={(e) => updateSaleStatus(e.target.value)}
                  disabled={savingStatus}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white text-slate-950"
                >
                  {SALE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">
                  {sale.status}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className="min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center gap-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("sale")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${
                  activeTab === "sale"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Dane sprzedaży
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${
                  activeTab === "documents"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Dokumenty
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("financial")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${
                  activeTab === "financial"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Dane finansowe
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${
                  activeTab === "notes"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Notatki
              </button>
            </div>

            <div className="p-6 space-y-6">
              {activeTab === "sale" && (
                <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Dane sprzedaży
                  </h3>
                  <p className="text-sm text-slate-500">
                    Uzupełnij podstawowe dane sprzedaży ręcznie. Później te pola będą mogły zaczytać się z oferty.
                  </p>
                </div>

                {!editingSaleData ? (
                  <button
                    type="button"
                    onClick={() => setEditingSaleData(true)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white font-semibold"
                  >
                    Edytuj dane sprzedaży
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setContractValueInput(
                          sale.contract_value !== null && sale.contract_value !== undefined
                            ? String(sale.contract_value)
                            : ""
                        );
                        setMarginValueInput(
                          sale.margin_value !== null && sale.margin_value !== undefined
                            ? String(sale.margin_value)
                            : ""
                        );
                        setSoldItemsInput(sale.sold_items || "");
                        setEditingSaleData(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      Anuluj
                    </button>

                    <button
                      type="button"
                      onClick={saveSaleData}
                      disabled={savingSaleData}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold"
                    >
                      {savingSaleData ? "Zapisywanie..." : "Zapisz"}
                    </button>
                  </div>
                )}
              </div>

              {!editingSaleData ? (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                          Dane umowy
                        </p>
                        <p className="mt-2 font-mono text-xl font-black text-emerald-950">
                          {contractNumber}
                        </p>
                      </div>

                      <div className="text-right text-sm text-emerald-900">
                        <p>
                          <span className="font-bold">Podpis:</span> {saleCustomerData.contract_place || "Brak"}, {formatDateOnly(saleCustomerData.contract_date)}
                        </p>
                        <p className="mt-1">
                          <span className="font-bold">Zaliczka do:</span> {formatDateOnly(saleCustomerData.deposit_due_date)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase font-semibold text-emerald-700/70 mb-1">
                          Rodzaj własności
                        </p>
                        <p className="font-semibold text-emerald-950">{ownershipLabel}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase font-semibold text-emerald-700/70 mb-1">
                          Wizyta umówiona
                        </p>
                        <p className="font-semibold text-emerald-950">{visitLabel}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase font-semibold text-emerald-700/70 mb-1">
                          Wariant realizacji
                        </p>
                        <p className="font-semibold text-emerald-950">{realizationVariantLabel}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase font-semibold text-emerald-700/70 mb-1">
                          Zaliczka
                        </p>
                        <p className="font-semibold text-emerald-950">
                          {formatMoney(sale.deposit_amount)}
                        </p>
                      </div>
                    </div>

                    {saleCustomerData.ownership_type === "co_owner" && (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-white/70 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                          Klient 2 / współwłaściciel
                        </p>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                              Imię i nazwisko
                            </p>
                            <p className="font-semibold text-slate-900">
                              {saleCustomerData.second_client_name || "Brak"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                              PESEL
                            </p>
                            <p className="font-semibold text-slate-900">
                              {saleCustomerData.second_client_pesel || "Brak"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                      Data sprzedaży
                    </p>

                    <p className="font-semibold text-slate-900">
                      {new Date(sale.sale_date).toLocaleString("pl-PL")}
                    </p>
                  </div>

                  {contractPriceRows.hasAnyValue && (
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-slate-950">
                            Rozpiska cen do umowy i księgowości
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Dane zapisane historycznie w sprzedaży. Używane do §3 umowy PDF.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {contractPriceRows.rows.map((row) => (
                          <div
                            key={row.label}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="text-sm font-black leading-snug text-slate-950">
                              {row.label}
                            </p>

                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                  Netto po rabacie
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-900">
                                  {formatMoney(row.netAfterDiscount)}
                                </p>
                              </div>

                              <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                  Brutto przed rabatem
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-900">
                                  {formatMoney(row.beforeDiscount)}
                                </p>
                              </div>

                              <div className="rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
                                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                                  Brutto po rabacie
                                </p>
                                <p className="mt-1 text-sm font-black text-emerald-800">
                                  {formatMoney(row.afterDiscount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <p className="text-sm font-black text-emerald-950">Suma</p>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-white/80 px-3 py-3 ring-1 ring-emerald-100">
                              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700/70">
                                Netto po rabacie
                              </p>
                              <p className="mt-1 text-sm font-black text-emerald-950">
                                {formatMoney(contractPriceRows.totalNetAfterDiscount)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white/80 px-3 py-3 ring-1 ring-emerald-100">
                              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700/70">
                                Brutto przed rabatem
                              </p>
                              <p className="mt-1 text-sm font-black text-emerald-950">
                                {formatMoney(contractPriceRows.totalBeforeDiscount)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-emerald-200">
                              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                                Brutto po rabacie
                              </p>
                              <p className="mt-1 text-base font-black text-emerald-700">
                                {formatMoney(contractPriceRows.totalAfterDiscount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                      Sprzedawca
                    </p>

                   <p className="font-semibold text-slate-900">
  {sellerProfile?.display_name ||
    sellerProfile?.email ||
    (sale.seller_id
      ? `Seller: ${sale.seller_id.slice(0, 8)}`
      : "Brak sprzedawcy")}
</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                      Wartość umowy
                    </p>

                    <p className="font-semibold text-slate-900">
                      {sale.contract_value
                        ? `${sale.contract_value.toLocaleString("pl-PL")} zł`
                        : "Brak danych"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                      Sprzedane produkty/usługi
                    </p>

                    {soldItemsList.length > 0 ? (
                      <div className="space-y-2">
                        {soldItemsList.map((item, index) => (
                          <div
                            key={`${item}-${index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-800">Brak danych</p>
                    )}
                  </div>

                  {currentUserRole !== "cc" && (
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                        Marża doradcy
                      </p>

                      <p className="text-slate-800">
                        {sale.margin_value
                          ? `${sale.margin_value.toLocaleString("pl-PL")} zł`
                          : "Brak danych"}
                      </p>
                    </div>
                  )}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                      Wartość umowy
                    </label>

                    <input
                      value={contractValueInput}
                      onChange={(e) => setContractValueInput(e.target.value)}
                      placeholder="np. 48500"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                    />
                  </div>

                  {currentUserRole !== "cc" && (
                    <div>
                      <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                        Marża doradcy
                      </label>

                      <input
                        value={marginValueInput}
                        onChange={(e) => setMarginValueInput(e.target.value)}
                        placeholder="np. 3500"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                      Sprzedane produkty/usługi
                    </label>

                    <textarea
                      value={soldItemsInput}
                      onChange={(e) => setSoldItemsInput(e.target.value)}
                      placeholder="np. PV 9,9 kWp + magazyn energii 14,33 kWh + falownik hybrydowy"
                      rows={4}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white resize-none"
                    />
                  </div>
                </div>
              )}
                </>
              )}

              {activeTab === "documents" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Dokumenty sprzedaży
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Dodaj skany umów, załączniki i inne dokumenty związane ze sprzedażą.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Typ dokumentu
                      </span>
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        {DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Opis dokumentu / komentarz opcjonalny
                      </span>
                      <input
                        value={documentDescription}
                        onChange={(e) => setDocumentDescription(e.target.value)}
                        placeholder="Opcjonalnie, np. skan podpisanej umowy"
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Plik
                      </span>
                      <input
                        type="file"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                      />
                    </label>

                    {documentStatus && (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        {documentStatus}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={uploadSaleDocument}
                      disabled={uploadingDocument}
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {uploadingDocument ? "Wysyłanie..." : "Dodaj dokument"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {documents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                        Brak dokumentów dla tej sprzedaży.
                      </div>
                    ) : (
                      documents.map((document) => (
                        <div
                          key={document.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                {document.document_type && (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                    {document.document_type}
                                  </span>
                                )}

                                <p className="font-bold text-slate-900">
                                  {document.description}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-slate-500">
                                {document.file_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Dodano: {new Date(document.created_at).toLocaleString("pl-PL")}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  const { data, error } = await supabase.storage
                                    .from("sale-documents")
                                    .createSignedUrl(document.file_path, 60);

                                  if (error || !data?.signedUrl) {
                                    alert("Nie udało się otworzyć dokumentu.");
                                    return;
                                  }

                                  window.open(data.signedUrl, "_blank");
                                }}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Otwórz
                              </button>

                              {canDeleteDocuments && (
                                <button
                                  type="button"
                                  onClick={() => deleteSaleDocument(document)}
                                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Usuń
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "financial" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Dane finansowe
                    </h3>

                    <p className="text-sm text-slate-500 mt-1">
                      Dane zapisane z oferty źródłowej.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                        Wartość umowy
                      </p>

                      <p className="text-xl font-black text-slate-950">
                        {formatMoney(sale.contract_value)}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl border p-4 ${
                        currentUserRole === "cc"
                          ? "border-red-200 bg-red-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <p
                        className={`text-xs uppercase font-semibold mb-1 ${
                          currentUserRole === "cc"
                            ? "text-red-700"
                            : "text-emerald-700"
                        }`}
                      >
                        Prowizja handlowca
                      </p>

                      <p
                        className={`text-xl font-black ${
                          currentUserRole === "cc"
                            ? "text-red-950"
                            : "text-emerald-950"
                        }`}
                      >
                        {currentUserRole === "cc"
                          ? "Odmowa dostępu"
                          : formatMoney(sale.margin_value)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                        Zaliczka
                      </p>

                      <p className="text-xl font-black text-slate-950">
                        {formatMoney(sale.deposit_amount)}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {sale.payment_method || "Brak formy płatności"}
                      </p>
                    </div>
                  </div>

                  {currentUserRole !== "cc" ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-black text-slate-900">
                          Więcej danych finansowych
                        </p>

                        <p className="text-sm font-black text-emerald-700">
                          {canSeeFullFinancials ? formatMoney(companyMargin) : ""}
                        </p>
                      </div>

                      {financialBreakdown
                        .filter((item: any) => canShowFinancialBreakdownItem(item.label))
                        .length === 0 ? (
                        <div className="px-4 py-4 text-sm text-amber-700 bg-amber-50">
                          Brak zapisanej rozpiski kosztów w ofercie.
                        </div>
                      ) : (
                        financialBreakdown
                          .filter((item: any) => canShowFinancialBreakdownItem(item.label))
                          .map((item: any, index: number) => (
                            <div
                              key={`${item.label}-${index}`}
                              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                                index !== financialBreakdown.filter((item: any) => canShowFinancialBreakdownItem(item.label)).length - 1
                                  ? "border-b border-slate-100"
                                  : ""
                              }`}
                            >
                              <p className="text-sm text-slate-700">
                                {item.label}
                              </p>

                              <p className="text-sm font-semibold text-slate-950">
                                {formatMoney(item.value)}
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Notatki realizacyjne
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Notatki zapisane tutaj trafiają również na kartę klienta.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Treść notatki
                      </span>
                      <textarea
                        value={newSaleNote}
                        onChange={(e) => setNewSaleNote(e.target.value)}
                        rows={4}
                        placeholder="np. Klient dosłał podpisaną umowę, czekamy na zaksięgowanie zaliczki."
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none resize-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    {saleNoteStatus && (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        {saleNoteStatus}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={addSaleNote}
                      disabled={savingSaleNote}
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {savingSaleNote ? "Zapisywanie..." : "Dodaj notatkę"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {saleNotes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                        Brak notatek dla tej sprzedaży.
                      </div>
                    ) : (
                      saleNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {note.content}
                          </p>
                          <p className="mt-3 text-xs text-slate-400">
                            Dodano: {new Date(note.created_at).toLocaleString("pl-PL")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6 2xl:sticky 2xl:top-6 2xl:self-start">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Dane klienta
              </h3>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                    Telefon
                  </p>

                  <p className="text-slate-900">
                    {client?.phone || "Brak"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                    Email
                  </p>

                  <p className="text-slate-900">
                    {client?.email || "Brak"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                    Miasto
                  </p>

                  <p className="text-slate-900">
                    {client?.city || "Brak"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                    Adres klienta
                  </p>

                  <p className="whitespace-pre-wrap text-slate-900">
                    {contractAddress}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                    Adres montażu
                  </p>

                  <p className="whitespace-pre-wrap text-slate-900">
                    {installationAddress}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
