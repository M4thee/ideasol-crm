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
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  current_terms_version: string | null;
  current_privacy_version: string | null;
  marketing_sms_consent: boolean;
  marketing_email_consent: boolean;
  marketing_phone_consent: boolean;
  marketing_consent_version: string | null;
  marketing_consents_updated_at: string | null;
  balance: {
    available_points: number | string | null;
    pending_points: number | string | null;
    reserved_points: number | string | null;
  };
  points_history: Array<{
    id: string;
    entry_type: string;
    status: string;
    points: number | string;
    description: string;
    reason: string | null;
    earned_at: string | null;
    available_at: string | null;
    reserved_at: string | null;
    spent_at: string | null;
    cancelled_at: string | null;
    expires_at: string | null;
    created_at: string;
  }>;
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

function formatPointChange(value: number | string) {
  const amount = Number(value || 0);
  return `${amount > 0 ? "+" : ""}${formatPoints(amount)} kWpkt`;
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatConsentDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ConsentStatus({ accepted, acceptedLabel, missingLabel }: { accepted: boolean; acceptedLabel: string; missingLabel: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${accepted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
      {accepted ? acceptedLabel : missingLabel}
    </span>
  );
}

const entryTypeLabels: Record<string, string> = {
  registration: "Rejestracja",
  own_purchase: "Zakup własny",
  referral: "Polecenie",
  manual_bonus: "Bonus ręczny",
  manual_correction: "Korekta ręczna",
  reward_reservation: "Rezerwacja nagrody",
  reward_release: "Zwolnienie rezerwacji",
  reward_spend: "Odbiór nagrody",
  expiry: "Wygaśnięcie punktów",
  reversal: "Odwrócenie operacji",
};

const pointStatusLabels: Record<string, string> = {
  pending: "Oczekujące",
  available: "Dostępne",
  reserved: "Zarezerwowane",
  spent: "Wykorzystane",
  cancelled: "Anulowane",
  expired: "Wygasłe",
};

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

      {account && (
        <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black">Regulamin i zgody</h3>
              <p className="mt-1 text-sm text-slate-500">
                Bieżący status dokumentów i dobrowolnych zgód zapisany na koncie klienta w IdeaSol Profit.
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold">
              <a href="https://profit.ideasol.pl/regulamin" target="_blank" rel="noreferrer" className="text-[#0e6b7b] hover:underline">Regulamin</a>
              <a href="https://profit.ideasol.pl/polityka-prywatnosci" target="_blank" rel="noreferrer" className="text-[#0e6b7b] hover:underline">Polityka prywatności</a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Dokument</p><h4 className="mt-1 font-black">Regulamin programu</h4></div>
                <ConsentStatus accepted={Boolean(account.terms_accepted_at)} acceptedLabel="Zaakceptowany" missingLabel="Do akceptacji" />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {account.terms_accepted_at ? `${formatConsentDate(account.terms_accepted_at)}${account.current_terms_version ? ` · wersja ${account.current_terms_version}` : ""}` : "Klient nie zaakceptował jeszcze regulaminu."}
              </p>
            </article>

            <article className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Dokument</p><h4 className="mt-1 font-black">Polityka prywatności</h4></div>
                <ConsentStatus accepted={Boolean(account.privacy_accepted_at)} acceptedLabel="Potwierdzona" missingLabel="Do potwierdzenia" />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {account.privacy_accepted_at ? `${formatConsentDate(account.privacy_accepted_at)}${account.current_privacy_version ? ` · wersja ${account.current_privacy_version}` : ""}` : "Klient nie potwierdził jeszcze zapoznania się z dokumentem."}
              </p>
            </article>

            {[
              ["SMS/MMS", account.marketing_sms_consent],
              ["E-mail", account.marketing_email_consent],
              ["Połączenia telefoniczne", account.marketing_phone_consent],
            ].map(([label, accepted]) => (
              <article key={String(label)} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Marketing</p><h4 className="mt-1 font-black">{String(label)}</h4></div>
                  <ConsentStatus accepted={Boolean(accepted)} acceptedLabel="Zgoda wyrażona" missingLabel="Brak zgody" />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {account.marketing_consents_updated_at ? `Stan z ${formatConsentDate(account.marketing_consents_updated_at)}${account.marketing_consent_version ? ` · wersja ${account.marketing_consent_version}` : ""}` : "Klient nie zapisał jeszcze ustawień marketingowych."}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {account && (
        <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-black">Pełna historia kWpkt</h3>
              <p className="mt-1 text-sm text-slate-500">
                Wszystkie przyznania, rezerwacje, wykorzystania, korekty i wygaśnięcia punktów.
              </p>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {account.points_history.length} {account.points_history.length === 1 ? "operacja" : "operacji"}
            </p>
          </div>

          {account.points_history.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">
              Na koncie nie ma jeszcze operacji punktowych.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wide text-slate-400 dark:border-slate-700">
                    <th className="px-3 py-3">Data</th>
                    <th className="px-3 py-3">Operacja</th>
                    <th className="px-3 py-3">Opis</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Zmiana</th>
                  </tr>
                </thead>
                <tbody>
                  {account.points_history.map((entry) => {
                    const amount = Number(entry.points || 0);
                    return (
                      <tr key={entry.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                        <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                          {formatHistoryDate(entry.created_at)}
                        </td>
                        <td className="px-3 py-4 font-bold text-slate-800 dark:text-slate-100">
                          {entryTypeLabels[entry.entry_type] || entry.entry_type}
                        </td>
                        <td className="max-w-md px-3 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{entry.description}</p>
                          {entry.reason && entry.reason !== entry.description ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">{entry.reason}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {pointStatusLabels[entry.status] || entry.status}
                          </span>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-4 text-right font-black ${amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatPointChange(entry.points)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

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
