"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Installer = {
  id: string;
  company_name: string;
  address: string | null;
  nip: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
};

type InstallerForm = {
  company_name: string;
  address: string;
  nip: string;
  contact_name: string;
  phone: string;
  email: string;
};

const EMPTY_INSTALLER: InstallerForm = {
  company_name: "",
  address: "",
  nip: "",
  contact_name: "",
  phone: "",
  email: "",
};

function normalizeNip(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function toInstallerForm(installer: Installer): InstallerForm {
  return {
    company_name: installer.company_name,
    address: installer.address || "",
    nip: installer.nip || "",
    contact_name: installer.contact_name || "",
    phone: installer.phone || "",
    email: installer.email || "",
  };
}

function validateInstaller(form: InstallerForm) {
  if (!form.company_name.trim()) return "Wpisz nazwę firmy instalatora.";
  if (form.nip && form.nip.length !== 10) return "NIP musi mieć dokładnie 10 cyfr.";
  return "";
}

export default function InstallersAdmin() {
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [newInstaller, setNewInstaller] = useState<InstallerForm>(EMPTY_INSTALLER);
  const [editedInstallers, setEditedInstallers] = useState<Record<string, InstallerForm>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadInstallers();
  }, []);

  async function loadInstallers() {
    setLoading(true);
    setStatus("");

    const { data, error } = await supabase
      .from("installers")
      .select("id, company_name, address, nip, contact_name, phone, email, active, created_at")
      .order("active", { ascending: false })
      .order("company_name", { ascending: true });

    if (error) {
      console.error("Błąd pobierania instalatorów", error);
      setStatus("Nie udało się pobrać instalatorów.");
      setLoading(false);
      return;
    }

    setInstallers((data || []) as Installer[]);
    setEditedInstallers({});
    setLoading(false);
  }

  async function getCurrentUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id || null;
  }

  async function createInstaller() {
    const validationError = validateInstaller(newInstaller);

    if (validationError) {
      setStatus(validationError);
      return;
    }

    const userId = await getCurrentUserId();

    if (!userId) {
      setStatus("Sesja wygasła. Zaloguj się ponownie.");
      return;
    }

    setCreating(true);
    setStatus("");

    const { error } = await supabase.from("installers").insert({
      company_name: newInstaller.company_name.trim(),
      address: newInstaller.address.trim() || null,
      nip: newInstaller.nip || null,
      contact_name: newInstaller.contact_name.trim() || null,
      phone: newInstaller.phone.trim() || null,
      email: newInstaller.email.trim().toLowerCase() || null,
      created_by: userId,
      updated_by: userId,
    });

    if (error) {
      console.error("Błąd dodawania instalatora", error);
      setStatus(
        error.code === "23505"
          ? "Instalator z takim numerem NIP już istnieje."
          : "Nie udało się dodać instalatora."
      );
      setCreating(false);
      return;
    }

    setNewInstaller(EMPTY_INSTALLER);
    setStatus("Instalator został dodany.");
    setCreating(false);
    await loadInstallers();
  }

  function editInstaller(installer: Installer, values: Partial<InstallerForm>) {
    setEditedInstallers((current) => ({
      ...current,
      [installer.id]: {
        ...(current[installer.id] || toInstallerForm(installer)),
        ...values,
      },
    }));
  }

  async function saveInstaller(installer: Installer) {
    const form = editedInstallers[installer.id] || toInstallerForm(installer);
    const validationError = validateInstaller(form);

    if (validationError) {
      setStatus(validationError);
      return;
    }

    const userId = await getCurrentUserId();

    if (!userId) {
      setStatus("Sesja wygasła. Zaloguj się ponownie.");
      return;
    }

    setSavingId(installer.id);
    setStatus("");

    const { error } = await supabase
      .from("installers")
      .update({
        company_name: form.company_name.trim(),
        address: form.address.trim() || null,
        nip: form.nip || null,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", installer.id);

    if (error) {
      console.error("Błąd zapisu instalatora", error);
      setStatus(
        error.code === "23505"
          ? "Instalator z takim numerem NIP już istnieje."
          : "Nie udało się zapisać instalatora."
      );
      setSavingId(null);
      return;
    }

    setStatus("Dane instalatora zostały zapisane.");
    setSavingId(null);
    await loadInstallers();
  }

  async function toggleInstallerActive(installer: Installer) {
    const userId = await getCurrentUserId();

    if (!userId) {
      setStatus("Sesja wygasła. Zaloguj się ponownie.");
      return;
    }

    setSavingId(installer.id);
    setStatus("");

    const { error } = await supabase
      .from("installers")
      .update({
        active: !installer.active,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", installer.id);

    if (error) {
      console.error("Błąd zmiany aktywności instalatora", error);
      setStatus("Nie udało się zmienić aktywności instalatora.");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadInstallers();
  }

  const inputClassName =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Instalatorzy</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dane firm dostępnych przy generowaniu zlecenia montażu.
        </p>
      </div>

      {status ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          {status}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-lg font-semibold text-slate-900">Dodaj instalatora</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={newInstaller.company_name}
            onChange={(event) =>
              setNewInstaller((current) => ({ ...current, company_name: event.target.value }))
            }
            placeholder="Nazwa firmy *"
            className={inputClassName}
          />
          <input
            value={newInstaller.nip}
            onChange={(event) =>
              setNewInstaller((current) => ({ ...current, nip: normalizeNip(event.target.value) }))
            }
            inputMode="numeric"
            placeholder="NIP - 10 cyfr"
            className={inputClassName}
          />
          <input
            value={newInstaller.address}
            onChange={(event) =>
              setNewInstaller((current) => ({ ...current, address: event.target.value }))
            }
            placeholder="Adres"
            className={inputClassName}
          />
          <input
            value={newInstaller.contact_name}
            onChange={(event) =>
              setNewInstaller((current) => ({ ...current, contact_name: event.target.value }))
            }
            placeholder="Osoba kontaktowa"
            className={inputClassName}
          />
          <input
            value={newInstaller.phone}
            onChange={(event) =>
              setNewInstaller((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="Telefon"
            className={inputClassName}
          />
          <input
            type="email"
            value={newInstaller.email}
            onChange={(event) =>
              setNewInstaller((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="E-mail"
            className={inputClassName}
          />
        </div>
        <button
          type="button"
          onClick={createInstaller}
          disabled={creating}
          className="mt-4 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Dodawanie..." : "Dodaj instalatora"}
        </button>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Ładowanie instalatorów...
        </div>
      ) : installers.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Brak instalatorów. Dodaj pierwszą firmę powyżej.
        </div>
      ) : (
        <div className="space-y-4">
          {installers.map((installer) => {
            const form = editedInstallers[installer.id] || toInstallerForm(installer);
            const hasChanges = Boolean(editedInstallers[installer.id]);

            return (
              <article
                key={installer.id}
                className={`rounded-3xl border p-5 ${
                  installer.active
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-100 opacity-75"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{installer.company_name}</h3>
                    <span
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        installer.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {installer.active ? "Aktywny" : "Wyłączony"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveInstaller(installer)}
                      disabled={!hasChanges || savingId === installer.id}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {savingId === installer.id ? "Zapisywanie..." : "Zapisz"}
                    </button>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={installer.active}
                        onChange={() => toggleInstallerActive(installer)}
                        disabled={savingId === installer.id}
                        className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      />
                      {installer.active ? "Aktywny" : "Nieaktywny"}
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <input
                    value={form.company_name}
                    onChange={(event) => editInstaller(installer, { company_name: event.target.value })}
                    placeholder="Nazwa firmy *"
                    className={inputClassName}
                  />
                  <input
                    value={form.nip}
                    onChange={(event) => editInstaller(installer, { nip: normalizeNip(event.target.value) })}
                    inputMode="numeric"
                    placeholder="NIP - 10 cyfr"
                    className={inputClassName}
                  />
                  <input
                    value={form.address}
                    onChange={(event) => editInstaller(installer, { address: event.target.value })}
                    placeholder="Adres"
                    className={inputClassName}
                  />
                  <input
                    value={form.contact_name}
                    onChange={(event) => editInstaller(installer, { contact_name: event.target.value })}
                    placeholder="Osoba kontaktowa"
                    className={inputClassName}
                  />
                  <input
                    value={form.phone}
                    onChange={(event) => editInstaller(installer, { phone: event.target.value })}
                    placeholder="Telefon"
                    className={inputClassName}
                  />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => editInstaller(installer, { email: event.target.value })}
                    placeholder="E-mail"
                    className={inputClassName}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
