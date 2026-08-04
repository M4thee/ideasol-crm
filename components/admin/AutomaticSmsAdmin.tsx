"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSmsAutomationTimingLabel,
  getSmsAutomationVariables,
  type SmsAutomation,
  type SmsAutomationTrigger,
} from "@/lib/automaticSms";
import { supabase } from "@/lib/supabase";

type TimeUnit = "minutes" | "hours" | "days";

type AutomationForm = {
  title: string;
  triggerType: SmsAutomationTrigger;
  messageTemplate: string;
  offsetValue: string;
  offsetUnit: TimeUnit;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: AutomationForm = {
  title: "",
  triggerType: "before_meeting",
  messageTemplate: "",
  offsetValue: "24",
  offsetUnit: "hours",
  isActive: true,
  sortOrder: "100",
};

const TRIGGER_LABELS: Record<SmsAutomationTrigger, string> = {
  meeting_created: "Po utworzeniu spotkania",
  before_meeting: "Przed terminem spotkania",
  before_installation: "Przed terminem montażu",
};

const UNIT_LABELS: Record<TimeUnit, string> = {
  minutes: "minut",
  hours: "godzin",
  days: "dni",
};

function offsetToForm(offsetMinutes: number) {
  if (offsetMinutes % 1440 === 0) {
    return { offsetValue: String(offsetMinutes / 1440), offsetUnit: "days" as const };
  }
  if (offsetMinutes % 60 === 0) {
    return { offsetValue: String(offsetMinutes / 60), offsetUnit: "hours" as const };
  }
  return { offsetValue: String(offsetMinutes), offsetUnit: "minutes" as const };
}

function toForm(automation: SmsAutomation): AutomationForm {
  return {
    title: automation.title,
    triggerType: automation.trigger_type,
    messageTemplate: automation.message_template,
    ...offsetToForm(automation.offset_minutes),
    isActive: automation.is_active,
    sortOrder: String(automation.sort_order),
  };
}

function toOffsetMinutes(form: AutomationForm) {
  if (form.triggerType === "meeting_created") return 0;
  const value = Number(form.offsetValue || 0);
  if (form.offsetUnit === "days") return value * 1440;
  if (form.offsetUnit === "hours") return value * 60;
  return value;
}

function AutomationFields({
  form,
  onChange,
}: {
  form: AutomationForm;
  onChange: (next: AutomationForm) => void;
}) {
  function appendVariable(key: string) {
    const separator = form.messageTemplate && !form.messageTemplate.endsWith(" ") ? " " : "";
    onChange({
      ...form,
      messageTemplate: `${form.messageTemplate}${separator}{{${key}}}`,
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_130px]">
        <label className="text-sm font-bold text-slate-700">
          Nazwa automatu *
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            maxLength={120}
            placeholder="np. Przypomnienie 2 godziny przed spotkaniem"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-blue-500"
          />
        </label>

        <label className="text-sm font-bold text-slate-700">
          Zdarzenie *
          <select
            value={form.triggerType}
            onChange={(event) =>
              onChange({
                ...form,
                triggerType: event.target.value as SmsAutomationTrigger,
              })
            }
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-blue-500"
          >
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-slate-700">
          Kolejność
          <input
            type="number"
            min="0"
            max="10000"
            value={form.sortOrder}
            onChange={(event) => onChange({ ...form, sortOrder: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-black text-blue-950">Kiedy wysłać</p>
        {form.triggerType === "meeting_created" ? (
          <p className="mt-2 text-sm font-semibold text-blue-800">
            Natychmiast po zapisaniu spotkania w CRM.
          </p>
        ) : (
          <div className="mt-3 flex max-w-md items-end gap-3">
            <label className="flex-1 text-sm font-bold text-blue-900">
              Ile wcześniej
              <input
                type="number"
                min="1"
                value={form.offsetValue}
                onChange={(event) => onChange({ ...form, offsetValue: event.target.value })}
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex-1 text-sm font-bold text-blue-900">
              Jednostka
              <select
                value={form.offsetUnit}
                onChange={(event) =>
                  onChange({ ...form, offsetUnit: event.target.value as TimeUnit })
                }
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-500"
              >
                {Object.entries(UNIT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-700">Treść wiadomości *</p>
          <p className="text-xs font-semibold text-slate-400">
            {form.messageTemplate.length}/1200 znaków
          </p>
        </div>
        <textarea
          value={form.messageTemplate}
          onChange={(event) => onChange({ ...form, messageTemplate: event.target.value })}
          maxLength={1200}
          rows={7}
          placeholder="Wpisz treść automatycznej wiadomości..."
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-950 outline-none focus:border-blue-500"
        />
        <p className="mt-2 text-xs text-slate-500">
          Polskie znaki są usuwane dopiero przy wysyłce, więc tutaj treść może pozostać czytelna.
        </p>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700">Wstaw dane z CRM</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {getSmsAutomationVariables(form.triggerType).map((variable) => (
            <button
              key={variable.key}
              type="button"
              onClick={() => appendVariable(variable.key)}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 transition hover:bg-blue-100"
            >
              + {variable.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-blue-700"
        />
        Automat aktywny
      </label>
    </div>
  );
}

export default function AutomaticSmsAdmin() {
  const [automations, setAutomations] = useState<SmsAutomation[]>([]);
  const [newForm, setNewForm] = useState<AutomationForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<AutomationForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      const response = await fetch("/api/admin/sms-automations", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się pobrać automatów SMS.");
      setAutomations((result.automations || []) as SmsAutomation[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się pobrać automatów SMS.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    // Pobranie danych jest jedynym efektem wejścia do sekcji automatów SMS.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAutomations();
  }, [loadAutomations]);

  async function saveAutomation(method: "POST" | "PATCH", form: AutomationForm, id?: string) {
    const token = await getAccessToken();
    if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    const response = await fetch("/api/admin/sms-automations", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        title: form.title,
        triggerType: form.triggerType,
        messageTemplate: form.messageTemplate,
        offsetMinutes: toOffsetMinutes(form),
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder || 100),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nie udało się zapisać automatu SMS.");
  }

  async function createAutomation() {
    setSaving(true);
    setStatus("");
    try {
      await saveAutomation("POST", newForm);
      setNewForm(EMPTY_FORM);
      setShowNewForm(false);
      await loadAutomations();
      setStatus("Automatyczna wiadomość została dodana.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się dodać automatu SMS.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAutomation(automation: SmsAutomation, form = editForm) {
    setSaving(true);
    setStatus("");
    try {
      await saveAutomation("PATCH", form, automation.id);
      setEditingId(null);
      await loadAutomations();
      setStatus("Automatyczna wiadomość została zapisana.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się zapisać automatu SMS.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAutomation(automation: SmsAutomation) {
    if (!window.confirm(`Czy na pewno usunąć automat „${automation.title}”?`)) return;
    setSaving(true);
    setStatus("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      const response = await fetch(`/api/admin/sms-automations?id=${automation.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się usunąć automatu SMS.");
      await loadAutomations();
      setStatus("Automatyczna wiadomość została usunięta.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się usunąć automatu SMS.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = automations.filter((automation) => automation.is_active).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-950">Globalne wiadomości automatyczne</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Wiadomości uruchamiane przez zdarzenia w CRM. Każdy aktywny automat wysyła osobny SMS tylko raz dla danego spotkania lub montażu.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            Aktywne automaty: {activeCount} z {automations.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNewForm((current) => !current);
            setStatus("");
          }}
          className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          {showNewForm ? "Anuluj dodawanie" : "Dodaj automat SMS"}
        </button>
      </div>

      {status ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {status}
        </div>
      ) : null}

      {showNewForm ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50/50 p-5">
          <h4 className="text-lg font-black text-slate-950">Nowa automatyczna wiadomość</h4>
          <div className="mt-5">
            <AutomationFields form={newForm} onChange={setNewForm} />
          </div>
          <button
            type="button"
            onClick={() => void createAutomation()}
            disabled={saving}
            className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Dodaj automat"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Ładowanie automatów SMS...
        </div>
      ) : null}

      {!loading && automations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Brak automatycznych wiadomości. Dodaj pierwszy automat.
        </div>
      ) : null}

      <div className="space-y-4">
        {automations.map((automation) => {
          const isEditing = editingId === automation.id;
          return (
            <article
              key={automation.id}
              className={`rounded-3xl border p-5 shadow-sm ${
                automation.is_active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-100 opacity-80"
              }`}
            >
              {isEditing ? (
                <>
                  <AutomationFields form={editForm} onChange={setEditForm} />
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateAutomation(automation)}
                      disabled={saving}
                      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                    >
                      Anuluj
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black text-slate-950">{automation.title}</h4>
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                          {TRIGGER_LABELS[automation.trigger_type]}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {automation.is_system ? "Systemowy" : "Własny"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${automation.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                          {automation.is_active ? "Aktywny" : "Nieaktywny"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        {getSmsAutomationTimingLabel(automation)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        Kolejność: {automation.sort_order}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(automation.id);
                          setEditForm(toForm(automation));
                          setStatus("");
                        }}
                        disabled={saving}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateAutomation(automation, { ...toForm(automation), isActive: !automation.is_active })}
                        disabled={saving}
                        className={`rounded-xl px-4 py-2 text-sm font-bold ${automation.is_active ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}
                      >
                        {automation.is_active ? "Dezaktywuj" : "Aktywuj"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAutomation(automation)}
                        disabled={saving}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-700">
                    {automation.message_template}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
