"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SYSTEM_SMS_TEMPLATE_REQUIRED_FIELDS,
  SMS_TEMPLATE_CATEGORIES,
  SMS_TEMPLATE_REQUIRED_FIELDS,
  SMS_TEMPLATE_TONES,
  SMS_TEMPLATE_VARIABLES,
  type SmsTemplateRequiredField,
  type SmsTemplateCategory,
  type SmsTemplateTone,
} from "@/lib/saleSms";
import { supabase } from "@/lib/supabase";

type SmsTemplate = {
  id: string;
  template_key: string;
  title: string;
  message_template: string;
  tone: SmsTemplateTone;
  category: SmsTemplateCategory;
  required_fields: SmsTemplateRequiredField[];
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SmsTemplateForm = {
  title: string;
  messageTemplate: string;
  tone: SmsTemplateTone;
  category: SmsTemplateCategory;
  requiredFields: SmsTemplateRequiredField[];
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: SmsTemplateForm = {
  title: "",
  messageTemplate: "",
  tone: "standard",
  category: "sale",
  requiredFields: [],
  isActive: true,
  sortOrder: "100",
};

const TONE_LABELS: Record<SmsTemplateTone, string> = {
  standard: "Standardowa",
  warning: "Ostrzeżenie",
  danger: "Pilna / windykacyjna",
};

const CATEGORY_LABELS: Record<SmsTemplateCategory, string> = {
  sale: "Do sprzedaży",
  marketing: "Marketingowy",
  relationship: "Relacyjny",
};

const CLIENT_TEMPLATE_VARIABLES = new Set(["client_name", "bank_account", "hotline"]);

function toForm(template: SmsTemplate): SmsTemplateForm {
  return {
    title: template.title,
    messageTemplate: template.message_template,
    tone: template.tone,
    category: template.category,
    requiredFields: template.required_fields || [],
    isActive: template.is_active,
    sortOrder: String(template.sort_order),
  };
}

function toneClassName(tone: SmsTemplateTone) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function TemplateFields({
  form,
  onChange,
  lockedRequiredFields = [],
}: {
  form: SmsTemplateForm;
  onChange: (next: SmsTemplateForm) => void;
  lockedRequiredFields?: SmsTemplateRequiredField[];
}) {
  function appendVariable(key: string) {
    const separator = form.messageTemplate && !form.messageTemplate.endsWith(" ") ? " " : "";
    onChange({
      ...form,
      messageTemplate: `${form.messageTemplate}${separator}{{${key}}}`,
    });
  }

  function toggleRequiredField(field: SmsTemplateRequiredField) {
    onChange({
      ...form,
      requiredFields: form.requiredFields.includes(field)
        ? form.requiredFields.filter((item) => item !== field)
        : [...form.requiredFields, field],
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_130px]">
        <label className="text-sm font-bold text-slate-700">
          Nazwa szablonu *
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            maxLength={120}
            placeholder="np. Informacja o zakończeniu montażu"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-fuchsia-500"
          />
        </label>

        <label className="text-sm font-bold text-slate-700">
          Kategoria SMS
          <select
            value={form.category}
            onChange={(event) => {
              const category = event.target.value as SmsTemplateCategory;
              onChange({
                  ...form,
                  category,
                  requiredFields:
                    category === "sale"
                      ? form.requiredFields
                      : form.requiredFields.filter((field) => field === "client_name"),
              });
            }}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-fuchsia-500"
          >
            {SMS_TEMPLATE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-slate-700">
          Rodzaj komunikatu
          <select
            value={form.tone}
            onChange={(event) =>
              onChange({ ...form, tone: event.target.value as SmsTemplateTone })
            }
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-fuchsia-500"
          >
            {SMS_TEMPLATE_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {TONE_LABELS[tone]}
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
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-fuchsia-500"
          />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-700">Treść wiadomości *</p>
          <p className="text-xs font-semibold text-slate-400">
            {form.messageTemplate.length}/1200 znaków przed uzupełnieniem danych
          </p>
        </div>
        <textarea
          value={form.messageTemplate}
          onChange={(event) =>
            onChange({ ...form, messageTemplate: event.target.value })
          }
          maxLength={1200}
          rows={7}
          placeholder="Wpisz treść i dodaj wybrane pola dynamiczne..."
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-950 outline-none focus:border-fuchsia-500"
        />
        <p className="mt-2 text-xs text-slate-500">
          Polskie znaki zostaną automatycznie usunięte przed wysłaniem. Użytkownik Modułu SMS zobaczy treść tylko do odczytu.
        </p>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700">Wstaw dane z CRM</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SMS_TEMPLATE_VARIABLES.filter(
            (variable) =>
              form.category === "sale" || CLIENT_TEMPLATE_VARIABLES.has(variable.key)
          ).map((variable) => (
            <button
              key={variable.key}
              type="button"
              onClick={() => appendVariable(variable.key)}
              title={`Przykład: ${variable.example}`}
              className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-800 transition hover:bg-fuchsia-100"
            >
              + {variable.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700">Kiedy blokować wysyłkę</p>
        <p className="mt-1 text-xs text-slate-500">
          Pola użyte bezpośrednio w treści są sprawdzane automatycznie. Poniżej możesz dodać dodatkowe warunki, nawet jeśli dana wartość nie występuje w wiadomości.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {SMS_TEMPLATE_REQUIRED_FIELDS.filter(
            (field) => form.category === "sale" || field.key === "client_name"
          ).map((field) => (
            <label
              key={field.key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
            >
              <input
                type="checkbox"
                checked={
                  form.requiredFields.includes(field.key) ||
                  lockedRequiredFields.includes(field.key)
                }
                onChange={() => toggleRequiredField(field.key)}
                disabled={lockedRequiredFields.includes(field.key)}
                className="h-4 w-4 rounded border-slate-300 text-fuchsia-700"
              />
              <span>
                {field.label}
                {lockedRequiredFields.includes(field.key) ? (
                  <span className="ml-1 text-xs text-slate-400">(systemowe)</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-fuchsia-700"
        />
        Szablon aktywny i widoczny w Module SMS
      </label>

      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
        {form.category === "sale"
          ? "Ten szablon wymaga wskazania sprzedaży lub umowy."
          : "Ten szablon można wysłać z karty dowolnego dostępnego klienta, bez wskazywania sprzedaży."}
      </p>
    </div>
  );
}

export default function SmsTemplatesAdmin() {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [newTemplate, setNewTemplate] = useState<SmsTemplateForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SmsTemplateForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch("/api/admin/sms-templates", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nie udało się pobrać szablonów SMS.");
      }

      setTemplates((result.templates || []) as SmsTemplate[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się pobrać szablonów SMS.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    // Pobranie danych jest jedynym efektem wejścia do sekcji szablonów SMS.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTemplates();
  }, [loadTemplates]);

  async function saveTemplate(method: "POST" | "PATCH", form: SmsTemplateForm, id?: string) {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

    const response = await fetch("/api/admin/sms-templates", {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        title: form.title,
        messageTemplate: form.messageTemplate,
        tone: form.tone,
        category: form.category,
        requiredFields: form.requiredFields,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder || 100),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Nie udało się zapisać szablonu SMS.");
    }
  }

  async function createTemplate() {
    setSaving(true);
    setStatus("");

    try {
      await saveTemplate("POST", newTemplate);
      setNewTemplate(EMPTY_FORM);
      setShowNewForm(false);
      await loadTemplates();
      setStatus("Nowy szablon SMS został dodany.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się dodać szablonu SMS.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTemplate(template: SmsTemplate, form = editForm) {
    setSaving(true);
    setStatus("");

    try {
      await saveTemplate("PATCH", form, template.id);
      setEditingId(null);
      await loadTemplates();
      setStatus("Szablon SMS został zapisany.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się zapisać szablonu SMS.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(template: SmsTemplate) {
    setEditingId(template.id);
    setEditForm(toForm(template));
    setStatus("");
  }

  const activeCount = templates.filter((template) => template.is_active).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Moduł SMS</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Zarządzaj gotowymi wiadomościami widocznymi w jednym Module SMS. Szablony sprzedażowe wymagają umowy, a marketingowe i relacyjne można wysłać bez sprzedaży.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            Aktywne szablony: {activeCount} z {templates.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNewForm((current) => !current);
            setStatus("");
          }}
          className="rounded-xl bg-fuchsia-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-900"
        >
          {showNewForm ? "Anuluj dodawanie" : "Dodaj szablon SMS"}
        </button>
      </div>

      {status ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {status}
        </div>
      ) : null}

      {showNewForm ? (
        <div className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50/60 p-5">
          <h3 className="text-lg font-black text-slate-950">Nowy szablon</h3>
          <div className="mt-5">
            <TemplateFields form={newTemplate} onChange={setNewTemplate} />
          </div>
          <button
            type="button"
            onClick={() => void createTemplate()}
            disabled={saving}
            className="mt-5 rounded-xl bg-fuchsia-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Dodaj szablon"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Ładowanie szablonów SMS...
        </div>
      ) : null}

      {!loading && templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Brak szablonów SMS. Dodaj pierwszy szablon.
        </div>
      ) : null}

      <div className="space-y-4">
        {templates.map((template) => {
          const isEditing = editingId === template.id;

          return (
            <article
              key={template.id}
              className={`rounded-3xl border p-5 shadow-sm ${
                template.is_active
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-100 opacity-80"
              }`}
            >
              {isEditing ? (
                <>
                  <TemplateFields
                    form={editForm}
                    onChange={setEditForm}
                    lockedRequiredFields={
                      template.is_system
                        ? SYSTEM_SMS_TEMPLATE_REQUIRED_FIELDS[template.template_key] || []
                        : []
                    }
                  />
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateTemplate(template)}
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
                        <h3 className="text-lg font-black text-slate-950">{template.title}</h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${toneClassName(
                            template.tone
                          )}`}
                        >
                          {TONE_LABELS[template.tone]}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {template.is_system ? "Systemowy" : "Własny"}
                        </span>
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                          {CATEGORY_LABELS[template.category]}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            template.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {template.is_active ? "Aktywny" : "Nieaktywny"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        Kolejność: {template.sort_order} · identyfikator: {template.template_key}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(template)}
                        disabled={saving}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void updateTemplate(template, {
                            ...toForm(template),
                            isActive: !template.is_active,
                          })
                        }
                        disabled={saving}
                        className={`rounded-xl px-4 py-2 text-sm font-bold ${
                          template.is_active
                            ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            : "bg-emerald-700 text-white hover:bg-emerald-800"
                        }`}
                      >
                        {template.is_active ? "Dezaktywuj" : "Aktywuj"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-700">
                    {template.message_template}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(template.required_fields || []).length > 0 ? (
                      template.required_fields.map((field) => {
                        const label = SMS_TEMPLATE_REQUIRED_FIELDS.find(
                          (item) => item.key === field
                        )?.label;
                        return (
                          <span
                            key={field}
                            className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
                          >
                            Wymaga: {label || field}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-400">Brak dodatkowych warunków wysyłki.</span>
                    )}
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
