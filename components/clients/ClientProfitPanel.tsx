"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type ClientProfitAccount = {
  id: string;
  idea_id: string;
  account_status: "active" | "blocked" | "closed";
  rewards_locked: boolean;
  joined_at: string;
  activated_at: string | null;
  crm_link_status: string;
  is_ideasol_customer: boolean;
  registration_source: "client" | "admin";
  registered_by_admin_id: string | null;
  balance: {
    available_points: number | string | null;
    pending_points: number | string | null;
    reserved_points: number | string | null;
  };
};

type Props = {
  clientId: string;
  isAdmin: boolean;
  account: ClientProfitAccount | null;
  loading: boolean;
  loadError: string;
  onRefresh: () => Promise<void>;
};

function formatPoints(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("pl-PL");
}

async function authenticatedRequest<T>(url: string, init: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");

  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Nie udało się wykonać operacji.");
  }
  return payload;
}

export default function ClientProfitPanel({
  clientId,
  isAdmin,
  account,
  loading,
  loadError,
  onRefresh,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function runAdminAction(body: Record<string, unknown>) {
    return authenticatedRequest<{ ok: true; user?: { idea_id: string } }>(
      "/api/admin/profit",
      { method: "PATCH", body: JSON.stringify(body) }
    );
  }

  async function toggleAccess() {
    const enabling = !account || account.account_status === "blocked";
    const prompt = !account
      ? "Włączyć dostęp do IdeaSol Profit i utworzyć klientowi unikalny IdeaID?"
      : enabling
        ? "Ponownie włączyć klientowi dostęp do IdeaSol Profit?"
        : "Wyłączyć klientowi dostęp do IdeaSol Profit?";
    if (!window.confirm(prompt)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (!account) {
        const result = await runAdminAction({ action: "create_user_from_crm", crmClientId: clientId });
        setSuccess(`Dostęp został włączony. IdeaID: ${result.user?.idea_id || "utworzony"}.`);
      } else {
        await runAdminAction({
          action: "update_user",
          userId: account.id,
          accountStatus: enabling ? "active" : "blocked",
        });
        setSuccess(enabling ? "Dostęp do Profit został włączony." : "Dostęp do Profit został wyłączony.");
      }
      await onRefresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nie udało się zmienić dostępu.");
    } finally {
      setBusy(false);
    }
  }

  async function addPoints(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;

    const amount = Number(points.replace(/\s/g, ""));
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      setError("Podaj pełną liczbę od 1 do 1 000 000 kWpkt.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Opisz, za co przyznajesz punkty (minimum 5 znaków).");
      return;
    }
    if (!window.confirm(`Dodać ${formatPoints(amount)} kWpkt do konta ${account.idea_id}?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await runAdminAction({
        action: "adjust_points",
        userId: account.id,
        points: amount,
        reason: reason.trim(),
      });
      setPoints("");
      setReason("");
      setSuccess(`Dodano ${formatPoints(amount)} kWpkt.`);
      await onRefresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nie udało się dodać punktów.");
    } finally {
      setBusy(false);
    }
  }

  async function sendWelcomeSms() {
    if (!account) return;
    if (!window.confirm(`Wysłać powitalny SMS IdeaSol Profit dla konta ${account.idea_id}?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await authenticatedRequest<{ ok: true }>(
        `/api/clients/${encodeURIComponent(clientId)}/profit/welcome-sms`,
        { method: "POST", body: "{}" }
      );
      setSuccess("Powitalny SMS został wysłany.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nie udało się wysłać SMS-a.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Ładowanie danych IdeaSol Profit…</p>;
  }

  return (
    <div className="space-y-5">
      {(loadError || error || success) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${loadError || error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {loadError || error || success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0e6b7b]">Konto lojalnościowe</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {account ? account.idea_id : "Brak konta Profit"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {account
                ? `Rejestrację wykonał: ${account.registration_source === "admin" ? "administrator" : "klient samodzielnie"}`
                : "Klient nie został jeszcze zarejestrowany w programie."}
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${account?.account_status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
            {account?.account_status === "active" ? "Dostęp włączony" : "Dostęp wyłączony"}
          </span>
        </div>

        {account && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-400">Dostępne</p>
              <p className="mt-2 text-xl font-black text-[#0e6b7b]">{formatPoints(account.balance.available_points)} kWpkt</p>
            </div>
            <div className="rounded-xl bg-white p-4 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-400">Oczekujące</p>
              <p className="mt-2 text-xl font-black">{formatPoints(account.balance.pending_points)} kWpkt</p>
            </div>
            <div className="rounded-xl bg-white p-4 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-400">Zarezerwowane</p>
              <p className="mt-2 text-xl font-black">{formatPoints(account.balance.reserved_points)} kWpkt</p>
            </div>
          </div>
        )}
      </section>

      {isAdmin ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
            <h3 className="text-lg font-black">Dostęp klienta</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Włączenie utworzy IdeaID, jeśli klient nie ma jeszcze konta. Wyłączenie blokuje logowanie, ale nie usuwa punktów.
            </p>
            <button
              type="button"
              disabled={busy || account?.account_status === "closed"}
              onClick={() => void toggleAccess()}
              className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 ${account?.account_status === "active" ? "bg-red-600" : "bg-[#0e6b7b]"}`}
            >
              {account?.account_status === "active" ? "Wyłącz dostęp" : "Włącz dostęp"}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
            <h3 className="text-lg font-black">Powitalny SMS</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Wiadomość zawiera aktualne saldo kWpkt, IdeaID i instrukcję logowania. Zostanie wysłana bez polskich znaków.
            </p>
            <button
              type="button"
              disabled={busy || !account}
              onClick={() => void sendWelcomeSms()}
              className="mt-4 rounded-xl bg-[#ff8a00] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              Wyślij powitalny SMS
            </button>
          </section>

          <form onSubmit={addPoints} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700 xl:col-span-2">
            <h3 className="text-lg font-black">Dodaj kWpkt</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
              <label className="text-sm font-bold">
                Liczba punktów
                <input required type="number" min="1" max="1000000" step="1" value={points} onChange={(event) => setPoints(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-sm font-bold">
                Opis — za co przyznano punkty
                <input required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-4 dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <button disabled={busy || !account} className="h-11 rounded-xl bg-[#0e6b7b] px-5 text-sm font-black text-white disabled:opacity-50">Dodaj kWpkt</button>
            </div>
          </form>
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">
          Dane programu są widoczne dla użytkowników CRM. Zmiany może wykonywać wyłącznie administrator.
        </p>
      )}
    </div>
  );
}
