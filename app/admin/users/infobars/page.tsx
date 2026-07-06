"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string | null;
  display_name: string | null;
  name: string | null;
  email: string | null;
};

type ProfileLookupResult = {
  id: string;
  role: string | null;
  display_name?: string | null;
  name?: string | null;
  email?: string | null;
};

type InfobarRow = {
  id: string;
  title: string | null;
  message: string;
  color: string;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  dismissible: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

type InfobarForm = {
  id: string | null;
  title: string;
  message: string;
  color: string;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  noEndDate: boolean;
  isActive: boolean;
  dismissible: boolean;
  priority: string;
};

const emptyForm: InfobarForm = {
  id: null,
  title: "",
  message: "",
  color: "#dc2626",
  linkUrl: "",
  startsAt: "",
  endsAt: "",
  noEndDate: false,
  isActive: true,
  dismissible: true,
  priority: "1",
};

function toInputDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffset);

  return localDate.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function isInfobarCurrentlyVisible(infobar: InfobarRow) {
  if (!infobar.is_active) return false;

  const now = Date.now();
  const startsAt = infobar.starts_at ? new Date(infobar.starts_at).getTime() : null;
  const endsAt = infobar.ends_at ? new Date(infobar.ends_at).getTime() : null;

  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;

  return true;
}

function normalizeLinkUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return null;

  return trimmedValue;
}

export default function AdminInfobarsPage() {

  const [profile, setProfile] = useState<Profile | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [infobars, setInfobars] = useState<InfobarRow[]>([]);
  const [form, setForm] = useState<InfobarForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedRole = String(profile?.role || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const normalizedEmail = String(profile?.email || authEmail || "").trim().toLowerCase();
  const canManageInfobars = normalizedRole === "admin" || normalizedEmail === "admin@ideasol.pl";

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setProfile(null);
      setAuthEmail(null);
      setAuthUserId(null);
      setLoading(false);
      setError("Brak aktywnej sesji użytkownika.");
      return;
    }

    const currentAuthEmail = userData.user.email || null;

    setAuthEmail(currentAuthEmail);
    setAuthUserId(userData.user.id);

    if (String(currentAuthEmail || "").trim().toLowerCase() === "admin@ideasol.pl") {
      setProfile({
        id: userData.user.id,
        role: "admin",
        display_name: "Administrator",
        name: "Administrator",
        email: currentAuthEmail,
      });

      await loadInfobars();
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, display_name, name, email")
      .eq("id", userData.user.id)
      .maybeSingle();

    let resolvedProfile = profileError ? null : (profileData as Profile | null);

    if (!resolvedProfile && userData.user.email) {
      const { data: profileByEmailData, error: profileByEmailError } = await supabase
        .from("profiles")
        .select("id, role, display_name, name, email")
        .eq("email", userData.user.email)
        .maybeSingle();

      if (!profileByEmailError) {
        resolvedProfile = profileByEmailData as Profile | null;
      }
    }

    if (!resolvedProfile) {
      const { data: userProfileData, error: userProfileError } = await supabase
        .from("user_profiles")
        .select("id, role, display_name, name, email")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!userProfileError && userProfileData) {
        const legacyProfile = userProfileData as ProfileLookupResult;
        resolvedProfile = {
          id: legacyProfile.id,
          role: legacyProfile.role,
          display_name: legacyProfile.display_name || null,
          name: legacyProfile.name || null,
          email: legacyProfile.email || null,
        };
      }
    }

    if (!resolvedProfile && userData.user.email) {
      const { data: userProfileByEmailData, error: userProfileByEmailError } = await supabase
        .from("user_profiles")
        .select("id, role, display_name, name, email")
        .eq("email", userData.user.email)
        .maybeSingle();

      if (!userProfileByEmailError && userProfileByEmailData) {
        const legacyProfile = userProfileByEmailData as ProfileLookupResult;
        resolvedProfile = {
          id: legacyProfile.id,
          role: legacyProfile.role,
          display_name: legacyProfile.display_name || null,
          name: legacyProfile.name || null,
          email: legacyProfile.email || null,
        };
      }
    }

    const metadataRole = String(
      userData.user.user_metadata?.role || userData.user.app_metadata?.role || ""
    ).trim();

    if (!resolvedProfile && metadataRole) {
      resolvedProfile = {
        id: userData.user.id,
        role: metadataRole,
        display_name: String(userData.user.user_metadata?.display_name || userData.user.email || ""),
        name: String(userData.user.user_metadata?.name || ""),
        email: userData.user.email || null,
      };
    }

    setProfile(resolvedProfile);

    await loadInfobars();
    setLoading(false);
  }

  async function loadInfobars() {
    const { data, error: infobarError } = await supabase
      .from("admin_infobars")
      .select("id, title, message, color, link_url, starts_at, ends_at, is_active, dismissible, priority, created_at, updated_at")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (infobarError) {
      setError("Nie udało się pobrać infobarów.");
      return;
    }

    setInfobars((data || []) as InfobarRow[]);
  }

  function updateForm<K extends keyof InfobarForm>(key: K, value: InfobarForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  function editInfobar(infobar: InfobarRow) {
    setMessage(null);
    setError(null);
    setForm({
      id: infobar.id,
      title: infobar.title || "",
      message: infobar.message || "",
      color: infobar.color || "#dc2626",
      linkUrl: infobar.link_url || "",
      startsAt: toInputDateTime(infobar.starts_at),
      endsAt: toInputDateTime(infobar.ends_at),
      noEndDate: !infobar.ends_at,
      isActive: infobar.is_active,
      dismissible: infobar.dismissible,
      priority: String(infobar.priority || 1),
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  async function saveInfobar() {
    const creatorId = profile?.id || authUserId;

    if (!canManageInfobars || !creatorId) return;

    const trimmedMessage = form.message.trim();

    if (!trimmedMessage) {
      setError("Treść komunikatu jest wymagana.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      title: form.title.trim() || null,
      message: trimmedMessage,
      color: form.color || "#dc2626",
      link_url: normalizeLinkUrl(form.linkUrl),
      starts_at: fromInputDateTime(form.startsAt),
      ends_at: form.noEndDate ? null : fromInputDateTime(form.endsAt),
      is_active: form.isActive,
      dismissible: form.dismissible,
      priority: Number(form.priority) || 1,
      created_by: creatorId,
      updated_at: new Date().toISOString(),
    };

    const query = form.id
      ? supabase.from("admin_infobars").update(payload).eq("id", form.id)
      : supabase.from("admin_infobars").insert(payload);

    const { error: saveError } = await query;

    if (saveError) {
      setSaving(false);
      setError("Nie udało się zapisać infobara.");
      return;
    }

    await loadInfobars();
    setForm(emptyForm);
    setSaving(false);
    setMessage(form.id ? "Infobar został zaktualizowany." : "Infobar został dodany.");
  }

  async function toggleInfobar(infobar: InfobarRow) {
    if (!canManageInfobars) return;

    setError(null);
    setMessage(null);

    const { error: toggleError } = await supabase
      .from("admin_infobars")
      .update({
        is_active: !infobar.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", infobar.id);

    if (toggleError) {
      setError("Nie udało się zmienić statusu infobara.");
      return;
    }

    await loadInfobars();
  }

  async function deleteInfobar(infobarId: string) {
    if (!canManageInfobars) return;

    const confirmed = window.confirm("Czy na pewno usunąć ten infobar?");

    if (!confirmed) return;

    setError(null);
    setMessage(null);

    const { error: deleteError } = await supabase
      .from("admin_infobars")
      .delete()
      .eq("id", infobarId);

    if (deleteError) {
      setError("Nie udało się usunąć infobara.");
      return;
    }

    await loadInfobars();
    setMessage("Infobar został usunięty.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-500">Ładowanie panelu Infobar...</p>
        </div>
      </main>
    );
  }

  if (!canManageInfobars) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <Link href="/admin/users" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
            ← Wróć do panelu admina
          </Link>
          <h1 className="mt-6 text-2xl font-black text-slate-950">Brak dostępu</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ten panel jest dostępny tylko dla konta administratora.
          </p>
          <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
            Wykryty e-mail: {profile?.email || authEmail || "brak"} · rola: {profile?.role || "brak"} · auth id: {authUserId || "brak"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/admin/users" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                ← Wróć do panelu admina
              </Link>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Infobar</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Zarządzaj globalnymi komunikatami wyświetlanymi na górze CRM. Możesz ustawić kolor, link, daty aktywności i kilka komunikatów naraz.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Nowy infobar
            </button>
          </div>
        </section>

        {(message || error) && (
          <section
            className={
              error
                ? "rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800"
                : "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800"
            }
          >
            {error || message}
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">Aktywne i zaplanowane infobary</h2>

            <div className="mt-5 space-y-4">
              {infobars.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Brak dodanych infobarów.
                </p>
              ) : (
                infobars.map((infobar) => {
                  const visibleNow = isInfobarCurrentlyVisible(infobar);

                  return (
                    <article key={infobar.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div
                        className="px-4 py-3 text-sm font-bold"
                        style={{ backgroundColor: infobar.color || "#dc2626", color: "#ffffff" }}
                      >
                        {infobar.message}
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              visibleNow
                                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                            }
                          >
                            {visibleNow ? "Widoczny teraz" : "Niewidoczny teraz"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {infobar.is_active ? "Aktywny" : "Wyłączony"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            Priorytet {infobar.priority}
                          </span>
                          {infobar.dismissible && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                              Zamykalny
                            </span>
                          )}
                        </div>

                        <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <p>Od: {infobar.starts_at ? new Date(infobar.starts_at).toLocaleString("pl-PL") : "od razu"}</p>
                          <p>Do: {infobar.ends_at ? new Date(infobar.ends_at).toLocaleString("pl-PL") : "do odwołania"}</p>
                          <p>Kolor: {infobar.color}</p>
                          <p>Link: {infobar.link_url || "brak"}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editInfobar(infobar)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleInfobar(infobar)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            {infobar.is_active ? "Wyłącz" : "Włącz"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteInfobar(infobar.id)}
                            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
                          >
                            Usuń
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              {form.id ? "Edytuj infobar" : "Nowy infobar"}
            </h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Nazwa robocza</span>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Np. Przerwa techniczna"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Treść komunikatu *</span>
                <textarea
                  value={form.message}
                  onChange={(event) => updateForm("message", event.target.value)}
                  rows={4}
                  placeholder="Wpisz treść komunikatu widocznego na górze CRM"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Link po kliknięciu w pasek</span>
                <input
                  value={form.linkUrl}
                  onChange={(event) => updateForm("linkUrl", event.target.value)}
                  placeholder="Np. /reports albo https://ideasol.pl"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Kolor paska</span>
                  <input
                    value={form.color}
                    onChange={(event) => updateForm("color", event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => updateForm("color", event.target.value)}
                  className="h-12 w-20 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                  aria-label="Wybierz kolor infobara"
                />
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Wyświetlaj od</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => updateForm("startsAt", event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.noEndDate}
                  onChange={(event) => updateForm("noEndDate", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Wyświetlaj do odwołania
              </label>

              {!form.noEndDate && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Wyświetlaj do</span>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) => updateForm("endsAt", event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Priorytet</span>
                <input
                  type="number"
                  min="1"
                  value={form.priority}
                  onChange={(event) => updateForm("priority", event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm("isActive", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Aktywny
                </label>

                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.dismissible}
                    onChange={(event) => updateForm("dismissible", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Można zamknąć
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Podgląd</p>
                <div className="rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: form.color || "#dc2626" }}>
                  {form.message || "Treść komunikatu będzie widoczna tutaj"}
                </div>
              </div>

              <button
                type="button"
                onClick={saveInfobar}
                disabled={saving}
                className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Zapisywanie..." : form.id ? "Zapisz zmiany" : "Dodaj infobar"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
