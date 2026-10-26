"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizePpe, OSD_OPTIONS, validatePpe, type OsdOperator } from "@/lib/ppeValidation";
import { getSaleInstallationCount } from "@/lib/installationCount";
import {
  areIdeaSignPhonesEqual,
  formatIdeaSignPolishPhone,
  normalizeIdeaSignPolishPhone,
} from "@/lib/ideasign/phone";
import { isIdeaSignContractSigningLocation } from "@/lib/ideasign/types";
import {
  createEmptyCustomPaymentSchedule,
  formatCustomPaymentInstallment,
  getCustomPaymentScheduleFromSale,
} from "@/lib/customPaymentSchedule";
import TechnicalSurveyForm from "@/components/TechnicalSurveyForm";
import {
  createEmptyTechnicalSurvey,
  createTechnicalSurveyForSale,
  normalizeTechnicalSurvey,
  validateTechnicalSurveyForSigning,
  type TechnicalSurvey,
} from "@/lib/technicalSurvey";

type ContractForm = {
  clientName: string;
  pesel: string;
  phone: string;
  email: string;
  contractAddress: string;
  correspondenceAddress: string;
  installationAddress: string;
  propertyType: string;
  usableAreaM2: string;
  contractNumber: string;
  secondClientName: string;
  secondClientPesel: string;
  secondClientPhone: string;
  secondClientEmail: string;
  client1MeterOwner: boolean;
  client2MeterOwner: boolean;
  osdOperator: OsdOperator | "";
  meterNumber: string;
  ppeNumber: string;
  contractPlace: string;
  contractDate: string;
  contractSigningLocation: string;
  meetingAgreedDate: string;
  depositDueDate: string;
  realizationVariant: string;
  depositAmount: string;
  totalGross: string;
  pvNetAfterDiscount: string;
  pvGrossBeforeDiscount: string;
  pvGrossAfterDiscount: string;
  storageNetAfterDiscount: string;
  storageGrossBeforeDiscount: string;
  storageGrossAfterDiscount: string;
  inverterNetAfterDiscount: string;
  inverterGrossBeforeDiscount: string;
  inverterGrossAfterDiscount: string;
  additionalServicesNetAfterDiscount: string;
  additionalServicesGrossBeforeDiscount: string;
  additionalServicesGrossAfterDiscount: string;
  paymentMethod: string;
  client1MarketingEmail: boolean;
  client1MarketingPhone: boolean;
  client1PhotoConsent: boolean;
  client2MarketingEmail: boolean;
  client2MarketingPhone: boolean;
  client2PhotoConsent: boolean;
};

type LocalIdeaSignLink = {
  signerOrder: number;
  signerName: string;
  url: string;
};

type IdeaSignSendResponse = {
  error?: string;
  transactionId?: string;
  authorizationRequired?: boolean;
  phoneMasked?: string;
  expiresAt?: string;
  demoCode?: string;
  localTest?: boolean;
  deliveryMode?: "live" | "simulated";
  demoOtp?: string;
  signerLinks?: unknown;
};

type IdeaSignAttachmentFive = {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  createdAt: string | null;
};

type IdeaSignAttachmentFiveResponse = {
  error?: string;
  attachment?: IdeaSignAttachmentFive | null;
  locked?: boolean;
  activeTransactionId?: string | null;
};

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

function asText(value: unknown) {
  return String(value ?? "");
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "PDF";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`;
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

function formatMoneyInput(value: unknown) {
  const parsed = parseMoneyValue(value);

  if (!parsed) {
    return "";
  }

  return parsed.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SaleContractPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const saleId = params.id;

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [error, setError] = useState("");
  const [saleNumber, setSaleNumber] = useState("");
  const [installationCount, setInstallationCount] = useState(1);
  const [hasIdeaSignSendAccess, setHasIdeaSignSendAccess] = useState(false);
  const [sendingIdeaSign, setSendingIdeaSign] = useState(false);
  const [authorizingIdeaSign, setAuthorizingIdeaSign] = useState(false);
  const [resendingOfferorOtp, setResendingOfferorOtp] = useState(false);
  const [ideaSignStatus, setIdeaSignStatus] = useState("");
  const [offerorOtp, setOfferorOtp] = useState("");
  const [offerorDemoCode, setOfferorDemoCode] = useState("");
  const [offerorAuthorization, setOfferorAuthorization] = useState<{
    transactionId: string;
    phoneMasked: string;
  } | null>(null);
  const [hasSecondClient, setHasSecondClient] = useState(false);
  const [localIdeaSignLinks, setLocalIdeaSignLinks] = useState<LocalIdeaSignLink[]>([]);
  const [localIdeaSignDeliveryMode, setLocalIdeaSignDeliveryMode] = useState<"live" | "simulated">("simulated");
  const [localIdeaSignDemoOtp, setLocalIdeaSignDemoOtp] = useState("");
  const [ideaSignAttachmentFive, setIdeaSignAttachmentFive] =
    useState<IdeaSignAttachmentFive | null>(null);
  const [ideaSignAttachmentFiveLocked, setIdeaSignAttachmentFiveLocked] = useState(false);
  const [ideaSignAttachmentFiveBusy, setIdeaSignAttachmentFiveBusy] = useState(false);
  const [ideaSignAttachmentFiveStatus, setIdeaSignAttachmentFiveStatus] = useState("");
  const [technicalSurvey, setTechnicalSurvey] = useState<TechnicalSurvey>(
    createEmptyTechnicalSurvey
  );
  const [technicalSurveySaving, setTechnicalSurveySaving] = useState(false);
  const [technicalSurveyStatus, setTechnicalSurveyStatus] = useState("");
  const [technicalSurveyUploadingCategory, setTechnicalSurveyUploadingCategory] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [saleClientId, setSaleClientId] = useState<string | null>(null);
  const [customPaymentSchedule, setCustomPaymentSchedule] = useState(
    createEmptyCustomPaymentSchedule
  );
  const [form, setForm] = useState<ContractForm>({
    clientName: "",
    pesel: "",
    phone: "",
    email: "",
    contractAddress: "",
    correspondenceAddress: "",
    installationAddress: "",
    propertyType: "",
    usableAreaM2: "",
    contractNumber: "",
    secondClientName: "",
    secondClientPesel: "",
    secondClientPhone: "",
    secondClientEmail: "",
    client1MeterOwner: false,
    client2MeterOwner: false,
    osdOperator: "",
    meterNumber: "",
    ppeNumber: "",
    contractPlace: "",
    contractDate: todayLocalDate(),
    contractSigningLocation: "",
    meetingAgreedDate: "",
    depositDueDate: "",
    realizationVariant: "",
    depositAmount: "",
    totalGross: "",
    pvNetAfterDiscount: "",
    pvGrossBeforeDiscount: "",
    pvGrossAfterDiscount: "",
    storageNetAfterDiscount: "",
    storageGrossBeforeDiscount: "",
    storageGrossAfterDiscount: "",
    inverterNetAfterDiscount: "",
    inverterGrossBeforeDiscount: "",
    inverterGrossAfterDiscount: "",
    additionalServicesNetAfterDiscount: "",
    additionalServicesGrossBeforeDiscount: "",
    additionalServicesGrossAfterDiscount: "",
    paymentMethod: "cash",
    client1MarketingEmail: false,
    client1MarketingPhone: false,
    client1PhotoConsent: false,
    client2MarketingEmail: false,
    client2MarketingPhone: false,
    client2PhotoConsent: false,
  });

  const loadContractData = useCallback(async () => {
    setLoading(true);
    setFatalError("");
    setError("");

    const [saleResponse, userResponse] = await Promise.all([
      supabase.from("sales").select("*").eq("id", saleId).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    const { data: sale, error: saleError } = saleResponse;
    const user = userResponse.data.user;
    setCurrentUserId(user?.id || "");
    setSaleClientId(typeof sale.client_id === "string" ? sale.client_id : null);

    if (saleError || !sale) {
      console.error("Błąd ładowania sprzedaży do umowy:", saleError);
      setFatalError("Nie udało się załadować danych sprzedaży.");
      setLoading(false);
      return;
    }

    if (user) {
      const [{ data: permission }, { data: profile }] = await Promise.all([
        supabase
          .from("user_permissions")
          .select("ideasign_send")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      const role = String(profile?.role || "").toLowerCase();
      setHasIdeaSignSendAccess(
        permission?.ideasign_send === true || role === "admin" || role === "owner"
      );
    } else {
      setHasIdeaSignSendAccess(false);
    }

    // Supabase types for this legacy, schemaless client payload are not generated yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: Record<string, any> | null = null;

    if (sale.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", sale.client_id)
        .maybeSingle();

      client = clientData;
    }

    // The historical JSON payload contains fields from several contract versions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerData = (sale.customer_data || {}) as Record<string, any>;

    const contractAddress =
      customerData.contract_address ||
      [
        customerData.contract_street,
        customerData.contract_building,
        customerData.contract_postal,
        customerData.contract_city,
      ]
        .filter(Boolean)
        .join(" ") ||
      client?.address ||
      [client?.street, client?.building_number, client?.postal_code, client?.city]
        .filter(Boolean)
        .join(" ") ||
      "";

    const installationAddress =
      customerData.installation_address ||
      [
        customerData.installation_street,
        customerData.installation_building,
        customerData.installation_postal,
        customerData.installation_city,
      ]
        .filter(Boolean)
        .join(" ") ||
      contractAddress;

    const contractNumber = String(
      sale.contract_number || customerData.contract_number || sale.public_id || sale.sale_id || sale.id
    );
    const clientName =
      customerData.full_name ||
      customerData.name ||
      sale.customer_name ||
      sale.client_name ||
      client?.full_name ||
      client?.company_name ||
      "";

    setSaleNumber(contractNumber);
    setInstallationCount(getSaleInstallationCount(sale));
    setCustomPaymentSchedule(getCustomPaymentScheduleFromSale(sale));
    setHasSecondClient(
      Boolean(
        customerData.second_client_name ||
          customerData.second_client_pesel ||
          customerData.second_client_phone ||
          customerData.second_client_email
      )
    );
    setForm({
      clientName,
      pesel: customerData.pesel || sale.customer_pesel || client?.pesel || "",
      phone:
        formatIdeaSignPolishPhone(customerData.phone || sale.customer_phone || client?.phone) ||
        customerData.phone ||
        sale.customer_phone ||
        client?.phone ||
        "",
      email: customerData.email || sale.customer_email || client?.email || "",
      contractAddress,
      correspondenceAddress: customerData.correspondence_address || contractAddress,
      installationAddress,
      propertyType: customerData.property_type || customerData.building_type || "",
      usableAreaM2: asText(
        customerData.usable_area_m2 || customerData.usable_area || customerData.property_area_m2
      ),
      contractNumber,
      secondClientName: customerData.second_client_name || "",
      secondClientPesel: customerData.second_client_pesel || "",
      secondClientPhone:
        formatIdeaSignPolishPhone(customerData.second_client_phone) ||
        customerData.second_client_phone ||
        "",
      secondClientEmail: customerData.second_client_email || "",
      client1MeterOwner: customerData.client1_meter_owner === true,
      client2MeterOwner: customerData.client2_meter_owner === true,
      osdOperator: customerData.osd_operator || "",
      meterNumber: customerData.meter_number || "",
      ppeNumber: customerData.ppe_number || "",
      contractPlace: customerData.contract_place || "",
      contractDate: customerData.contract_date || todayLocalDate(),
      contractSigningLocation:
        customerData.contract_signing_location ||
        (customerData.visit_previously_scheduled === true
          ? "scheduled_home_visit"
          : customerData.visit_previously_scheduled === false
            ? "unscheduled_home_visit"
            : ""),
      meetingAgreedDate: customerData.meeting_agreed_date || "",
      depositDueDate: customerData.deposit_due_date || "",
      realizationVariant: customerData.realization_variant || "",
      depositAmount: formatMoneyInput(sale.deposit_amount || sale.deposit_gross || customerData.deposit_amount || ""),
      totalGross: formatMoneyInput(
        customerData.contract_total_gross_after_discount ||
          customerData.contract_total_gross ||
          sale.contract_value ||
          sale.total_gross ||
          sale.final_gross ||
          ""
      ),
      pvNetAfterDiscount: formatMoneyInput(customerData.contract_pv_net_after_discount),
      pvGrossBeforeDiscount: formatMoneyInput(customerData.contract_pv_gross_before_discount),
      pvGrossAfterDiscount: formatMoneyInput(customerData.contract_pv_gross_after_discount || customerData.contract_pv_gross),
      storageNetAfterDiscount: formatMoneyInput(customerData.contract_storage_net_after_discount),
      storageGrossBeforeDiscount: formatMoneyInput(customerData.contract_storage_gross_before_discount),
      storageGrossAfterDiscount: formatMoneyInput(customerData.contract_storage_gross_after_discount || customerData.contract_storage_gross),
      inverterNetAfterDiscount: formatMoneyInput(customerData.contract_inverter_net_after_discount),
      inverterGrossBeforeDiscount: formatMoneyInput(customerData.contract_inverter_gross_before_discount),
      inverterGrossAfterDiscount: formatMoneyInput(customerData.contract_inverter_gross_after_discount || customerData.contract_inverter_gross),
      additionalServicesNetAfterDiscount: formatMoneyInput(customerData.contract_additional_services_net_after_discount),
      additionalServicesGrossBeforeDiscount: formatMoneyInput(customerData.contract_additional_services_gross_before_discount),
      additionalServicesGrossAfterDiscount: formatMoneyInput(
        customerData.contract_additional_services_gross_after_discount || customerData.contract_additional_services_gross
      ),
      paymentMethod: customerData.payment_method || sale.payment_method || "cash",
      client1MarketingEmail: customerData.client1_marketing_email === true,
      client1MarketingPhone: customerData.client1_marketing_phone === true,
      client1PhotoConsent: customerData.client1_photo_consent === true,
      client2MarketingEmail: customerData.client2_marketing_email === true,
      client2MarketingPhone: customerData.client2_marketing_phone === true,
      client2PhotoConsent: customerData.client2_photo_consent === true,
    });
    setTechnicalSurvey(
      createTechnicalSurveyForSale(sale, customerData.technical_survey, {
        clientName,
        installationAddress,
        contractNumber,
        auditor: user?.email || "",
        osdOperator: customerData.osd_operator || "",
      })
    );

    setLoading(false);
  }, [saleId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadContractData();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadContractData]);

  const loadIdeaSignAttachmentFive = useCallback(async () => {
    if (!hasIdeaSignSendAccess) return;
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      const response = await fetch(`/api/ideasign/sales/${saleId}/attachment-5`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as IdeaSignAttachmentFiveResponse;
      if (!response.ok) throw new Error(result.error || "Nie udało się odczytać Załącznika nr 5.");
      setIdeaSignAttachmentFive(result.attachment || null);
      setIdeaSignAttachmentFiveLocked(Boolean(result.locked));
    } catch (attachmentError) {
      setIdeaSignAttachmentFiveStatus(
        attachmentError instanceof Error
          ? attachmentError.message
          : "Nie udało się odczytać Załącznika nr 5."
      );
    }
  }, [hasIdeaSignSendAccess, saleId]);

  useEffect(() => {
    if (!hasIdeaSignSendAccess) return;
    const frame = window.requestAnimationFrame(() => {
      void loadIdeaSignAttachmentFive();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasIdeaSignSendAccess, loadIdeaSignAttachmentFive]);

  function updateField(field: keyof ContractForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBooleanField(field: keyof ContractForm, value: boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function removeSecondClient() {
    setHasSecondClient(false);
    setForm((current) => ({
      ...current,
      secondClientName: "",
      secondClientPesel: "",
      secondClientPhone: "",
      secondClientEmail: "",
      client2MeterOwner: false,
      client2MarketingEmail: false,
      client2MarketingPhone: false,
      client2PhotoConsent: false,
    }));
  }

  function addSecondClient() {
    setHasSecondClient(true);
    setForm((current) => ({
      ...current,
      secondClientPhone: current.secondClientPhone || "+48 ",
    }));
  }

  function normalizePhoneField(field: "phone" | "secondClientPhone") {
    setForm((current) => {
      const formatted = formatIdeaSignPolishPhone(current[field]);
      return formatted ? { ...current, [field]: formatted } : current;
    });
  }

  function currentTechnicalSurvey(source = technicalSurvey) {
    return normalizeTechnicalSurvey({
      ...source,
      clientName: form.clientName,
      installationAddress: form.installationAddress,
      contractNumber: form.contractNumber || saleNumber,
      scopes: source.choices.products || [],
      text: {
        ...source.text,
        client_name: form.clientName,
        installation_address: form.installationAddress,
        contract_number: form.contractNumber || saleNumber,
        osd_operator: form.osdOperator,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  async function persistTechnicalSurveyValue(
    source: TechnicalSurvey,
    announce = true
  ) {
    const nextSurvey = currentTechnicalSurvey(source);
    if (announce) {
      setTechnicalSurveySaving(true);
      setTechnicalSurveyStatus("Zapisuję ankietę…");
    }
    try {
      const { data: latestSale, error: latestSaleError } = await supabase
        .from("sales")
        .select("customer_data")
        .eq("id", saleId)
        .maybeSingle();
      if (latestSaleError) throw latestSaleError;

      const latestCustomerData =
        latestSale?.customer_data && typeof latestSale.customer_data === "object"
          ? (latestSale.customer_data as Record<string, unknown>)
          : {};
      const { error: saveError } = await supabase
        .from("sales")
        .update({
          customer_data: {
            ...latestCustomerData,
            technical_survey: nextSurvey,
          },
        })
        .eq("id", saleId);
      if (saveError) throw saveError;
      setTechnicalSurvey(nextSurvey);
      if (announce) {
        setTechnicalSurveyStatus(
          "Ankieta została zapisana. Możesz ją jeszcze edytować przed wysłaniem do IdeaSign."
        );
      }
      return nextSurvey;
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Nie udało się zapisać ankiety technicznej.";
      setTechnicalSurveyStatus(message);
      throw saveError;
    } finally {
      if (announce) setTechnicalSurveySaving(false);
    }
  }

  async function saveTechnicalSurvey() {
    try {
      await persistTechnicalSurveyValue(technicalSurvey);
    } catch {
      // Status błędu jest prezentowany bezpośrednio pod ankietą.
    }
  }

  async function uploadTechnicalSurveyPhotos(
    category: string,
    label: string,
    files: File[]
  ) {
    if (!currentUserId) {
      setTechnicalSurveyStatus("Sesja CRM wygasła. Zaloguj się ponownie.");
      return;
    }
    const invalid = files.find(
      (file) => !file.type.startsWith("image/") || file.size <= 0 || file.size > 10 * 1024 * 1024
    );
    if (invalid) {
      setTechnicalSurveyStatus(
        `Plik „${invalid.name}” nie jest obsługiwanym zdjęciem albo przekracza 10 MB.`
      );
      return;
    }

    setTechnicalSurveyUploadingCategory(category);
    setTechnicalSurveyStatus(`Wysyłam zdjęcia: ${label}…`);
    try {
      const uploadedPhotos = [...technicalSurvey.photos];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${saleId}/survey-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("sale-documents")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: insertedDocument, error: insertError } = await supabase
          .from("sale_documents")
          .insert({
            sale_id: saleId,
            client_id: saleClientId,
            uploaded_by: currentUserId,
            description: `[Ankieta techniczna] ${label}`,
            document_type: "Zdjęcia",
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || null,
            file_size: file.size,
          })
          .select("id, file_path, file_type, created_at")
          .single();
        if (insertError || !insertedDocument) {
          await supabase.storage.from("sale-documents").remove([filePath]);
          throw insertError || new Error("Nie udało się przypisać zdjęcia do sprzedaży.");
        }
        uploadedPhotos.push({
          id: insertedDocument.id,
          documentId: insertedDocument.id,
          version: insertedDocument.created_at || new Date().toISOString(),
          category: label,
          description: `[Ankieta techniczna] ${label}`,
          mimeType: insertedDocument.file_type || file.type || "",
          storagePath: insertedDocument.file_path || filePath,
        });
      }

      const nextSurvey = {
        ...technicalSurvey,
        photos: uploadedPhotos,
        photoChecklist: [...new Set([...technicalSurvey.photoChecklist, category])],
      };
      await persistTechnicalSurveyValue(nextSurvey, false);
      setTechnicalSurveyStatus(
        `Dodano ${files.length} ${files.length === 1 ? "zdjęcie" : "zdjęcia"}. Zdjęcia są dostępne również na karcie sprzedaży.`
      );
    } catch (uploadError) {
      setTechnicalSurveyStatus(
        uploadError instanceof Error
          ? uploadError.message
          : "Nie udało się przesłać zdjęć."
      );
    } finally {
      setTechnicalSurveyUploadingCategory("");
    }
  }

  async function buildValidatedContractQuery(options?: {
    requireIdeaSignContacts?: boolean;
  }) {
    setError("");

    const normalizedContractNumber = form.contractNumber.trim();
    const normalizedPrimaryPhone = normalizeIdeaSignPolishPhone(form.phone);
    const normalizedSecondPhone = normalizeIdeaSignPolishPhone(form.secondClientPhone);
    const formattedPrimaryPhone = formatIdeaSignPolishPhone(form.phone);
    const formattedSecondPhone = formatIdeaSignPolishPhone(form.secondClientPhone);

    if (!normalizedContractNumber) {
      setError("Uzupełnij numer umowy przed wygenerowaniem PDF.");
      return null;
    }

    if (!form.propertyType) {
      setError("Wybierz rodzaj nieruchomości przed wygenerowaniem PDF.");
      return null;
    }

    const usableArea = Number(form.usableAreaM2.replace(",", "."));

    if (!Number.isFinite(usableArea) || usableArea <= 0) {
      setError("Uzupełnij prawidłową powierzchnię użytkową nieruchomości.");
      return null;
    }

    if (!form.contractSigningLocation) {
      setError("Wybierz, gdzie i w jakich okolicznościach podpisano umowę.");
      return null;
    }

    if (form.contractSigningLocation === "scheduled_home_visit" && !form.meetingAgreedDate) {
      setError("Uzupełnij datę, kiedy zostało umówione spotkanie.");
      return null;
    }

    if (form.contractSigningLocation !== "business_premises" && !form.realizationVariant) {
      setError("Uzupełnij moment rozpoczęcia odpłatnych usług.");
      return null;
    }

    if (!form.client1MeterOwner && !form.client2MeterOwner) {
      setError("Zaznacz co najmniej jednego właściciela licznika.");
      return null;
    }

    if (form.client2MeterOwner && (!form.secondClientName.trim() || !form.secondClientPesel.trim())) {
      setError("Uzupełnij dane klienta 2, jeżeli jest właścicielem licznika.");
      return null;
    }

    if (hasSecondClient) {
      if (!form.secondClientName.trim() || !form.secondClientPesel.trim()) {
        setError("Uzupełnij imię i nazwisko oraz PESEL klienta 2.");
        return null;
      }

      if (options?.requireIdeaSignContacts) {
        if (!normalizedSecondPhone || !/^\S+@\S+\.\S+$/.test(form.secondClientEmail.trim())) {
          setError("Przy wysyłce do IdeaSign uzupełnij osobny, poprawny telefon i e-mail klienta 2.");
          return null;
        }
        if (!normalizedPrimaryPhone) {
          setError("Uzupełnij poprawny polski numer telefonu klienta 1.");
          return null;
        }
        if (areIdeaSignPhonesEqual(form.secondClientPhone, form.phone) || form.secondClientEmail.trim().toLowerCase() === form.email.trim().toLowerCase()) {
          setError("Każdy podpisujący w IdeaSign musi mieć własny numer telefonu i własny adres e-mail.");
          return null;
        }
      }
    }

    if (!form.osdOperator) {
      setError("Wybierz operatora OSD.");
      return null;
    }

    const ppeError =
      installationCount <= 1 || form.ppeNumber.trim()
        ? validatePpe(form.ppeNumber, form.osdOperator)
        : "";

    if (ppeError) {
      setError(ppeError);
      return null;
    }

    const { data: existingContract, error: duplicateCheckError } = await supabase
      .from("sales")
      .select("id, contract_number")
      .eq("contract_number", normalizedContractNumber)
      .neq("id", saleId)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error("Błąd sprawdzania duplikatu numeru umowy:", duplicateCheckError);
      setError("Nie udało się sprawdzić numeru umowy. Spróbuj ponownie.");
      return null;
    }

    if (existingContract) {
      setError("Umowa o wskazanym numerze istnieje w systemie.");
      return null;
    }
    const query = new URLSearchParams({
      clientName: form.clientName,
      pesel: form.pesel,
      phone: formattedPrimaryPhone || form.phone,
      email: form.email,
      contractAddress: form.contractAddress,
      correspondenceAddress: form.correspondenceAddress,
      installationAddress: form.installationAddress,
      propertyType: form.propertyType,
      usableAreaM2: form.usableAreaM2,
      contractNumber: normalizedContractNumber,
      secondClientName: hasSecondClient ? form.secondClientName : "",
      secondClientPesel: hasSecondClient ? form.secondClientPesel : "",
      secondClientPhone: hasSecondClient ? formattedSecondPhone || form.secondClientPhone : "",
      secondClientEmail: hasSecondClient ? form.secondClientEmail : "",
      client1MeterOwner: String(form.client1MeterOwner),
      client2MeterOwner: String(form.client2MeterOwner),
      osdOperator: form.osdOperator,
      meterNumber: form.meterNumber,
      ppeNumber: normalizePpe(form.ppeNumber),
      contractPlace: form.contractPlace,
      contractDate: form.contractDate,
      contractSigningLocation: form.contractSigningLocation,
      meetingAgreedDate: form.meetingAgreedDate,
      depositDueDate: form.depositDueDate,
      realizationVariant: form.realizationVariant,
      depositAmount: form.depositAmount,
      totalGross: form.totalGross,
      pvGrossBeforeDiscount: form.pvGrossBeforeDiscount,
      pvGrossAfterDiscount: form.pvGrossAfterDiscount,
      storageGrossBeforeDiscount: form.storageGrossBeforeDiscount,
      storageGrossAfterDiscount: form.storageGrossAfterDiscount,
      inverterGrossBeforeDiscount: form.inverterGrossBeforeDiscount,
      inverterGrossAfterDiscount: form.inverterGrossAfterDiscount,
      additionalServicesGrossBeforeDiscount: form.additionalServicesGrossBeforeDiscount,
      additionalServicesGrossAfterDiscount: form.additionalServicesGrossAfterDiscount,
      paymentMethod: form.paymentMethod,
      client1MarketingEmail: String(form.client1MarketingEmail),
      client1MarketingPhone: String(form.client1MarketingPhone),
      client1PhotoConsent: String(form.client1PhotoConsent),
      client2MarketingEmail: String(form.client2MarketingEmail),
      client2MarketingPhone: String(form.client2MarketingPhone),
      client2PhotoConsent: String(form.client2PhotoConsent),
    });

    return query;
  }

  async function generatePdf() {
    const query = await buildValidatedContractQuery();
    if (!query) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setIdeaSignStatus("Sesja wygasła. Zaloguj się ponownie.");
      return;
    }
    const response = await fetch(`/sales/${saleId}/contract-pdf?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      setIdeaSignStatus(error?.error || "Nie udało się wygenerować umowy.");
      return;
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  async function uploadIdeaSignAttachmentFive(file: File) {
    if (ideaSignAttachmentFiveBusy || ideaSignAttachmentFiveLocked) return;
    setIdeaSignAttachmentFiveStatus("");
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
      setIdeaSignAttachmentFiveStatus("Wybierz dokument w formacie PDF.");
      return;
    }
    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      setIdeaSignAttachmentFiveStatus("Wybierz plik PDF o rozmiarze do 50 MB.");
      return;
    }
    setIdeaSignAttachmentFiveBusy(true);
    setIdeaSignAttachmentFiveStatus("Wgrywam i sprawdzam dokument…");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/ideasign/sales/${saleId}/attachment-5`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as IdeaSignAttachmentFiveResponse;
      if (!response.ok || !result.attachment) {
        throw new Error(result.error || "Nie udało się dodać Załącznika nr 5.");
      }
      setIdeaSignAttachmentFive(result.attachment);
      setIdeaSignAttachmentFiveStatus(
        "Załącznik jest gotowy. Dane klienta, data i numer umowy zostaną naniesione podczas zamrażania pakietu."
      );
    } catch (attachmentError) {
      setIdeaSignAttachmentFiveStatus(
        attachmentError instanceof Error
          ? attachmentError.message
          : "Nie udało się dodać Załącznika nr 5."
      );
    } finally {
      setIdeaSignAttachmentFiveBusy(false);
    }
  }

  async function removeIdeaSignAttachmentFive() {
    if (
      ideaSignAttachmentFiveBusy ||
      ideaSignAttachmentFiveLocked ||
      !ideaSignAttachmentFive ||
      !window.confirm("Usunąć opcjonalny Załącznik nr 5 z tej sprzedaży?")
    ) {
      return;
    }
    setIdeaSignAttachmentFiveBusy(true);
    setIdeaSignAttachmentFiveStatus("Usuwam dokument…");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");
      const response = await fetch(`/api/ideasign/sales/${saleId}/attachment-5`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => ({}))) as IdeaSignAttachmentFiveResponse;
      if (!response.ok) throw new Error(result.error || "Nie udało się usunąć Załącznika nr 5.");
      setIdeaSignAttachmentFive(null);
      setIdeaSignAttachmentFiveStatus("Załącznik nr 5 został usunięty.");
    } catch (attachmentError) {
      setIdeaSignAttachmentFiveStatus(
        attachmentError instanceof Error
          ? attachmentError.message
          : "Nie udało się usunąć Załącznika nr 5."
      );
    } finally {
      setIdeaSignAttachmentFiveBusy(false);
    }
  }

  async function sendToIdeaSign() {
    if (sendingIdeaSign || !hasIdeaSignSendAccess) return;
    setIdeaSignStatus("");
    setLocalIdeaSignLinks([]);
    setLocalIdeaSignDemoOtp("");

    if (!isIdeaSignContractSigningLocation(form.contractSigningLocation)) {
      setIdeaSignStatus(
        "Przed wysłaniem wybierz rzeczywisty sposób i okoliczności zawarcia umowy."
      );
      return;
    }

    const query = await buildValidatedContractQuery({ requireIdeaSignContacts: true });
    if (!query) return;

    const surveyForSigning = currentTechnicalSurvey();
    const surveyErrors = validateTechnicalSurveyForSigning(surveyForSigning);
    if (surveyErrors.length) {
      setTechnicalSurveyStatus(surveyErrors[0]);
      setIdeaSignStatus("Uzupełnij ankietę techniczną przed wysłaniem umowy.");
      return;
    }

    let savedSurvey: TechnicalSurvey;
    try {
      savedSurvey = await persistTechnicalSurveyValue(surveyForSigning, false);
    } catch {
      setIdeaSignStatus("Nie udało się zapisać ankiety technicznej przed wysłaniem.");
      return;
    }

    const confirmed = window.confirm(
      `Zapisać i zamrozić tę wersję umowy wraz z Załącznikiem nr 4 — ankietą techniczną${
        ideaSignAttachmentFive ? " wraz z opcjonalnym Załącznikiem nr 5" : ""
      }? Zdjęcia pozostają opcjonalne i można je uzupełnić później. Otrzymasz kod SMS do autoryzacji. Linki do klientów zostaną wysłane dopiero po wpisaniu poprawnego kodu.`
    );
    if (!confirmed) return;

    setSendingIdeaSign(true);
    setIdeaSignStatus("Zapisujemy i zabezpieczamy wersję dokumentów…");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");

      const response = await fetch(`/api/ideasign/sales/${saleId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractData: Object.fromEntries(query.entries()),
          technicalSurvey: savedSurvey,
          attachmentFiveDocumentId: ideaSignAttachmentFive?.id || null,
        }),
      });
      const responseText = await response.text();
      let result: IdeaSignSendResponse = {};
      if (responseText) {
        try {
          result = JSON.parse(responseText) as IdeaSignSendResponse;
        } catch {
          if (!response.ok) {
            throw new Error(
              `IdeaSign zwrócił błąd serwera (${response.status}). Sprawdź konfigurację lokalną.`
            );
          }
          throw new Error("IdeaSign zwrócił nieprawidłową odpowiedź serwera.");
        }
      }
      if (!response.ok) throw new Error(result.error || "Nie udało się wysłać umowy do IdeaSign.");
      if (result.authorizationRequired && result.transactionId) {
        setIdeaSignAttachmentFiveLocked(true);
        setOfferorAuthorization({
          transactionId: result.transactionId,
          phoneMasked: result.phoneMasked || "numer z profilu CRM",
        });
        setOfferorDemoCode(typeof result.demoCode === "string" ? result.demoCode : "");
        setIdeaSignStatus(
          `Dokumenty zostały zamrożone. Wpisz kod SMS wysłany na ${result.phoneMasked || "numer z profilu CRM"}.`
        );
        return;
      }
      const localLinks = Array.isArray(result.signerLinks)
        ? result.signerLinks.filter(
            (link: unknown): link is LocalIdeaSignLink =>
              Boolean(
                link &&
                  typeof link === "object" &&
                  typeof (link as LocalIdeaSignLink).signerOrder === "number" &&
                  typeof (link as LocalIdeaSignLink).signerName === "string" &&
                  typeof (link as LocalIdeaSignLink).url === "string"
              )
          )
        : [];
      setLocalIdeaSignLinks(localLinks);
      setIdeaSignAttachmentFiveLocked(true);
      setLocalIdeaSignDeliveryMode(result.deliveryMode === "live" ? "live" : "simulated");
      setLocalIdeaSignDemoOtp(typeof result.demoOtp === "string" ? result.demoOtp : "");
      setIdeaSignStatus(
        result.localTest
          ? `Tryb lokalny gotowy. ID transakcji: ${result.transactionId}`
          : `Wysłano bezpieczny link. ID transakcji: ${result.transactionId}`
      );
    } catch (sendError) {
      setIdeaSignStatus(
        sendError instanceof Error ? sendError.message : "Nie udało się wysłać umowy do IdeaSign."
      );
    } finally {
      setSendingIdeaSign(false);
    }
  }

  async function authorizeIdeaSignOffer() {
    if (!offerorAuthorization || authorizingIdeaSign || !/^\d{6}$/.test(offerorOtp)) return;
    setAuthorizingIdeaSign(true);
    setIdeaSignStatus("Sprawdzamy kod handlowca i uruchamiamy wysyłkę do klientów…");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");
      const response = await fetch(`/api/ideasign/sales/${saleId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "authorize",
          transactionId: offerorAuthorization.transactionId,
          code: offerorOtp,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as IdeaSignSendResponse;
      if (!response.ok) throw new Error(result.error || "Nie udało się potwierdzić kodu handlowca.");

      const localLinks = Array.isArray(result.signerLinks)
        ? result.signerLinks.filter(
            (link: unknown): link is LocalIdeaSignLink =>
              Boolean(
                link &&
                  typeof link === "object" &&
                  typeof (link as LocalIdeaSignLink).signerOrder === "number" &&
                  typeof (link as LocalIdeaSignLink).signerName === "string" &&
                  typeof (link as LocalIdeaSignLink).url === "string"
              )
          )
        : [];
      setLocalIdeaSignLinks(localLinks);
      setLocalIdeaSignDeliveryMode(result.deliveryMode === "live" ? "live" : "simulated");
      setLocalIdeaSignDemoOtp(typeof result.demoOtp === "string" ? result.demoOtp : "");
      setOfferorAuthorization(null);
      setOfferorOtp("");
      setOfferorDemoCode("");
      setIdeaSignStatus(
        result.localTest
          ? `Autoryzacja handlowca poprawna. Tryb lokalny gotowy. ID transakcji: ${result.transactionId}`
          : `Autoryzacja handlowca poprawna. Linki wysłano klientom. ID transakcji: ${result.transactionId}`
      );
    } catch (authorizationError) {
      setIdeaSignStatus(
        authorizationError instanceof Error
          ? authorizationError.message
          : "Nie udało się potwierdzić kodu handlowca."
      );
    } finally {
      setAuthorizingIdeaSign(false);
    }
  }

  async function resendOfferorOtp() {
    if (!offerorAuthorization || resendingOfferorOtp) return;
    setResendingOfferorOtp(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");
      const response = await fetch(`/api/ideasign/sales/${saleId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "resend-offeror-otp",
          transactionId: offerorAuthorization.transactionId,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as IdeaSignSendResponse;
      if (!response.ok) throw new Error(result.error || "Nie udało się wysłać nowego kodu.");
      setOfferorDemoCode(typeof result.demoCode === "string" ? result.demoCode : "");
      setIdeaSignStatus(`Nowy kod wysłano na ${result.phoneMasked || offerorAuthorization.phoneMasked}.`);
    } catch (resendError) {
      setIdeaSignStatus(resendError instanceof Error ? resendError.message : "Nie udało się wysłać nowego kodu.");
    } finally {
      setResendingOfferorOtp(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <p className="text-slate-500">Ładowanie danych do umowy...</p>
      </main>
    );
  }

  if (fatalError) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          {fatalError}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#119182]">
                Generator umowy
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Umowa sprzedaży {saleNumber}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Sprawdź dane pobrane z CRM i uzupełnij brakujące pola przed wygenerowaniem PDF.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/sales/${saleId}`)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Wróć do sprzedaży
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Dane klienta
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Imię i nazwisko</span>
              <input
                value={form.clientName}
                onChange={(event) => updateField("clientName", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">PESEL</span>
              <input
                value={form.pesel}
                onChange={(event) => updateField("pesel", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={form.client1MeterOwner}
                onChange={(event) => updateBooleanField("client1MeterOwner", event.target.checked)}
              />
              Klient 1 — właściciel licznika
            </label>

            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Druga osoba na umowie</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Opcjonalnie — dodaj ją tylko wtedy, gdy umowę zawierają dwie osoby.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (hasSecondClient ? removeSecondClient() : addSecondClient())}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                    hasSecondClient
                      ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                      : "bg-sky-700 text-white hover:bg-sky-800"
                  }`}
                >
                  {hasSecondClient ? "Usuń drugą osobę" : "+ Dodaj drugą osobę"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
                Unikalny numer telefonu i adres e-mail są wymagane tylko przy wysyłce do
                IdeaSign. Nie blokują wygenerowania umowy papierowej.
              </div>

              {hasSecondClient && <>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Imię i nazwisko klienta 2</span>
                  <input
                    value={form.secondClientName}
                    onChange={(event) => updateField("secondClientName", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Telefon klienta 2</span>
                  <input
                    type="tel"
                    value={form.secondClientPhone}
                    onChange={(event) => updateField("secondClientPhone", event.target.value)}
                    onBlur={() => normalizePhoneField("secondClientPhone")}
                    placeholder="+48 501 234 567"
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">E-mail klienta 2</span>
                  <input
                    type="email"
                    value={form.secondClientEmail}
                    onChange={(event) => updateField("secondClientEmail", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">PESEL klienta 2</span>
                  <input
                    value={form.secondClientPesel}
                    onChange={(event) => updateField("secondClientPesel", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.client2MeterOwner}
                  onChange={(event) => updateBooleanField("client2MeterOwner", event.target.checked)}
                />
                Klient 2 — właściciel licznika
              </label>
              </>}
            </div>

            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">Dane do pełnomocnictwa ZM</p>
              <p className="mt-1 text-xs text-slate-500">
                Pełnomocnictwa ZM i PPOZ zostaną dołączone do PDF umowy.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Operator OSD</span>
                  <select
                    value={form.osdOperator}
                    onChange={(event) => updateField("osdOperator", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  >
                    <option value="">Wybierz operatora</option>
                    {OSD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Numer licznika</span>
                  <input
                    value={form.meterNumber}
                    onChange={(event) => updateField("meterNumber", event.target.value.trimStart())}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Numer PPE</span>
                  <input
                    inputMode="numeric"
                    maxLength={18}
                    value={form.ppeNumber}
                    onChange={(event) =>
                      updateField("ppeNumber", event.target.value.replace(/\D/g, "").slice(0, 18))
                    }
                    placeholder="18 cyfr"
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    {installationCount > 1
                      ? "Dla umowy wieloinstalacyjnej numer PPE i numer licznika są opcjonalne. Jeśli wpiszesz PPE, nadal sprawdzimy jego poprawność."
                      : "Sprawdzamy operatora, prefiks, długość i cyfrę kontrolną GS1."}
                  </span>
                </label>
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Telefon</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                onBlur={() => normalizePhoneField("phone")}
                placeholder="+48 501 234 567"
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">E-mail</span>
              <input
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Adresy i płatność
          </h2>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Adres zamieszkania / siedziby</span>
              <input
                value={form.contractAddress}
                onChange={(event) => updateField("contractAddress", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Adres korespondencyjny</span>
              <input
                value={form.correspondenceAddress}
                onChange={(event) => updateField("correspondenceAddress", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Adres miejsca montażu</span>
              <input
                value={form.installationAddress}
                onChange={(event) => updateField("installationAddress", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Rodzaj nieruchomości</span>
                <select
                  value={form.propertyType}
                  onChange={(event) => updateField("propertyType", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                >
                  <option value="">Wybierz</option>
                  <option value="single_family">Budynek mieszkalny jednorodzinny</option>
                  <option value="apartment">Lokal mieszkalny w budynku wielorodzinnym</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Powierzchnia użytkowa</span>
                <div className="relative mt-2">
                  <input
                    inputMode="decimal"
                    value={form.usableAreaM2}
                    onChange={(event) => updateField("usableAreaM2", event.target.value)}
                    placeholder="np. 145,5"
                    className="h-11 w-full rounded-xl border border-slate-300 px-4 pr-12 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-slate-500">
                    m²
                  </span>
                </div>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-sm font-bold text-slate-700">Numer umowy</span>
                <input
                  value={form.contractNumber}
                  onChange={(event) => updateField("contractNumber", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm font-bold outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Miejscowość podpisania umowy</span>
                <input
                  value={form.contractPlace}
                  onChange={(event) => updateField("contractPlace", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Data podpisania umowy</span>
                <input
                  type="date"
                  value={form.contractDate}
                  onChange={(event) => {
                    const contractDate = event.target.value;
                    setForm((current) => ({
                      ...current,
                      contractDate,
                      depositDueDate:
                        current.paymentMethod === "gotówka" || current.paymentMethod === "cash"
                          ? addDaysLocalDate(
                              contractDate,
                              current.contractSigningLocation === "unscheduled_home_visit" ? 30 : 14
                            )
                          : current.depositDueDate,
                    }));
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                />
              </label>

              {customPaymentSchedule.enabled ? (
                <div className="md:col-span-2 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-sm font-black text-violet-950">Niestandardowy harmonogram płatności</p>
                  <p className="mt-1 text-xs font-medium text-violet-700">
                    Te transze zostaną umieszczone w paragrafie płatności umowy.
                  </p>
                  <ol className="mt-3 space-y-2 text-sm text-violet-950">
                    {customPaymentSchedule.installments.map((installment, index) => (
                      <li key={installment.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-violet-100">
                        <span className="mr-2 font-black">{index + 1}.</span>
                        {formatCustomPaymentInstallment(installment)}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Termin płatności zaliczki</span>
                  <input
                    type="date"
                    value={form.depositDueDate}
                    onChange={(event) => updateField("depositDueDate", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  />
                </label>
              )}

              <label className="block md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Sposób i okoliczności zawarcia umowy
                </span>
                <select
                  value={form.contractSigningLocation}
                  onChange={(event) => {
                    const contractSigningLocation = event.target.value;
                    setForm((current) => ({
                      ...current,
                      contractSigningLocation,
                      meetingAgreedDate:
                        contractSigningLocation === "unscheduled_home_visit" ||
                        contractSigningLocation === "distance"
                          ? ""
                          : current.meetingAgreedDate,
                      realizationVariant:
                        contractSigningLocation === "business_premises"
                          ? ""
                          : current.realizationVariant,
                      depositDueDate:
                        current.paymentMethod === "gotówka" || current.paymentMethod === "cash"
                          ? addDaysLocalDate(
                              current.contractDate,
                              contractSigningLocation === "unscheduled_home_visit" ? 30 : 14
                            )
                          : current.depositDueDate,
                    }));
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                >
                  <option value="">Wybierz</option>
                  <option value="business_premises">w lokalu przedsiębiorstwa Wykonawcy</option>
                  <option value="scheduled_home_visit">
                    poza lokalem podczas wcześniej umówionej wizyty u Klienta
                  </option>
                  <option value="unscheduled_home_visit">
                    poza lokalem podczas nie umówionej wcześniej wizyty u Klienta
                  </option>
                  <option value="distance">
                    na odległość, bez jednoczesnej fizycznej obecności Stron
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Kiedy zostało umówione spotkanie</span>
                <input
                  type="date"
                  value={form.meetingAgreedDate}
                  onChange={(event) => updateField("meetingAgreedDate", event.target.value)}
                  disabled={
                    form.contractSigningLocation === "unscheduled_home_visit" ||
                    form.contractSigningLocation === "distance"
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none disabled:bg-slate-100 focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                />
              </label>

              {form.contractSigningLocation && form.contractSigningLocation !== "business_premises" && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Rozpoczęcie odpłatnych usług</span>
                  <select
                    value={form.realizationVariant}
                    onChange={(event) => updateField("realizationVariant", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  >
                    <option value="">Wybierz</option>
                    <option value="1A">
                      Żądam rozpoczęcia przed upływem {form.contractSigningLocation === "unscheduled_home_visit" ? 30 : 14} dni
                    </option>
                    <option value="1B">
                      Nie żądam wcześniejszego rozpoczęcia — po {form.contractSigningLocation === "unscheduled_home_visit" ? 30 : 14} dniach
                    </option>
                  </select>
                </label>
              )}

              {form.contractSigningLocation && form.contractSigningLocation !== "business_premises" && (
                <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                  <p className="font-black">
                    Termin odstąpienia: {form.contractSigningLocation === "unscheduled_home_visit" ? 30 : 14} dni
                  </p>
                  <p className="mt-1 text-xs font-medium">
                    {customPaymentSchedule.enabled
                      ? "Termin realizacji instalacji wynosi do 30 dni od zaksięgowania ostatniej transzy wymaganej przed rozpoczęciem montażu, a jeżeli harmonogram jej nie przewiduje — od podpisania umowy."
                      : "Termin realizacji instalacji jest odrębny: do 30 dni od zaksięgowania prawidłowo należnej zaliczki."}
                  </p>
                  {form.contractSigningLocation === "unscheduled_home_visit" && (
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      {customPaymentSchedule.enabled
                        ? "Przy wizycie nieumówionej żadna płatność nie może zostać pobrana przed upływem terminu odstąpienia."
                        : "Przy wizycie nieumówionej zaliczka nie może zostać pobrana przed upływem terminu odstąpienia."}
                    </p>
                  )}
                </div>
              )}

              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Zgody marketingowe i wizerunkowe</p>
                <p className="mt-1 text-xs text-slate-500">
                  Zgody trafiają do Załącznika nr 3 umowy.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.client1MarketingEmail}
                      onChange={(event) => updateBooleanField("client1MarketingEmail", event.target.checked)}
                    />
                    Klient 1 — email marketingowy
                  </label>

                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.client1MarketingPhone}
                      onChange={(event) => updateBooleanField("client1MarketingPhone", event.target.checked)}
                    />
                    Klient 1 — kontakt telefoniczny
                  </label>

                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.client1PhotoConsent}
                      onChange={(event) => updateBooleanField("client1PhotoConsent", event.target.checked)}
                    />
                    Klient 1 — zdjęcia realizacji
                  </label>
                </div>

                {hasSecondClient && (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.client2MarketingEmail}
                        onChange={(event) => updateBooleanField("client2MarketingEmail", event.target.checked)}
                      />
                      Klient 2 — email marketingowy
                    </label>

                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.client2MarketingPhone}
                        onChange={(event) => updateBooleanField("client2MarketingPhone", event.target.checked)}
                      />
                      Klient 2 — kontakt telefoniczny
                    </label>

                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.client2PhotoConsent}
                        onChange={(event) => updateBooleanField("client2PhotoConsent", event.target.checked)}
                      />
                      Klient 2 — zdjęcia realizacji
                    </label>
                  </div>
                )}
              </div>

              {!customPaymentSchedule.enabled ? (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Zaliczka</span>
                  <input
                    readOnly
                    value={form.depositAmount}
                    onChange={(event) => updateField("depositAmount", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm text-slate-500 outline-none"
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Całkowita wartość brutto</span>
                <input
                  readOnly
                  value={form.totalGross}
                  onChange={(event) => updateField("totalGross", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm text-slate-500 outline-none"
                />
              </label>
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Rozpiska cen do §3 umowy</p>
                <p className="mt-1 text-xs text-slate-500">
                  Podgląd historycznych wartości zapisanych w sprzedaży. PDF używa kolumn brutto przed i po rabacie.
                </p>

                <div className="mt-4 space-y-3">
                  {[
                    {
                      label: "Instalacja fotowoltaiczna wraz z montażem",
                      net: form.pvNetAfterDiscount,
                      before: form.pvGrossBeforeDiscount,
                      after: form.pvGrossAfterDiscount,
                    },
                    {
                      label: "Magazyn energii wraz z montażem",
                      net: form.storageNetAfterDiscount,
                      before: form.storageGrossBeforeDiscount,
                      after: form.storageGrossAfterDiscount,
                    },
                    {
                      label: "Inwerter",
                      net: form.inverterNetAfterDiscount,
                      before: form.inverterGrossBeforeDiscount,
                      after: form.inverterGrossAfterDiscount,
                    },
                    {
                      label: "Usługi dodatkowe",
                      net: form.additionalServicesNetAfterDiscount,
                      before: form.additionalServicesGrossBeforeDiscount,
                      after: form.additionalServicesGrossAfterDiscount,
                    },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-black leading-snug text-slate-950">{row.label}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Netto po rabacie</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{row.net || "Brak danych"}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Brutto przed rabatem</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{row.before || "Brak danych"}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
                          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Brutto po rabacie</p>
                          <p className="mt-1 text-sm font-black text-emerald-800">{row.after || "Brak danych"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="technical-survey-title">
          <h2 id="technical-survey-title" className="sr-only">
            Ankieta techniczna i zdjęcia
          </h2>
          <TechnicalSurveyForm
            value={technicalSurvey}
            onChange={setTechnicalSurvey}
            onSave={saveTechnicalSurvey}
            onPhotoUpload={uploadTechnicalSurveyPhotos}
            saving={technicalSurveySaving}
            uploadingCategory={technicalSurveyUploadingCategory}
            status={technicalSurveyStatus}
          />
        </section>

        <div className="flex flex-col items-end gap-3">
          {hasIdeaSignSendAccess && (
            <section className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M7.5 3.75h6.25L18 8v12.25H7.5z" />
                      <path d="M13.5 3.75V8H18M10 12h5M10 15.5h5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-950">Opcjonalny Załącznik nr 5</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                        PDF · do 50 MB
                      </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                      Dodany dokument otrzyma własny SHA-256 i osobną akceptację klienta. W obsługiwanym wzorze
                      naniesiemy dane klienta, numer oraz datę umowy przed zamrożeniem pakietu.
                    </p>
                  </div>
                </div>

                {!ideaSignAttachmentFiveLocked && (
                  <label className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-black transition ${
                    ideaSignAttachmentFiveBusy
                      ? "cursor-wait border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50"
                  }`}>
                    {ideaSignAttachmentFiveBusy
                      ? "Przetwarzam…"
                      : ideaSignAttachmentFive
                        ? "Zastąp PDF"
                        : "Dodaj PDF"}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={ideaSignAttachmentFiveBusy}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void uploadIdeaSignAttachmentFive(file);
                      }}
                    />
                  </label>
                )}
              </div>

              {ideaSignAttachmentFive && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{ideaSignAttachmentFive.fileName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatFileSize(ideaSignAttachmentFive.fileSize)} · zostanie dołączony po Załączniku nr 3
                      </p>
                    </div>
                    {ideaSignAttachmentFiveLocked ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700">
                        zamrożony w procesie
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void removeIdeaSignAttachmentFive()}
                        disabled={ideaSignAttachmentFiveBusy}
                        className="rounded-xl px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-45"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              )}

              {ideaSignAttachmentFiveStatus && (
                <div className="border-t border-slate-100 px-6 py-3 text-xs font-semibold text-slate-600" role="status">
                  {ideaSignAttachmentFiveStatus}
                </div>
              )}
            </section>
          )}
          {ideaSignStatus && (
            <div
              role="status"
              className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-bold text-sky-900"
            >
              {ideaSignStatus}
            </div>
          )}
          {offerorAuthorization && (
            <div className="w-full rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Autoryzacja oferty przez handlowca
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">
                    Wpisz kod SMS, aby wysłać linki klientom
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Kod został wysłany na {offerorAuthorization.phoneMasked}. Potwierdza dokładnie
                    zamrożoną wersję dokumentów w transakcji {offerorAuthorization.transactionId}.
                  </p>
                  {offerorDemoCode && (
                    <p className="mt-2 text-xs font-black text-amber-700">
                      Tryb lokalny — kod testowy: {offerorDemoCode}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                  linki jeszcze niewysłane
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <input
                  value={offerorOtp}
                  onChange={(event) => setOfferorOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void authorizeIdeaSignOffer();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Kod SMS handlowca"
                  placeholder="000000"
                  className="h-12 w-44 rounded-xl border border-slate-300 px-4 text-center font-mono text-xl font-black tracking-[0.35em] text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => void authorizeIdeaSignOffer()}
                  disabled={authorizingIdeaSign || !/^\d{6}$/.test(offerorOtp)}
                  className="h-12 rounded-xl bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {authorizingIdeaSign ? "Autoryzuję…" : "Autoryzuj i wyślij klientom"}
                </button>
                <button
                  type="button"
                  onClick={() => void resendOfferorOtp()}
                  disabled={resendingOfferorOtp}
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                >
                  {resendingOfferorOtp ? "Wysyłam…" : "Wyślij nowy kod"}
                </button>
              </div>
            </div>
          )}
          {localIdeaSignLinks.length > 0 && (
            <div className="w-full rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Lokalny test IdeaSign</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {localIdeaSignDeliveryMode === "live" ? (
                      <>Link wysłano e-mailem, a kody będą wysyłane SMS-em na zapisany numer.</>
                    ) : (
                      <>
                        Wiadomości nie zostały wysłane. Kod dla obu etapów:{" "}
                        <strong>{localIdeaSignDemoOtp || "482913"}</strong>
                      </>
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
                  tylko localhost
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {localIdeaSignLinks.map((link) => (
                  <a
                    key={`${link.signerOrder}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-800"
                  >
                    Otwórz jako klient {link.signerOrder}: {link.signerName}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={generatePdf}
            className="rounded-2xl bg-[#119182] px-7 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#0f7f72]"
          >
            Pobierz PDF
          </button>
          {hasIdeaSignSendAccess && (
            <button
              type="button"
              onClick={() => void sendToIdeaSign()}
              disabled={sendingIdeaSign || Boolean(offerorAuthorization) || !isIdeaSignContractSigningLocation(form.contractSigningLocation)}
              title={
                isIdeaSignContractSigningLocation(form.contractSigningLocation)
                  ? "Prześlij zatwierdzoną wersję umowy do IdeaSign"
                  : "Najpierw wybierz sposób i okoliczności zawarcia umowy"
              }
              className="group inline-flex items-center gap-3 rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-3 text-left text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-md dark:shadow-black/30 dark:hover:shadow-black/40 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45 disabled:hover:translate-y-0"
            >
              <span className="relative h-10 w-10 shrink-0">
                <Image
                  src="/images/ideasign-logo.png"
                  alt=""
                  fill
                  sizes="40px"
                  className="object-contain object-center"
                />
              </span>
              <span>
                <span className="block">Prześlij do IdeaSign</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-slate-300">
                  Bezpieczne zawarcie elektroniczne
                </span>
              </span>
            </button>
          )}
          </div>
          {hasIdeaSignSendAccess && !isIdeaSignContractSigningLocation(form.contractSigningLocation) && (
            <p className="text-right text-xs font-semibold text-amber-700">
              Przed wysłaniem do IdeaSign wybierz rzeczywisty sposób i okoliczności zawarcia umowy.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
