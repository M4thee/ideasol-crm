"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SaleSmsTemplate, SaleSmsTemplateType } from "@/lib/saleSms";

type Payment = {
  id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  created_at: string;
};

type SmsHistoryItem = {
  id: string;
  message_type: string;
  message: string;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

type SmsModuleData = {
  recipientPhones: {
    sale: string;
    client: string;
  };
  contractNumber: string;
  contractValue: number | null;
  depositAmount: number | null;
  paidTotal: number;
  outstandingAmount: number | null;
  installationDate: string | null;
  installationTime: string | null;
  installer: { company_name?: string | null } | null;
  payments: Payment[];
  templates: SaleSmsTemplate[];
  templateSentCounts: Record<SaleSmsTemplateType, number>;
  history: SmsHistoryItem[];
};

type SmsRecipientSource = "sale" | "client";

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Brak danych";
  return `${value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

function templateCardClass(tone: SaleSmsTemplate["tone"]) {
  if (tone === "danger") return "border-red-200 bg-red-50";
  if (tone === "warning") return "border-amber-200 bg-amber-50";
  return "border-slate-200 bg-white";
}

function statusLabel(status: string) {
  if (status === "sent") return "Wysłano";
  if (status === "failed") return "Błąd";
  return "Oczekuje";
}

export default function SaleSmsPanel({ saleId }: { saleId: string }) {
  const [data, setData] = useState<SmsModuleData | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<
    SaleSmsTemplateType | ""
  >("");
  const [recipientSource, setRecipientSource] = useState<
    SmsRecipientSource | ""
  >("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [sendingType, setSendingType] = useState<SaleSmsTemplateType | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadModule = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch(`/api/sales/${saleId}/sms`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Nie udało się pobrać modułu SMS.");

      const moduleData = result.data as SmsModuleData;
      setData(moduleData);
      setRecipientSource("");
    } catch (error) {
      setData(null);
      setStatus(error instanceof Error ? error.message : "Nie udało się pobrać modułu SMS.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, saleId]);

  useEffect(() => {
    // Pobranie danych jest jedynym efektem wejścia na kartę modułu SMS.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModule();
  }, [loadModule]);

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPayment(true);
    setStatus("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch(`/api/sales/${saleId}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paymentAmount,
          paidAt: paymentDate,
          note: paymentNote,
        }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać wpłaty.");

      setPaymentAmount("");
      setPaymentNote("");
      setShowPaymentForm(false);
      await loadModule();
      setStatus("Wpłata klienta została zapisana, a saldo przeliczone.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się zapisać wpłaty.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function sendSms(template: SaleSmsTemplate) {
    if (!window.confirm("Czy na pewno chcesz wysłać SMS?")) return;

    setSendingType(template.type);
    setStatus("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch(`/api/sales/${saleId}/sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateType: template.type,
          recipientSource,
        }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Nie udało się wysłać SMS-a.");

      await loadModule();
      setStatus(
        result.testMode
          ? `SMS testowy wysłano na numer ${result.actualRecipientPhone}.`
          : "SMS został wysłany do klienta."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się wysłać SMS-a.");
    } finally {
      setSendingType(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Ładowanie modułu SMS...</div>;
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        {status || "Moduł SMS jest niedostępny."}
      </div>
    );
  }

  const selectedTemplate = data.templates.find(
    (template) => template.type === selectedTemplateType
  );
  const selectedRecipientPhone = recipientSource
    ? data.recipientPhones[recipientSource]
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">SMS do klienta</h3>
          <p className="mt-1 text-sm text-slate-600">
            Umowa: <span className="font-bold">{data.contractNumber || "brak numeru"}</span>
            {selectedRecipientPhone ? (
              <>
                {" "}· numer docelowy: <span className="font-bold">{selectedRecipientPhone}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPaymentForm((current) => !current)}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
        >
          {showPaymentForm ? "Anuluj dodawanie" : "Dodaj wpłatę klienta"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Wartość umowy", formatMoney(data.contractValue)],
          ["Zaliczka", formatMoney(data.depositAmount)],
          ["Wpłacono", formatMoney(data.paidTotal)],
          ["Pozostało", formatMoney(data.outstandingAmount)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {showPaymentForm ? (
        <form onSubmit={addPayment} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h4 className="font-black text-emerald-950">Nowa wpłata klienta</h4>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-slate-700">
              Kwota wpłaty *
              <input
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="np. 5000,00"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Data wpłaty *
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Notatka
              <input
                type="text"
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                maxLength={500}
                placeholder="np. przelew bankowy"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={savingPayment}
            className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {savingPayment ? "Zapisywanie..." : "Zapisz wpłatę"}
          </button>
        </form>
      ) : null}

      {status ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {status}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="block text-sm font-black text-slate-900" htmlFor="sale-sms-recipient">
              Numer odbiorcy
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Wybierz numer zapisany na sprzedaży albo aktualny numer z karty klienta.
            </p>
            <select
              id="sale-sms-recipient"
              value={recipientSource}
              onChange={(event) =>
                setRecipientSource(event.target.value as SmsRecipientSource | "")
              }
              disabled={sendingType !== null}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
            >
              <option value="">Wybierz numer odbiorcy...</option>
              <option value="sale" disabled={!data.recipientPhones.sale}>
                Ze sprzedaży — {data.recipientPhones.sale || "brak numeru"}
              </option>
              <option value="client" disabled={!data.recipientPhones.client}>
                Z karty klienta — {data.recipientPhones.client || "brak numeru"}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-black text-slate-900" htmlFor="sale-sms-template">
              Wiadomość SMS
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Licznik obejmuje wiadomości tego szablonu wysłane do tego klienta.
            </p>
            <select
              id="sale-sms-template"
              value={selectedTemplateType}
              onChange={(event) =>
                setSelectedTemplateType(event.target.value as SaleSmsTemplateType | "")
              }
              disabled={sendingType !== null}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
            >
              <option value="">Wybierz rodzaj wiadomości...</option>
              {data.templates.map((template) => (
                <option key={template.type} value={template.type}>
                  {template.title} — wysłano: {data.templateSentCounts[template.type] || 0}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedTemplate ? (
          <section
            className={`mt-5 rounded-2xl border p-5 ${templateCardClass(selectedTemplate.tone)}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="font-black text-slate-950">{selectedTemplate.title}</h4>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Wysłano do klienta: {data.templateSentCounts[selectedTemplate.type] || 0}
                </p>
                {!selectedTemplate.enabled ? (
                  <p className="mt-2 text-sm font-semibold text-red-700">
                    {selectedTemplate.reason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void sendSms(selectedTemplate)}
                disabled={
                  !selectedTemplate.enabled ||
                  sendingType !== null ||
                  !selectedRecipientPhone
                }
                className={`rounded-xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${
                  selectedTemplate.tone === "danger"
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-slate-900 hover:bg-slate-700"
                }`}
              >
                {sendingType === selectedTemplate.type ? "Wysyłanie..." : "Wyślij SMS"}
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Treść wiadomości — tylko do odczytu
              </p>
              <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed text-slate-800">
                {selectedTemplate.message}
              </div>
              <p className="mt-2 text-right text-xs text-slate-400">
                {selectedTemplate.message.length} znaków
              </p>
            </div>
          </section>
        ) : null}
      </div>

      <div>
        <h4 className="font-black text-slate-950">Zarejestrowane wpłaty</h4>
        <div className="mt-3 space-y-2">
          {data.payments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Brak zapisanych wpłat.</p>
          ) : (
            data.payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-bold text-slate-900">{formatMoney(Number(payment.amount))}</span>
                <span className="text-sm text-slate-500">
                  {new Date(`${payment.paid_at}T00:00:00`).toLocaleDateString("pl-PL")}
                  {payment.note ? ` · ${payment.note}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h4 className="font-black text-slate-950">Historia wiadomości</h4>
        <div className="mt-3 space-y-2">
          {data.history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Brak wysłanych wiadomości.</p>
          ) : (
            data.history.map((item) => (
              <details key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">
                  {statusLabel(item.status)} · {new Date(item.sent_at || item.created_at).toLocaleString("pl-PL")}
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.message}</p>
                {item.error_message ? <p className="mt-2 text-sm font-semibold text-red-700">{item.error_message}</p> : null}
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
