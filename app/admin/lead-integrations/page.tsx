"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AssignmentRule = "random" | "postal_code" | "round_robin";

type Integration = {
  id: string;
  slug: string;
  name: string;
  source_type: string;
  campaign_name: string;
  external_form_id: string | null;
  is_active: boolean;
  assignment_rule: AssignmentRule;
  tag_names: string[];
  notify_assigned_user: boolean;
  notify_owners: boolean;
  participant_user_ids: string[];
};

type User = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type Tag = { name: string; color: string | null };

const RULES: Array<{
  value: AssignmentRule;
  title: string;
  description: string;
}> = [
  {
    value: "round_robin",
    title: "Na zmianę (po równo)",
    description: "Każdy kolejny lead trafia do następnej osoby z listy.",
  },
  {
    value: "random",
    title: "Losowo",
    description: "Każdy lead jest losowany pomiędzy wybranymi użytkownikami.",
  },
  {
    value: "postal_code",
    title: "Według kodu pocztowego",
    description:
      "Lead trafia do najbliższej wybranej osoby. Bez kodu lub dopasowania działa przydział na zmianę.",
  },
];

const ROLE_LABELS: Record<string, string> = {
  seller: "Sprzedawca",
  manager: "Manager",
  owner: "Właściciel",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function LeadIntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const isCreating = draft?.id === "";

  async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    }

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);

    return fetch(input, { ...init, headers });
  }

  useEffect(() => {
    void loadData();
    // Dane są pobierane raz przy wejściu do panelu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(preferredId?: string) {
    setLoading(true);
    setError("");

    try {
      const response = await authorizedFetch("/api/admin/lead-integrations", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "Nie udało się pobrać integracji.");

      setIntegrations(payload.integrations ?? []);
      setUsers(payload.users ?? []);
      setTags(payload.tags ?? []);

      const nextId =
        preferredId ||
        (payload.integrations ?? []).find(
          (integration: Integration) => integration.id === selectedId
        )?.id ||
        payload.integrations?.[0]?.id ||
        "";
      setSelectedId(nextId);
      const nextIntegration = (payload.integrations ?? []).find(
        (integration: Integration) => integration.id === nextId
      );
      setDraft(nextIntegration ? structuredClone(nextIntegration) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać danych.");
    } finally {
      setLoading(false);
    }
  }

  function toggleParticipant(userId: string) {
    setDraft((current) => {
      if (!current) return current;
      const selected = current.participant_user_ids.includes(userId);
      return {
        ...current,
        participant_user_ids: selected
          ? current.participant_user_ids.filter((id) => id !== userId)
          : [...current.participant_user_ids, userId],
      };
    });
  }

  function toggleTag(tagName: string) {
    setDraft((current) => {
      if (!current) return current;
      const selected = current.tag_names.includes(tagName);
      return {
        ...current,
        tag_names: selected
          ? current.tag_names.filter((name) => name !== tagName)
          : [...current.tag_names, tagName],
      };
    });
  }

  function startCreatingIntegration() {
    const defaultTag = tags.find((tag) => tag.name === "GRANT")?.name || tags[0]?.name;

    setSelectedId("");
    setDraft({
      id: "",
      slug: "",
      name: "Nowa integracja Meta Ads",
      source_type: "meta",
      campaign_name: "",
      external_form_id: null,
      is_active: true,
      assignment_rule: "round_robin",
      tag_names: defaultTag ? [defaultTag] : [],
      notify_assigned_user: true,
      notify_owners: true,
      participant_user_ids: [],
    });
    setError("");
    setStatus("");
  }

  async function saveIntegration() {
    if (!draft) return;

    setError("");
    setStatus("");

    if (!draft.name.trim() || !draft.campaign_name.trim()) {
      setError("Nazwa integracji i kampanii są wymagane.");
      return;
    }
    if (isCreating && draft.source_type === "meta" && !draft.external_form_id?.trim()) {
      setError("Dla kolejnej kampanii Meta podaj ID jej formularza błyskawicznego.");
      return;
    }
    if (draft.participant_user_ids.length === 0) {
      setError("Wybierz co najmniej jednego użytkownika do obsługi leadów.");
      return;
    }
    if (draft.tag_names.length === 0) {
      setError("Wybierz co najmniej jeden tag klienta.");
      return;
    }

    setSaving(true);

    try {
      const generatedSlug =
        draft.slug.trim() ||
        `${draft.source_type}-${slugify(draft.campaign_name) || Date.now()}`;
      const response = await authorizedFetch("/api/admin/lead-integrations", {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id || undefined,
          slug: generatedSlug,
          sourceType: draft.source_type,
          name: draft.name,
          campaignName: draft.campaign_name,
          externalFormId: draft.external_form_id,
          isActive: draft.is_active,
          assignmentRule: draft.assignment_rule,
          tagNames: draft.tag_names,
          participantUserIds: draft.participant_user_ids,
          notifyAssignedUser: draft.notify_assigned_user,
          notifyOwners: draft.notify_owners,
        }),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "Nie udało się zapisać integracji.");

      setStatus(isCreating ? "Nowa integracja została utworzona." : "Konfiguracja integracji została zapisana.");
      await loadData(payload.id || draft.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać zmian.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Admin · Automatyzacja sprzedaży
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Integracje leadów</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Wybierz osoby obsługujące leady i sposób ich przydzielania. Ten sam mechanizm
                obsłuży Meta Ads oraz kolejne źródła dodane w przyszłości.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Wróć do panelu
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}
        {status && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {status}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">
            Ładowanie konfiguracji…
          </div>
        ) : integrations.length === 0 ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            Brak integracji. Uruchom migrację bazy danych, aby dodać kampanię Grant Radzionków.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 px-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Źródła leadów
                </p>
                <button
                  type="button"
                  onClick={startCreatingIntegration}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-emerald-700"
                >
                  + Dodaj
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {integrations.map((integration) => (
                  <button
                    key={integration.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(integration.id);
                      setDraft(structuredClone(integration));
                      setError("");
                      setStatus("");
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      integration.id === selectedId
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-black text-slate-900">{integration.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {integration.source_type.toUpperCase()} · {integration.is_active ? "Aktywna" : "Wyłączona"}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            {draft && (
              <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                {isCreating && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
                    Tworzysz konfigurację kolejnego źródła leadów. Dla formularza Meta wpisz jego
                    ID — dzięki temu webhook rozpozna właściwą kampanię, pola, tagi i sposób przydziału.
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Nazwa integracji
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) => current && { ...current, name: event.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Nazwa kampanii w powiadomieniu
                    <input
                      value={draft.campaign_name}
                      onChange={(event) =>
                        setDraft((current) =>
                          current && { ...current, campaign_name: event.target.value }
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-bold text-slate-700 sm:col-span-2">
                    ID formularza Meta {isCreating ? "(wymagane)" : "(puste = konfiguracja domyślna)"}
                    <input
                      value={draft.external_form_id ?? ""}
                      onChange={(event) =>
                        setDraft((current) =>
                          current && { ...current, external_form_id: event.target.value || null }
                        )
                      }
                      placeholder={isCreating ? "Np. 123456789012345" : "Puste = domyślna konfiguracja dla Meta"}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-emerald-500"
                    />
                  </label>
                  {isCreating && (
                    <label className="space-y-2 text-sm font-bold text-slate-700">
                      Źródło
                      <select
                        value={draft.source_type}
                        onChange={(event) =>
                          setDraft((current) =>
                            current && { ...current, source_type: event.target.value }
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-emerald-500"
                      >
                        <option value="meta">Meta Lead Ads</option>
                      </select>
                    </label>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">Zasada przydzielania</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {RULES.map((rule) => (
                      <button
                        key={rule.value}
                        type="button"
                        onClick={() =>
                          setDraft((current) =>
                            current && { ...current, assignment_rule: rule.value }
                          )
                        }
                        className={`rounded-2xl border p-4 text-left transition ${
                          draft.assignment_rule === rule.value
                            ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-sm font-black text-slate-900">{rule.title}</span>
                        <span className="mt-2 block text-xs leading-5 text-slate-600">{rule.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">Użytkownicy obsługujący leady</h2>
                      <p className="mt-1 text-sm text-slate-500">Wybrano: {draft.participant_user_ids.length}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) =>
                          current && { ...current, participant_user_ids: users.map((user) => user.id) }
                        )
                      }
                      className="text-xs font-bold text-emerald-700"
                    >
                      Zaznacz wszystkich
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={draft.participant_user_ids.includes(user.id)}
                          onChange={() => toggleParticipant(user.id)}
                          className="h-5 w-5 accent-emerald-600"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-900">
                            {user.display_name || user.email || "Użytkownik"}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {ROLE_LABELS[user.role ?? ""] || user.role || "Użytkownik"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">Tagi dodawane klientowi</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = draft.tag_names.includes(tag.name);
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => toggleTag(tag.name)}
                          className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                            selected
                              ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {selected ? "✓ " : ""}{tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) =>
                        setDraft((current) => current && { ...current, is_active: event.target.checked })
                      }
                      className="h-5 w-5 accent-emerald-600"
                    />
                    Integracja aktywna
                  </label>
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.notify_assigned_user}
                      onChange={(event) =>
                        setDraft((current) =>
                          current && { ...current, notify_assigned_user: event.target.checked }
                        )
                      }
                      className="h-5 w-5 accent-emerald-600"
                    />
                    Teams do opiekuna
                  </label>
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.notify_owners}
                      onChange={(event) =>
                        setDraft((current) =>
                          current && { ...current, notify_owners: event.target.checked }
                        )
                      }
                      className="h-5 w-5 accent-emerald-600"
                    />
                    Teams na czat Zarządu
                  </label>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={saveIntegration}
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? "Zapisywanie…" : "Zapisz konfigurację"}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
