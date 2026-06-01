"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ContractForm = {
  clientName: string;
  pesel: string;
  phone: string;
  email: string;
  contractAddress: string;
  correspondenceAddress: string;
  installationAddress: string;
  contractNumber: string;
  secondClientName: string;
  secondClientPesel: string;
  contractPlace: string;
  contractDate: string;
  depositDueDate: string;
  visitPreviouslyScheduled: string;
  realizationVariant: string;
  depositAmount: string;
  totalGross: string;
  pvNetAfterDiscount: string;
  pvGrossBeforeDiscount: string;
  pvGrossAfterDiscount: string;
  storageNetAfterDiscount: string;
  storageGrossBeforeDiscount: string;
  storageGrossAfterDiscount: string;
  emsNetAfterDiscount: string;
  emsGrossBeforeDiscount: string;
  emsGrossAfterDiscount: string;
  backupNetAfterDiscount: string;
  backupGrossBeforeDiscount: string;
  backupGrossAfterDiscount: string;
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
  const [form, setForm] = useState<ContractForm>({
    clientName: "",
    pesel: "",
    phone: "",
    email: "",
    contractAddress: "",
    correspondenceAddress: "",
    installationAddress: "",
    contractNumber: "",
    secondClientName: "",
    secondClientPesel: "",
    contractPlace: "",
    contractDate: todayLocalDate(),
    depositDueDate: "",
    visitPreviouslyScheduled: "",
    realizationVariant: "",
    depositAmount: "",
    totalGross: "",
    pvNetAfterDiscount: "",
    pvGrossBeforeDiscount: "",
    pvGrossAfterDiscount: "",
    storageNetAfterDiscount: "",
    storageGrossBeforeDiscount: "",
    storageGrossAfterDiscount: "",
    emsNetAfterDiscount: "",
    emsGrossBeforeDiscount: "",
    emsGrossAfterDiscount: "",
    backupNetAfterDiscount: "",
    backupGrossBeforeDiscount: "",
    backupGrossAfterDiscount: "",
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
      contractNumber,
      secondClientName: customerData.second_client_name || "",
      secondClientPesel: customerData.second_client_pesel || "",
      contractPlace: customerData.contract_place || "",
      contractDate: customerData.contract_date || todayLocalDate(),
      depositDueDate: customerData.deposit_due_date || "",
      visitPreviouslyScheduled:
        customerData.visit_previously_scheduled === true
          ? "true"
          : customerData.visit_previously_scheduled === false
            ? "false"
            : "",
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
      emsNetAfterDiscount: formatMoneyInput(customerData.contract_ems_net_after_discount),
      emsGrossBeforeDiscount: formatMoneyInput(customerData.contract_ems_gross_before_discount),
      emsGrossAfterDiscount: formatMoneyInput(customerData.contract_ems_gross_after_discount || customerData.contract_ems_gross),
      backupNetAfterDiscount: formatMoneyInput(customerData.contract_backup_net_after_discount),
      backupGrossBeforeDiscount: formatMoneyInput(customerData.contract_backup_gross_before_discount),
      backupGrossAfterDiscount: formatMoneyInput(customerData.contract_backup_gross_after_discount || customerData.contract_backup_gross),
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
      contractNumber: normalizedContractNumber,
      secondClientName: form.secondClientName,
      secondClientPesel: form.secondClientPesel,
      contractPlace: form.contractPlace,
      contractDate: form.contractDate,
      depositDueDate: form.depositDueDate,
      visitPreviouslyScheduled: form.visitPreviouslyScheduled,
      realizationVariant: form.realizationVariant,
      depositAmount: form.depositAmount,
      totalGross: form.totalGross,
      pvGrossBeforeDiscount: form.pvGrossBeforeDiscount,
      pvGrossAfterDiscount: form.pvGrossAfterDiscount,
      storageGrossBeforeDiscount: form.storageGrossBeforeDiscount,
      storageGrossAfterDiscount: form.storageGrossAfterDiscount,
      emsGrossBeforeDiscount: form.emsGrossBeforeDiscount,
      emsGrossAfterDiscount: form.emsGrossAfterDiscount,
      backupGrossBeforeDiscount: form.backupGrossBeforeDiscount,
      backupGrossAfterDiscount: form.backupGrossAfterDiscount,
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
                  onChange={(event) => updateField("contractDate", event.target.value)}
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

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Wizyta wcześniej umówiona</span>
                <select
                  value={form.visitPreviouslyScheduled}
                  onChange={(event) => updateField("visitPreviouslyScheduled", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                >
                  <option value="">Wybierz</option>
                  <option value="true">Tak</option>
                  <option value="false">Nie</option>
                </select>
              </label>

              {form.visitPreviouslyScheduled === "true" && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Wariant realizacji</span>
                  <select
                    value={form.realizationVariant}
                    onChange={(event) => updateField("realizationVariant", event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                  >
                    <option value="">Wybierz</option>
                    <option value="1A">Wariant 1A — start przed upływem 14 dni</option>
                    <option value="1B">Wariant 1B — start po upływie 14 dni</option>
                  </select>
                </label>
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
                      label: "System zarządzania energią (EMS)",
                      net: form.emsNetAfterDiscount,
                      before: form.emsGrossBeforeDiscount,
                      after: form.emsGrossAfterDiscount,
                    },
                    {
                      label: "Backup wraz z montażem",
                      net: form.backupNetAfterDiscount,
                      before: form.backupGrossBeforeDiscount,
                      after: form.backupGrossAfterDiscount,
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