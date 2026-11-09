"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  normalizeServicePostalCode,
  type ServiceLocation,
  type ServiceLocationUser,
} from "@/lib/userServiceLocations";

const ROLE_LABELS: Record<string, string> = {
  seller: "Doradca", manager: "Manager", owner: "Właściciel",
};
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
const buttonClass = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

async function authorizedFetch(init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  return fetch("/api/admin/postal-codes", {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
  });
}

async function fetchUsers(signal?: AbortSignal): Promise<ServiceLocationUser[]> {
  const response = await authorizedFetch({ signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Nie udało się pobrać lokalizacji.");
  return payload.users;
}

export default function PostalCodesPage() {
  const [users, setUsers] = useState<ServiceLocationUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const selectedUser = users.find((user) => user.id === selectedId);
  const originalCode = selectedUser?.locations.find((location) => location.id === editingId)?.postal_code ?? "";
  const dirty = code.trim() !== originalCode;
  const visibleUsers = users.filter((user) => {
    const query = search.trim().toLocaleLowerCase("pl");
    return (showInactive || user.is_active) &&
      (area === "all" || (area === "ideatermo" ? user.ideatermo : user.ideasol)) &&
      (!onlyMissing || user.locations.length === 0) &&
      (!query || `${user.display_name ?? ""} ${user.locations.map((location) => location.postal_code).join(" ")}`
        .toLocaleLowerCase("pl").includes(query));
  });

  const applyUsers = useCallback((nextUsers: ServiceLocationUser[]) => {
      setUsers(nextUsers);
      setSelectedId((current) => nextUsers.some((user) => user.id === current)
        ? current : nextUsers.find((user) => user.is_active)?.id ?? nextUsers[0]?.id ?? "");
      setEditingId(null);
      setCode("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUsers(controller.signal).then((nextUsers) => {
      if (!controller.signal.aborted) applyUsers(nextUsers);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Nie udało się pobrać lokalizacji.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [applyUsers]);

  async function refresh() {
    if (!canDiscard()) return;
    setStatus("");
    setError("");
    setLoading(true);
    try {
      applyUsers(await fetchUsers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się pobrać lokalizacji.");
    } finally {
      setLoading(false);
    }
  }

  function canDiscard() {
    return !dirty || window.confirm("Masz niezapisany kod pocztowy. Odrzucić zmiany?");
  }

  function selectUser(userId: string) {
    if (userId === selectedId || !canDiscard()) return;
    setSelectedId(userId);
    setEditingId(null);
    setCode("");
    setError("");
    setStatus("");
  }

  function editLocation(location: ServiceLocation) {
    if (!canDiscard()) return;
    setEditingId(location.id);
    setCode(location.postal_code);
    setError("");
    setStatus("");
  }

  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || saving) return;
    const postalCode = normalizeServicePostalCode(code);
    if (!postalCode) {
      setError("Wpisz kod pocztowy w formacie 00-000.");
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await authorizedFetch({
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ userId: selectedUser.id, id: editingId, postalCode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Nie udało się zapisać kodu.");
      const location: ServiceLocation = payload.location;
      setUsers((current) => current.map((user) => user.id === selectedUser.id ? {
        ...user,
        locations: [...user.locations.filter((item) => item.id !== location.id), location]
          .sort((a, b) => a.postal_code.localeCompare(b.postal_code)),
      } : user));
      setEditingId(null);
      setCode("");
      setStatus(`Zapisano kod ${location.postal_code} dla ${selectedUser.display_name ?? "użytkownika"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać kodu.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLocation(location: ServiceLocation) {
    if (!selectedUser || saving || !window.confirm(
      `Usunąć kod ${location.postal_code} użytkownika ${selectedUser.display_name ?? "bez nazwy"}? Nie będzie już używany przy przydzielaniu nowych leadów.`
    )) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await authorizedFetch({
        method: "DELETE", body: JSON.stringify({ userId: selectedUser.id, id: location.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Nie udało się usunąć kodu.");
      setUsers((current) => current.map((user) => user.id === selectedUser.id
        ? { ...user, locations: user.locations.filter((item) => item.id !== location.id) } : user));
      if (editingId === location.id) { setEditingId(null); setCode(""); }
      setStatus(`Usunięto kod ${location.postal_code}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się usunąć kodu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Panel administratora</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Kody pocztowe handlowców</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Ustaw lokalizacje używane do przydzielania leadów według odległości.
                Każda osoba może mieć kilka kodów, wspólnych dla IdeaSol i IdeaTermo.
                Zmiany dotyczą kolejnych zgłoszeń.
              </p>
            </div>
            <nav aria-label="Panel administratora" className="flex flex-wrap gap-2">
              <Link href="/admin/lead-integrations" className={buttonClass}>Integracje leadów</Link>
              <Link href="/admin/users" className={buttonClass}>Wróć do panelu</Link>
            </nav>
          </div>
        </header>

        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
        {status && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{status}</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section aria-label="Lista handlowców" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-950">Użytkownicy ({visibleUsers.length})</h2>
              <button type="button" disabled={loading || saving} className={buttonClass}
                onClick={() => void refresh()}>Odśwież</button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Szukaj osoby lub kodu
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="Imię, nazwisko lub 00-000" />
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Obszar działalności
              <select value={area} onChange={(event) => setArea(event.target.value)} className={inputClass}>
                <option value="all">Wszystkie obszary</option><option value="ideasol">IdeaSol</option><option value="ideatermo">IdeaTermo</option>
              </select>
            </label>
            <div className="my-4 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />Tylko bez kodu</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Pokaż nieaktywnych</label>
            </div>
            {loading ? <p role="status" className="py-6 text-sm text-slate-500">Ładowanie lokalizacji…</p> : (
              <ul className="max-h-[36rem] space-y-2 overflow-y-auto">
                {visibleUsers.map((user) => (
                  <li key={user.id}>
                    <button type="button" disabled={saving} aria-pressed={user.id === selectedId}
                      onClick={() => selectUser(user.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition disabled:opacity-60 ${user.id === selectedId ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <span className="block font-bold text-slate-900">{user.display_name || "Użytkownik bez nazwy"}</span>
                      <span className="mt-1 block text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role} · {[user.ideasol && "IdeaSol", user.ideatermo && "IdeaTermo"].filter(Boolean).join(", ") || "Brak obszaru"}{!user.is_active ? " · Nieaktywny" : user.hidden_from_assignment ? " · Wyłączony z przydziału" : ""}</span>
                      <span className={`mt-2 block text-sm font-semibold ${user.locations.length ? "text-slate-700" : "text-amber-700"}`}>
                        {user.locations.length ? user.locations.map((location) => location.postal_code).join(", ") : "Brak kodów pocztowych"}
                      </span>
                    </button>
                  </li>
                ))}
                {visibleUsers.length === 0 && <li className="py-6 text-sm text-slate-500">Brak użytkowników pasujących do filtrów.</li>}
              </ul>
            )}
          </section>

          <section aria-label="Lokalizacje użytkownika" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {selectedUser ? (
              <>
                <h2 className="text-xl font-bold text-slate-950">{selectedUser.display_name || "Użytkownik bez nazwy"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Przy kilku lokalizacjach system wybierze tę najbliższą klientowi. Użytkownik musi być też wybrany do obsługi leadów w danej integracji.</p>
                {(!selectedUser.is_active || selectedUser.hidden_from_assignment) && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ta osoba jest obecnie wyłączona z automatycznego przydziału leadów.</p>}
                <ul className="mt-5 space-y-3">
                  {selectedUser.locations.map((location) => (
                    <li key={location.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-bold text-slate-900">{location.postal_code}</p>
                          {location.places.length > 0 && <p className="mt-1 text-xs leading-5 text-slate-500">{location.places.join(" · ")}</p>}
                          {!location.has_coordinates && <p className="mt-1 text-sm font-semibold text-amber-700">Brak dokładnej lokalizacji w bazie. Sprawdź poprawność kodu.</p>}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" disabled={saving || loading} onClick={() => editLocation(location)} className={buttonClass} aria-label={`Popraw kod ${location.postal_code}`}>Popraw</button>
                          <button type="button" disabled={saving || loading} onClick={() => void deleteLocation(location)} className={`${buttonClass} text-red-700`} aria-label={`Usuń kod ${location.postal_code}`}>Usuń</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {selectedUser.locations.length === 0 && <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Brak kodu pocztowego. Dodaj lokalizację, aby uwzględnić odległość przy przydzielaniu leadów.</p>}
                <form onSubmit={saveLocation} className="mt-6 rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-bold text-slate-900">{editingId ? `Popraw kod ${originalCode}` : "Dodaj kod pocztowy"}</h3>
                  <label htmlFor="postal-code" className="mt-3 block text-sm font-semibold text-slate-700">Kod pocztowy</label>
                  <input id="postal-code" required maxLength={6} inputMode="numeric" autoComplete="off" placeholder="00-000" value={code}
                    disabled={saving || loading} onChange={(event) => setCode(event.target.value)} className={inputClass} />
                  <p className="mt-2 text-xs text-slate-500">Kod sprawdzimy w bazie lokalizacji przed zapisaniem.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="submit" disabled={saving || loading || !code.trim() || (editingId !== null && !dirty)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Zapisywanie…" : editingId ? "Zapisz zmianę" : "Dodaj lokalizację"}</button>
                    {editingId && <button type="button" disabled={saving} onClick={() => { setEditingId(null); setCode(""); setError(""); }} className={buttonClass}>Anuluj</button>}
                  </div>
                </form>
              </>
            ) : <p className="py-6 text-sm text-slate-500">{loading ? "Ładowanie…" : "Wybierz użytkownika z listy."}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
