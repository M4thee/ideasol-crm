"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SaleSmsTemplate,
  SaleSmsTemplateType,
  SmsTemplateCategory,
} from "@/lib/saleSms";
import { supabase } from "@/lib/supabase";

type ClientSmsCategory = Exclude<SmsTemplateCategory, "sale">;

type SmsHistoryItem = {
  id: string;
  message: string;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

type ClientSmsData = {
  clientName: string;
  recipientPhone: string;
  templates: SaleSmsTemplate[];
  templateSentCounts: Record<SaleSmsTemplateType, number>;
  history: SmsHistoryItem[];
};

const CATEGORY_LABELS: Record<ClientSmsCategory, string> = {
  marketing: "marketingowych",
  relationship: "relacyjnych",
};

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

export default function ClientSmsPanel({
  clientId,
  category,
}: {
  clientId: string;
  category: ClientSmsCategory;
}) {
  const [data, setData] = useState<ClientSmsData | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<
    SaleSmsTemplateType | ""
  >("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [sendingType, setSendingType] = useState<SaleSmsTemplateType | null>(null);

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

      const response = await fetch(
        `/api/clients/${clientId}/sms?category=${category}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nie udało się pobrać Modułu SMS.");
      }

      setData(result.data as ClientSmsData);
      setSelectedTemplateType("");
    } catch (error) {
      setData(null);
      setStatus(
        error instanceof Error ? error.message : "Nie udało się pobrać Modułu SMS."
      );
    } finally {
      setLoading(false);
    }
  }, [category, clientId, getAccessToken]);

  useEffect(() => {
    // Pobranie danych jest jedynym efektem wejścia do wybranej kategorii SMS.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModule();
  }, [loadModule]);

  async function sendSms(template: SaleSmsTemplate) {
    if (!window.confirm("Czy na pewno chcesz wysłać SMS?")) return;

    setSendingType(template.type);
    setStatus("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch(`/api/clients/${clientId}/sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category, templateType: template.type }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nie udało się wysłać SMS-a.");
      }

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
    return (
      <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
        Ładowanie Modułu SMS...
      </div>
    );
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-lg font-black text-slate-950">SMS do klienta</h3>
        <p className="mt-1 text-sm text-slate-600">
          {data.clientName || "Klient"} · numer z karty klienta:{" "}
          <span className="font-bold">{data.recipientPhone || "brak numeru"}</span>
        </p>
      </div>

      {status ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {status}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {data.templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            Brak aktywnych szablonów {CATEGORY_LABELS[category]}. Administrator może
            dodać je w Panelu administratora → Moduł SMS.
          </div>
        ) : (
          <>
            <label
              className="block text-sm font-black text-slate-900"
              htmlFor="client-sms-template"
            >
              Wiadomość SMS
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Licznik obejmuje wiadomości tego szablonu wysłane do tego klienta.
            </p>
            <select
              id="client-sms-template"
              value={selectedTemplateType}
              onChange={(event) => setSelectedTemplateType(event.target.value)}
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

            {selectedTemplate ? (
              <section
                className={`mt-5 rounded-2xl border p-5 ${templateCardClass(
                  selectedTemplate.tone
                )}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black text-slate-950">
                      {selectedTemplate.title}
                    </h4>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Wysłano do klienta:{" "}
                      {data.templateSentCounts[selectedTemplate.type] || 0}
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
                      !data.recipientPhone
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
          </>
        )}
      </div>

      <div>
        <h4 className="font-black text-slate-950">Historia wiadomości</h4>
        <div className="mt-3 space-y-2">
          {data.history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Brak wiadomości z tej kategorii.
            </p>
          ) : (
            data.history.map((item) => (
              <details
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-bold text-slate-800">
                  {statusLabel(item.status)} ·{" "}
                  {new Date(item.sent_at || item.created_at).toLocaleString("pl-PL")}
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                  {item.message}
                </p>
                {item.error_message ? (
                  <p className="mt-2 text-sm font-semibold text-red-700">
                    {item.error_message}
                  </p>
                ) : null}
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
