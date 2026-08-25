"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizePpe, OSD_OPTIONS, validatePpe, type OsdOperator } from "@/lib/ppeValidation";
import { getSaleInstallationCount } from "@/lib/installationCount";

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
  const [error, setError] = useState("");
  const [saleNumber, setSaleNumber] = useState("");
  const [installationCount, setInstallationCount] = useState(1);
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

  useEffect(() => {
    loadContractData();
  }, [saleId]);

  async function loadContractData() {
    setLoading(true);
    setError("");

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .maybeSingle();

    if (saleError || !sale) {
      console.error("Błąd ładowania sprzedaży do umowy:", saleError);
      setError("Nie udało się załadować danych sprzedaży.");
      setLoading(false);
      return;
    }

    let client: Record<string, any> | null = null;

    if (sale.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", sale.client_id)
        .maybeSingle();

      client = clientData;
    }

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

    setSaleNumber(contractNumber);
    setInstallationCount(getSaleInstallationCount(sale));
    setForm({
      clientName:
        customerData.full_name ||
        customerData.name ||
        sale.customer_name ||
        sale.client_name ||
        client?.full_name ||
        client?.company_name ||
        "",
      pesel: customerData.pesel || sale.customer_pesel || client?.pesel || "",
      phone: customerData.phone || sale.customer_phone || client?.phone || "",
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

    setLoading(false);
  }

  function updateField(field: keyof ContractForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBooleanField(field: keyof ContractForm, value: boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function generatePdf() {
    setError("");

    const normalizedContractNumber = form.contractNumber.trim();

    if (!normalizedContractNumber) {
      setError("Uzupełnij numer umowy przed wygenerowaniem PDF.");
      return;
    }

    if (!form.propertyType) {
      setError("Wybierz rodzaj nieruchomości przed wygenerowaniem PDF.");
      return;
    }

    const usableArea = Number(form.usableAreaM2.replace(",", "."));

    if (!Number.isFinite(usableArea) || usableArea <= 0) {
      setError("Uzupełnij prawidłową powierzchnię użytkową nieruchomości.");
      return;
    }

    if (!form.contractSigningLocation) {
      setError("Wybierz, gdzie i w jakich okolicznościach podpisano umowę.");
      return;
    }

    if (form.contractSigningLocation === "scheduled_home_visit" && !form.meetingAgreedDate) {
      setError("Uzupełnij datę, kiedy zostało umówione spotkanie.");
      return;
    }

    if (form.contractSigningLocation !== "business_premises" && !form.realizationVariant) {
      setError("Uzupełnij moment rozpoczęcia odpłatnych usług.");
      return;
    }

    if (!form.client1MeterOwner && !form.client2MeterOwner) {
      setError("Zaznacz co najmniej jednego właściciela licznika.");
      return;
    }

    if (form.client2MeterOwner && (!form.secondClientName.trim() || !form.secondClientPesel.trim())) {
      setError("Uzupełnij dane klienta 2, jeżeli jest właścicielem licznika.");
      return;
    }

    if (!form.osdOperator) {
      setError("Wybierz operatora OSD.");
      return;
    }

    const ppeError =
      installationCount <= 1 || form.ppeNumber.trim()
        ? validatePpe(form.ppeNumber, form.osdOperator)
        : "";

    if (ppeError) {
      setError(ppeError);
      return;
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
      return;
    }

    if (existingContract) {
      setError("Umowa o wskazanym numerze istnieje w systemie.");
      return;
    }
    const query = new URLSearchParams({
      clientName: form.clientName,
      pesel: form.pesel,
      phone: form.phone,
      email: form.email,
      contractAddress: form.contractAddress,
      correspondenceAddress: form.correspondenceAddress,
      installationAddress: form.installationAddress,
      propertyType: form.propertyType,
      usableAreaM2: form.usableAreaM2,
      contractNumber: normalizedContractNumber,
      secondClientName: form.secondClientName,
      secondClientPesel: form.secondClientPesel,
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

    window.open(`/sales/${saleId}/contract-pdf?${query.toString()}`, "_blank");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <p className="text-slate-500">Ładowanie danych do umowy...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          {error}
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
              <p className="text-sm font-black text-slate-900">Drugi klient na umowie</p>
              <p className="mt-1 text-xs text-slate-500">
                Uzupełnij tylko wtedy, gdy umowa ma być zawarta z dwiema osobami.
              </p>

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
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
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

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Termin płatności zaliczki</span>
                <input
                  type="date"
                  value={form.depositDueDate}
                  onChange={(event) => updateField("depositDueDate", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-bold text-slate-700">Gdzie podpisano umowę</span>
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
                  <option value="distance">na odległość, poza lokalem przedsiębiorcy</option>
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
                    Termin realizacji instalacji jest odrębny: do 30 dni od zaksięgowania prawidłowo należnej zaliczki.
                  </p>
                  {form.contractSigningLocation === "unscheduled_home_visit" && (
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      Przy wizycie nieumówionej zaliczka nie może zostać pobrana przed upływem terminu odstąpienia.
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

                {(form.secondClientName.trim() || form.secondClientPesel.trim()) && (
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

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Zaliczka</span>
                <input
                  readOnly
                  value={form.depositAmount}
                  onChange={(event) => updateField("depositAmount", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm text-slate-500 outline-none"
                />
              </label>

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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={generatePdf}
            className="rounded-2xl bg-[#119182] px-7 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#0f7f72]"
          >
            Generuj PDF umowy
          </button>
        </div>
      </div>
    </main>
  );
}
