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
  "Oczekuje na sprawdzenie dokumentów",
  "Oczekiwanie na zaliczkę",
  "Oczekuje na umówienie montażu",
  "Montaż umówiony",
  "W trakcie montażu",
  "Montaż zakończony - oczekiwanie na pełną wpłatę",
  "Zakończony - procesowanie ZM",
  "Zakończony - ZM wysłane",
  "Zakończony - procesowanie dotacji",
  "Zakończony",
  "Anulowana",
  "Odstępienie - utrzymanie",
  "Utrzymanie - nieuratowana",
  "Utrzymanie - uratowana",
];

const DOCUMENT_GROUPS = [
  {
    key: "contracts",
    title: "Umowa wraz z załącznikami",
    description:
      "Umowa, załączniki do umowy, dokumenty podpisowe, potwierdzenia wpłat i dokumenty kredytowe.",
    acceptedTypes: [
      "Umowa",
      "Umowa i załączniki",
      "Umowa wraz z załącznikami",
      "Potwierdzenie wpłaty",
      "Umowa kredytowa",
    ],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 50,
  },
  {
    key: "technical_audit",
    title: "Audyt techniczny",
    description:
      "Audyt techniczny, protokoły, schematy, karty techniczne i dokumentacja techniczna montażu.",
    acceptedTypes: ["Audyt techniczny", "Dokumenty techniczne", "Protokół montażu"],
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 20,
  },
  {
    key: "photos",
    title: "Zdjęcia",
    description:
      "Zdjęcia z audytu, montażu, miejsca instalacji i dokumentacji fotograficznej.",
    acceptedTypes: ["Zdjęcia", "Zdjęcie", "Galeria zdjęć"],
    accept: "image/*",
    maxSizeMb: 30,
  },
  {
    key: "osd_invoice",
    title: "Faktura OSD",
    description:
      "Faktura OSD i dokumenty związane z operatorem sieci dystrybucyjnej.",
    acceptedTypes: ["Faktura OSD"],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 15,
  },
  {
    key: "zm_power_of_attorney",
    title: "Pełnomocnictwo ZM",
    description:
      "Pełnomocnictwo ZM oraz dokumenty do zgłoszenia mikroinstalacji.",
    acceptedTypes: ["Pełnomocnictwo ZM"],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 15,
  },
  {
    key: "ppoz",
    title: "PPOŻ",
    description:
      "Dokumenty PPOŻ, uzgodnienia i pełnomocnictwa związane ze strażą pożarną.",
    acceptedTypes: ["PPOŻ", "PPOZ", "Pełnomocnictwo do straży pożarnej"],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 15,
  },
  {
    key: "pme_grant",
    title: "Dotacja PME",
    description:
      "Dokumenty dotacyjne programu PME i materiały potrzebne do rozliczenia dotacji.",
    acceptedTypes: ["Dotacja PME", "Dokumenty związane z dotacją"],
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 25,
  },
  {
    key: "other",
    title: "Inne",
    description:
      "Pozostałe dokumenty i pliki, których nie da się jednoznacznie przypisać do wcześniejszych kontenerów.",
    acceptedTypes: ["Inne"],
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 50,
  },
] as const;


type DocumentGroupKey = (typeof DOCUMENT_GROUPS)[number]["key"];

type DocumentContainerStatus = "draft" | "submitted" | "approved" | "rejected";

type SaleDocumentContainer = {
  id: string;
  sale_id: string;
  container_key: DocumentGroupKey;
  status: DocumentContainerStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};


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

  const [accessDenied, setAccessDenied] = useState(false);

  const [documents, setDocuments] = useState<SaleDocument[]>([]);
  const [documentContainers, setDocumentContainers] = useState<SaleDocumentContainer[]>([]);
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentType, setDocumentType] = useState("Umowa wraz z załącznikami");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentGroupKey, setDocumentGroupKey] = useState<DocumentGroupKey>("contracts");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentPreviewUrls, setDocumentPreviewUrls] = useState<Record<string, string>>({});
  const [photoPreviewDocuments, setPhotoPreviewDocuments] = useState<SaleDocument[]>([]);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState<number | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [submittingDocuments, setSubmittingDocuments] = useState(false);
  const [reviewingDocumentContainerKey, setReviewingDocumentContainerKey] = useState<DocumentGroupKey | null>(null);
  const [documentStatus, setDocumentStatus] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [saleNotes, setSaleNotes] = useState<SaleNote[]>([]);
  const [newSaleNote, setNewSaleNote] = useState("");
  const [savingSaleNote, setSavingSaleNote] = useState(false);
  const [saleNoteStatus, setSaleNoteStatus] = useState("");

  useEffect(() => {
    loadSale();
  }, [saleId]);

  useEffect(() => {
    async function loadPhotoPreviews() {
      const photoDocuments = documents.filter(
        (document) => getDocumentGroupKey(document) === "photos"
      );

      if (photoDocuments.length === 0) {
        setDocumentPreviewUrls({});
        return;
      }

      const entries = await Promise.all(
        photoDocuments.map(async (document) => {
          const { data, error } = await supabase.storage
            .from("sale-documents")
            .createSignedUrl(document.file_path, 60 * 10);

          if (error || !data?.signedUrl) {
            return [document.id, ""] as const;
          }

          return [document.id, data.signedUrl] as const;
        })
      );

      setDocumentPreviewUrls(Object.fromEntries(entries));
    }

    loadPhotoPreviews();
  }, [documents]);

  async function loadSale() {
    setLoading(true);
    setAccessDenied(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let resolvedRole: UserRole = null;

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

      resolvedRole = (currentProfileData?.role || null) as UserRole;

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
      .maybeSingle();

    if (error) {
      console.error("Błąd ładowania sprzedaży:", error);
      setLoading(false);
      return;
    }

    if (!saleData) {
      setSale(null);
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const normalizedRole = String(resolvedRole || "seller").toLowerCase();
    let canOpenSale = ["admin", "owner", "cc"].includes(normalizedRole);

    if (!canOpenSale && user && saleData.seller_id === user.id) {
      canOpenSale = true;
    }

    if (!canOpenSale && user && normalizedRole === "manager") {
      const { data: teamMembers, error: teamError } = await supabase
        .from("profiles")
        .select("id")
        .eq("manager_id", user.id);

      if (teamError) {
        console.error("Błąd ładowania zespołu managera przy dostępie do sprzedaży:", teamError);
      }

      const teamUserIds = (teamMembers || []).map((member: { id: string }) => member.id);
      canOpenSale = !!saleData.seller_id && teamUserIds.includes(saleData.seller_id);
    }

    if (!canOpenSale) {
      setSale(null);
      setClient(null);
      setSellerProfile(null);
      setDocuments([]);
      setDocumentContainers([]);
      setSaleNotes([]);
      setAccessDenied(true);
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

    const { data: documentContainersData, error: documentContainersError } = await supabase
      .from("sale_document_containers")
      .select("*")
      .eq("sale_id", saleData.id);

    if (documentContainersError) {
      console.error("Błąd ładowania statusów kontenerów dokumentów:", documentContainersError);
    }

    setDocumentContainers((documentContainersData as SaleDocumentContainer[]) || []);

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

      const { data: updatedSale, error } = await supabase.rpc("update_sale_status", {
        p_sale_id: sale.id,
        p_status: status,
      });

      if (error) {
        console.error("Błąd zmiany statusu sprzedaży:", error);
        alert(`Nie udało się zmienić statusu sprzedaży: ${error.message}`);
        return;
      }

      setSale((updatedSale as Sale) || {
        ...sale,
        status,
      });
    } catch (error) {
      console.error("Nieoczekiwany błąd zmiany statusu:", error);
      alert("Wystąpił nieoczekiwany błąd podczas zmiany statusu sprzedaży.");
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
    const filesToUpload = documentFiles.length > 0
      ? documentFiles
      : documentFile
        ? [documentFile]
        : [];

    if (!sale || filesToUpload.length === 0 || !currentUserId) {
      setDocumentStatus("Wybierz co najmniej jeden plik.");
      return;
    }

    const isAssignedSeller = Boolean(sale.seller_id && sale.seller_id === currentUserId);
    const isAdmin = currentUserRole === "admin";

    if (!isAdmin && !isAssignedSeller) {
      setDocumentStatus("Dokumenty może wrzucać tylko osoba przypisana jako sprzedawca na tej sprzedaży albo admin.");
      return;
    }

    const selectedGroup =
      DOCUMENT_GROUPS.find((group) => group.key === documentGroupKey) ||
      DOCUMENT_GROUPS.find((group) => group.title === documentType) ||
      DOCUMENT_GROUPS[0];

    const selectedFilesBytes = filesToUpload.reduce((sum, file) => sum + file.size, 0);
    const usedBytes = getDocumentGroupUsedBytes(selectedGroup.key);
    const maxBytes = selectedGroup.maxSizeMb * 1024 * 1024;

    if (usedBytes + selectedFilesBytes > maxBytes) {
      setDocumentStatus(
        `Limit kontenera "${selectedGroup.title}" to ${selectedGroup.maxSizeMb} MB. Usuń część plików albo przenieś je do innego kontenera.`
      );
      return;
    }

    try {
      setUploadingDocument(true);
      setDocumentStatus("");

      const insertedDocuments: SaleDocument[] = [];

      for (const file of filesToUpload) {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${sale.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("sale-documents")
          .upload(filePath, file, {
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
            description: documentDescription.trim() || selectedGroup.title,
            document_type: selectedGroup.title,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || null,
            file_size: file.size,
          })
          .select("*")
          .single();

        if (insertError || !insertedDocument) {
          console.error("Błąd zapisu metadanych dokumentu:", insertError);
          setDocumentStatus(insertError?.message || "Plik wysłany, ale nie zapisano danych dokumentu.");
          return;
        }

        insertedDocuments.push(insertedDocument as SaleDocument);
      }

      setDocuments((current) => [...insertedDocuments, ...current]);
      setDocumentDescription("");
      setDocumentType("Umowa wraz z załącznikami");
      setDocumentFile(null);
      setDocumentGroupKey(selectedGroup.key);
      setDocumentFiles([]);
      setDocumentStatus(
        insertedDocuments.length === 1
          ? "Dokument został dodany."
          : `Dodano dokumenty: ${insertedDocuments.length}.`
      );
    } catch (error) {
      console.error("Nieoczekiwany błąd uploadu dokumentu:", error);
      setDocumentStatus("Wystąpił nieoczekiwany błąd podczas dodawania dokumentu.");
    } finally {
      setUploadingDocument(false);
    }
  }


  async function submitDocumentContainersForReview() {
    if (!sale) return;

    const confirmed = window.confirm(
      "Czy na pewno wysłać dokumenty tej sprzedaży do sprawdzenia? Po wysłaniu część akcji może zostać zablokowana."
    );

    if (!confirmed) return;

    try {
      setSubmittingDocuments(true);
      setDocumentStatus("");

      const { error } = await supabase.rpc("submit_sale_document_containers", {
        p_sale_id: sale.id,
      });

      if (error) {
        console.error("Błąd wysyłania dokumentów do sprawdzenia:", error);
        setDocumentStatus(error.message || "Nie udało się wysłać dokumentów do sprawdzenia.");
        return;
      }

      const { data: refreshedContainers, error: refreshError } = await supabase
        .from("sale_document_containers")
        .select("*")
        .eq("sale_id", sale.id);

      if (refreshError) {
        console.error("Błąd odświeżania statusów kontenerów:", refreshError);
      }

      setDocumentContainers((refreshedContainers as SaleDocumentContainer[]) || []);
      setDocumentStatus("Dokumenty zostały wysłane do sprawdzenia.");
    } catch (error) {
      console.error("Nieoczekiwany błąd wysyłania dokumentów do sprawdzenia:", error);
      setDocumentStatus("Wystąpił nieoczekiwany błąd podczas wysyłania dokumentów do sprawdzenia.");
    } finally {
      setSubmittingDocuments(false);
    }
  }

  async function reviewDocumentContainer(groupKey: DocumentGroupKey, nextStatus: "approved" | "rejected") {
    if (!sale) return;

    const group = DOCUMENT_GROUPS.find((item) => item.key === groupKey);
    const groupTitle = group?.title || "kontener";
    const actionLabel = nextStatus === "approved" ? "zatwierdzić" : "odrzucić";

    const confirmed = window.confirm(
      `Czy na pewno chcesz ${actionLabel} kontener "${groupTitle}"?`
    );

    if (!confirmed) return;

    try {
      setReviewingDocumentContainerKey(groupKey);
      setDocumentStatus("");

      const { error } = await supabase.rpc("review_sale_document_container", {
        p_sale_id: sale.id,
        p_container_key: groupKey,
        p_status: nextStatus,
        p_review_note: null,
      });

      if (error) {
        console.error("Błąd weryfikacji kontenera dokumentów:", error);
        setDocumentStatus(error.message || "Nie udało się zmienić statusu kontenera dokumentów.");
        return;
      }

      const { data: refreshedContainers, error: refreshError } = await supabase
        .from("sale_document_containers")
        .select("*")
        .eq("sale_id", sale.id);

      if (refreshError) {
        console.error("Błąd odświeżania statusów kontenerów:", refreshError);
      }

      setDocumentContainers((refreshedContainers as SaleDocumentContainer[]) || []);
      setDocumentStatus(
        nextStatus === "approved"
          ? `Kontener "${groupTitle}" został zatwierdzony.`
          : `Kontener "${groupTitle}" został odrzucony.`
      );
    } catch (error) {
      console.error("Nieoczekiwany błąd weryfikacji kontenera dokumentów:", error);
      setDocumentStatus("Wystąpił nieoczekiwany błąd podczas weryfikacji kontenera dokumentów.");
    } finally {
      setReviewingDocumentContainerKey(null);
    }
  }

  function addDocumentFiles(files: FileList | null, groupKey?: DocumentGroupKey) {
    const nextFiles = Array.from(files || []);

    if (nextFiles.length === 0) return;

    const selectedGroup = groupKey
      ? DOCUMENT_GROUPS.find((group) => group.key === groupKey)
      : DOCUMENT_GROUPS.find((group) => group.key === documentGroupKey);

    if (!selectedGroup) return;

    const shouldReplaceQueue = selectedGroup.key !== documentGroupKey;
    const queuedFiles = shouldReplaceQueue ? nextFiles : [...documentFiles, ...nextFiles];
    const queuedBytes = queuedFiles.reduce((sum, file) => sum + file.size, 0);
    const usedBytes = getDocumentGroupUsedBytes(selectedGroup.key);
    const maxBytes = selectedGroup.maxSizeMb * 1024 * 1024;

    setDocumentGroupKey(selectedGroup.key);
    setDocumentType(selectedGroup.title);

    if (usedBytes + queuedBytes > maxBytes) {
      setDocumentStatus(
        `Limit kontenera "${selectedGroup.title}" to ${selectedGroup.maxSizeMb} MB. Usuń część plików albo przenieś je do innego kontenera.`
      );
      return;
    }

    setDocumentStatus("");
    setDocumentFile(queuedFiles[0] || null);
    setDocumentFiles(queuedFiles);
  }

  function removeDocumentFile(indexToRemove: number) {
    setDocumentFiles((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  }

  function getDocumentGroupUsedBytes(groupKey: DocumentGroupKey) {
    return documents
      .filter((document) => getDocumentGroupKey(document) === groupKey)
      .reduce((sum, document) => sum + (document.file_size || 0), 0);
  }

  function getDocumentContainer(groupKey: DocumentGroupKey) {
    return documentContainers.find((container) => container.container_key === groupKey) || null;
  }

  function getDocumentContainerStatus(groupKey: DocumentGroupKey): DocumentContainerStatus {
    return getDocumentContainer(groupKey)?.status || "draft";
  }

  function getDocumentContainerStatusLabel(status: DocumentContainerStatus) {
    if (status === "approved") return "Zatwierdzone";
    if (status === "rejected") return "Odrzucone";
    if (status === "submitted") return "Do sprawdzenia";
    return "Robocze";
  }

  function getDocumentContainerStatusClass(status: DocumentContainerStatus) {
    if (status === "approved") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    }

    if (status === "rejected") {
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
    }

    if (status === "submitted") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    }

    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }

  function getDocumentContainerSectionClass(status: DocumentContainerStatus) {
    const baseClass = "rounded-3xl border bg-white p-5 dark:bg-slate-900";

    if (status === "approved") {
      return `${baseClass} border-emerald-300 dark:border-emerald-500/50`;
    }

    if (status === "rejected") {
      return `${baseClass} border-red-300 dark:border-red-500/50`;
    }

    if (status === "submitted") {
      return `${baseClass} border-amber-300 dark:border-amber-500/50`;
    }

    return `${baseClass} border-slate-200 dark:border-slate-700`;
  }

  function canUploadToDocumentContainer(groupKey: DocumentGroupKey) {
    const containerStatus = getDocumentContainerStatus(groupKey);

    if (currentUserRole === "admin") return true;
    if (!canUploadDocuments) return false;

    return containerStatus !== "approved";
  }

  function canDeleteSaleDocument(document: SaleDocument) {
    const containerStatus = getDocumentContainerStatus(getDocumentGroupKey(document));

    if (currentUserRole === "admin" || currentUserRole === "owner") return true;
    if (!canUploadDocuments) return false;

    return containerStatus === "draft";
  }

  function getDocumentGroupKey(document: SaleDocument): DocumentGroupKey {
    const normalizedType = String(document.document_type || "").trim().toLowerCase();
    const normalizedName = String(document.file_name || "").trim().toLowerCase();
    const normalizedFileType = String(document.file_type || "").trim().toLowerCase();
    const searchableText = `${normalizedType} ${normalizedName}`;

    if (
      normalizedFileType.startsWith("image/") ||
      searchableText.includes("zdję") ||
      searchableText.includes("zdjec") ||
      normalizedName.match(/\.(jpg|jpeg|png|webp|heic)$/)
    ) {
      return "photos";
    }

    if (
      searchableText.includes("ppoż") ||
      searchableText.includes("ppoz") ||
      searchableText.includes("straż") ||
      searchableText.includes("straz") ||
      searchableText.includes("pożar") ||
      searchableText.includes("pozar")
    ) {
      return "ppoz";
    }

    if (
      searchableText.includes("faktura osd") ||
      searchableText.includes("osd")
    ) {
      return "osd_invoice";
    }

    if (
      searchableText.includes("pełnomocnictwo zm") ||
      searchableText.includes("pelnomocnictwo zm") ||
      searchableText.includes("zgłoszenie mikro") ||
      searchableText.includes("zgloszenie mikro") ||
      searchableText.includes(" zm ")
    ) {
      return "zm_power_of_attorney";
    }

    if (
      searchableText.includes("dotac") ||
      searchableText.includes("pme")
    ) {
      return "pme_grant";
    }

    if (
      searchableText.includes("audyt") ||
      searchableText.includes("techn") ||
      searchableText.includes("protok") ||
      searchableText.includes("schemat")
    ) {
      return "technical_audit";
    }

    return "other";
  }

  async function getSaleDocumentSignedUrl(document: SaleDocument) {
    const { data, error } = await supabase.storage
      .from("sale-documents")
      .createSignedUrl(document.file_path, 60);

    if (error || !data?.signedUrl) {
      alert("Nie udało się otworzyć dokumentu.");
      return null;
    }

    return data.signedUrl;
  }

  async function openSaleDocument(document: SaleDocument) {
    const signedUrl = await getSaleDocumentSignedUrl(document);

    if (!signedUrl) return;

    window.open(signedUrl, "_blank");
  }

  async function openPhotoPreview(photoDocuments: SaleDocument[], index: number) {
    const document = photoDocuments[index];
    if (!document) return;

    const signedUrl = await getSaleDocumentSignedUrl(document);
    if (!signedUrl) return;

    setPhotoPreviewDocuments(photoDocuments);
    setPhotoPreviewIndex(index);
    setPhotoPreviewUrl(signedUrl);
  }

  async function movePhotoPreview(direction: "previous" | "next") {
    if (photoPreviewIndex === null || photoPreviewDocuments.length === 0) return;

    const nextIndex = direction === "previous"
      ? (photoPreviewIndex - 1 + photoPreviewDocuments.length) % photoPreviewDocuments.length
      : (photoPreviewIndex + 1) % photoPreviewDocuments.length;

    const document = photoPreviewDocuments[nextIndex];
    if (!document) return;

    const signedUrl = await getSaleDocumentSignedUrl(document);
    if (!signedUrl) return;

    setPhotoPreviewIndex(nextIndex);
    setPhotoPreviewUrl(signedUrl);
  }

  async function deleteSaleDocument(document: SaleDocument) {
    if (!canDeleteSaleDocument(document)) return;

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
      const { error } = await supabase.rpc("delete_sale", {
        p_sale_id: sale.id,
      });

      if (error) {
        console.error("Błąd usuwania sprzedaży:", error);
        alert(`Nie udało się usunąć sprzedaży: ${error.message}`);
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
  if (accessDenied) {
    return (
      <main>
        <div className="max-w-3xl mx-auto bg-white border border-red-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h1 className="text-2xl font-bold text-red-700">
            Brak dostępu do sprzedaży
          </h1>

          <p className="text-slate-600 break-all">
            Nie masz uprawnień do otwarcia tej karty sprzedaży.
          </p>
        </div>
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
  const canUploadDocuments =
    currentUserRole === "admin" || Boolean(sale.seller_id && sale.seller_id === currentUserId);
  const canDeleteDocuments =
    currentUserRole === "admin" || currentUserRole === "owner" || canUploadDocuments;
  const canReviewDocuments =
    currentUserRole === "admin" || (currentUserRole === "owner" && sale.seller_id !== currentUserId);
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
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${activeTab === "sale"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
                  }`}
              >
                Dane sprzedaży
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${activeTab === "documents"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
                  }`}
              >
                Dokumenty
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("financial")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${activeTab === "financial"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
                  }`}
              >
                Dane finansowe
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap ${activeTab === "notes"
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
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Dokumenty sprzedaży
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Dokumenty są pogrupowane w kontenery. Istniejące pliki zostają zachowane i są przypisane automatycznie po dotychczasowym typie dokumentu.
                      </p>
                    </div>

                    {canUploadDocuments && (
                      <button
                        type="button"
                        onClick={submitDocumentContainersForReview}
                        disabled={submittingDocuments || documents.length === 0}
                        className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:text-slate-500 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                      >
                        {submittingDocuments ? "Wysyłanie..." : "Zatwierdź dokumenty do sprawdzenia"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {DOCUMENT_GROUPS.map((group) => {
                      const groupDocuments = documents.filter(
                        (document) => getDocumentGroupKey(document) === group.key
                      );
                      const containerStatus = getDocumentContainerStatus(group.key);
                      const canUploadToContainer = canUploadToDocumentContainer(group.key);

                      return (
                        <section
                          key={group.key}
                          className={getDocumentContainerSectionClass(containerStatus)}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h4 className="text-base font-black text-slate-950 dark:text-slate-100">
                                {group.title}
                              </h4>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {group.description}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${getDocumentContainerStatusClass(containerStatus)}`}>
                                {getDocumentContainerStatusLabel(containerStatus)}
                              </span>
                              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {groupDocuments.length}
                              </span>
                              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Limit: {group.maxSizeMb} MB
                              </span>
                            </div>

                            {canReviewDocuments && groupDocuments.length > 0 && containerStatus !== "rejected" && (
                              <div className="flex shrink-0 items-center gap-2">
                                {containerStatus !== "approved" && (
                                  <button
                                    type="button"
                                    onClick={() => reviewDocumentContainer(group.key, "approved")}
                                    disabled={reviewingDocumentContainerKey === group.key}
                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                                    title="Zatwierdź kontener"
                                  >
                                    ✅
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => reviewDocumentContainer(group.key, "rejected")}
                                  disabled={reviewingDocumentContainerKey === group.key}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                                  title="Odrzuć kontener"
                                >
                                  ❌
                                </button>
                              </div>
                            )}
                          </div>

                          {canUploadToContainer ? (
                            <>
                              <label className="mt-4 block">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  Opis / komentarz do plików w tym kontenerze
                                </span>
                                <input
                                  value={documentGroupKey === group.key ? documentDescription : ""}
                                  onFocus={() => {
                                    setDocumentGroupKey(group.key);
                                    setDocumentType(group.title);
                                  }}
                                  onChange={(event) => {
                                    setDocumentGroupKey(group.key);
                                    setDocumentType(group.title);
                                    setDocumentDescription(event.target.value);
                                  }}
                                  placeholder="Opcjonalnie, np. skan podpisanej umowy"
                                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                                />
                              </label>

                              <label
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  addDocumentFiles(event.dataTransfer.files, group.key);
                                }}
                                className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-950/20"
                              >
                                <input
                                  type="file"
                                  multiple
                                  accept={group.accept}
                                  onChange={(event) => addDocumentFiles(event.target.files, group.key)}
                                  className="sr-only"
                                />
                                <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                                  Przeciągnij i upuść pliki albo kliknij, aby wybrać
                                </span>
                                <span className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Pliki trafią do kontenera: {group.title}
                                </span>
                              </label>
                            </>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                              {containerStatus === "approved" && currentUserRole !== "admin"
                                ? "Ten kontener został zatwierdzony. Dodawanie kolejnych plików jest zablokowane."
                                : "Dokumenty może wrzucać tylko osoba przypisana jako sprzedawca na tej sprzedaży albo admin."}
                            </div>
                          )}

                          {documentGroupKey === group.key && documentFiles.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-black text-emerald-950 dark:text-emerald-100">
                                    Pliki gotowe do wysłania: {documentFiles.length}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    Kontener: {group.title}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={uploadSaleDocument}
                                  disabled={uploadingDocument}
                                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                >
                                  {uploadingDocument ? "Wysyłanie..." : "Wyślij wybrane pliki"}
                                </button>
                              </div>

                              <div className="mt-4 space-y-2">
                                {documentFiles.map((file, index) => (
                                  <div
                                    key={`${file.name}-${index}`}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm dark:bg-slate-950"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                        {file.name}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {(file.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => removeDocumentFile(index)}
                                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      Usuń
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {documentGroupKey === group.key && documentStatus && (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                              {documentStatus}
                            </div>
                          )}

                          {group.key === "photos" ? (
                            <div className="mt-4">
                              {groupDocuments.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                  Brak zdjęć w tym kontenerze.
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                                  {groupDocuments.map((document, index) => (
                                    <button
                                      key={document.id}
                                      type="button"
                                      onClick={() => openPhotoPreview(groupDocuments, index)}
                                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-500/60"
                                    >
                                      <div className="aspect-square bg-slate-200 dark:bg-slate-800">
                                        {documentPreviewUrls[document.id] ? (
                                          <img
                                            src={documentPreviewUrls[document.id]}
                                            alt={document.description || document.file_name}
                                            className="h-full w-full object-cover transition group-hover:scale-105"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                                            Zdjęcie
                                          </div>
                                        )}
                                      </div>

                                      <div className="p-2">
                                        <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                                          {document.description || document.file_name}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                                          {document.file_name}
                                        </p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-4">
                              {groupDocuments.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                  Brak plików w tym kontenerze.
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-950">
                                  {groupDocuments.map((document) => (
                                    <div
                                      key={document.id}
                                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openSaleDocument(document)}
                                        className="min-w-0 text-left text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                      >
                                        <span className="mr-2">📎</span>
                                        <span className="break-words">
                                          {document.description || document.file_name}
                                        </span>
                                      </button>

                                      <div className="flex shrink-0 items-center gap-2">
                                        {canDeleteSaleDocument(document) && (
                                          <button
                                            type="button"
                                            onClick={() => deleteSaleDocument(document)}
                                            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                                          >
                                            Usuń
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "financial" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Dane finansowe
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Zakres danych finansowych zależy od roli użytkownika.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Wartość umowy
                      </p>
                      <p className="mt-2 text-xl font-black text-slate-950">
                        {formatMoney(sale.contract_value)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Zaliczka
                      </p>
                      <p className="mt-2 text-xl font-black text-slate-950">
                        {formatMoney(sale.deposit_amount)}
                      </p>
                    </div>
                  </div>

                  {currentUserRole === "cc" && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                      Część danych finansowych jest ukryta dla konsultanta CC.
                    </div>
                  )}

                  {financialBreakdown.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-black text-slate-950">
                        Więcej danych finansowych
                      </p>

                      <div className="mt-4 space-y-2">
                        {financialBreakdown
                          .filter((item: { label?: string | null }) => canShowFinancialBreakdownItem(item?.label))
                          .map((item: { label?: string | null; value?: number | string | null }, index: number) => (
                            <div
                              key={`${item?.label || "item"}-${index}`}
                              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <span className="text-sm font-semibold text-slate-700">
                                {item?.label || "Pozycja"}
                              </span>
                              <span className="text-sm font-black text-slate-950">
                                {formatMoney(item?.value)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                      Brak szczegółowych danych finansowych z oferty.
                    </div>
                  )}

                  {canSeeFullFinancials && companyMargin !== null && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                        Marża firmy
                      </p>
                      <p className="mt-2 text-xl font-black text-emerald-950">
                        {formatMoney(companyMargin)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Notatki sprzedaży
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Notatki zapisywane są na sprzedaży, a przy przypisanym kliencie także na karcie klienta.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <textarea
                      value={newSaleNote}
                      onChange={(event) => setNewSaleNote(event.target.value)}
                      rows={4}
                      placeholder="Dodaj notatkę..."
                      className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-slate-500">
                        {saleNoteStatus}
                      </p>

                      <button
                        type="button"
                        onClick={addSaleNote}
                        disabled={savingSaleNote}
                        className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        {savingSaleNote ? "Zapisywanie..." : "Dodaj notatkę"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {saleNotes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                        Brak notatek.
                      </div>
                    ) : (
                      saleNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">
                            {note.content}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(note.created_at).toLocaleString("pl-PL")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}