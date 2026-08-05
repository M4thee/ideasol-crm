"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SmsSenderName = {
  sender_name: string;
  provider_status: "ACTIVE" | "INACTIVE" | "NOT_FOUND" | "UNKNOWN";
  provider_checked_at: string | null;
};

type SenderData = {
  senders: SmsSenderName[];
  selectedSender: string;
};

function statusLabel(status: SmsSenderName["provider_status"]) {
  if (status === "ACTIVE") return "Aktywna";
  if (status === "INACTIVE") return "Oczekuje na aktywację";
  if (status === "NOT_FOUND") return "Brak w SMSAPI";
  return "Status nieznany";
}

function statusClassName(status: SmsSenderName["provider_status"]) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "INACTIVE") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function SmsSenderNamesAdmin() {
  const [data, setData] = useState<SenderData | null>(null);
  const [selectedSender, setSelectedSender] = useState("Test");
  const [newSender, setNewSender] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadSenders = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch("/api/admin/sms-senders", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nie udało się pobrać nazw nadawcy.");
      }

      const nextData = result as SenderData;
      setData(nextData);
      setSelectedSender(nextData.selectedSender || "Test");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Nie udało się pobrać nazw nadawcy."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    // Pobranie aktualnej konfiguracji jest jedynym efektem wejścia do sekcji.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSenders();
  }, [loadSenders]);

  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

    const response = await fetch("/api/admin/sms-senders", {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Nie udało się zapisać nazwy nadawcy.");
    }

    return result as SenderData;
  }

  async function addSender() {
    setSaving(true);
    setStatus("");

    try {
      const nextData = await request("POST", { senderName: newSender });
      setData(nextData);
      setSelectedSender(nextData.selectedSender);
      setNewSender("");
      setStatus(
        "Nazwa została dodana z aktualnym statusem SMSAPI. Aktywuj ją globalnie po zatwierdzeniu."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się dodać nazwy.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedSender() {
    setSaving(true);
    setStatus("");

    try {
      const nextData = await request("PATCH", {
        action: "select",
        senderName: selectedSender,
      });
      setData(nextData);
      setSelectedSender(nextData.selectedSender);
      setStatus(
        `Nazwa ${nextData.selectedSender} jest teraz używana globalnie we wszystkich SMS-ach.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się zmienić nazwy.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshStatuses() {
    setSaving(true);
    setStatus("");

    try {
      const nextData = await request("PATCH", { action: "refresh" });
      setData(nextData);
      setSelectedSender(nextData.selectedSender);
      setStatus("Statusy nazw zostały odświeżone z SMSAPI.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Nie udało się odświeżyć statusów."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedRecord = data?.senders.find(
    (sender) => sender.sender_name === selectedSender
  );

  return (
    <section className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50/60 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-fuchsia-700">
            Globalne ustawienie
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950">
            Nazwa wyświetlana nadawcy SMS
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Wybrana nazwa obowiązuje we wszystkich wiadomościach ręcznych i
            automatycznych. Można wybrać wyłącznie nazwę aktywną w SMSAPI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshStatuses()}
          disabled={saving || loading}
          className="rounded-xl border border-fuchsia-300 bg-white px-4 py-3 text-sm font-bold text-fuchsia-800 disabled:opacity-50"
        >
          Odśwież statusy z SMSAPI
        </button>
      </div>

      {status ? (
        <p className="mt-4 rounded-xl border border-fuchsia-200 bg-white px-4 py-3 text-sm font-semibold text-fuchsia-900">
          {status}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Ładowanie nazw nadawcy...</p>
      ) : data ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="text-sm font-bold text-slate-700">
              Nazwa używana globalnie
              <select
                value={selectedSender}
                onChange={(event) => setSelectedSender(event.target.value)}
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-fuchsia-600"
              >
                {data.senders.map((sender) => (
                  <option
                    key={sender.sender_name}
                    value={sender.sender_name}
                    disabled={sender.provider_status !== "ACTIVE"}
                  >
                    {sender.sender_name} — {statusLabel(sender.provider_status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void saveSelectedSender()}
              disabled={
                saving ||
                selectedSender === data.selectedSender ||
                selectedRecord?.provider_status !== "ACTIVE"
              }
              className="rounded-xl bg-fuchsia-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {saving ? "Zapisywanie..." : "Ustaw globalnie"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {data.senders.map((sender) => (
              <span
                key={sender.sender_name}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClassName(
                  sender.provider_status
                )}`}
              >
                {sender.sender_name}: {statusLabel(sender.provider_status)}
                {sender.sender_name === data.selectedSender ? " · używana" : ""}
              </span>
            ))}
          </div>

          <div className="mt-6 border-t border-fuchsia-200 pt-5">
            <h4 className="font-black text-slate-950">Dodaj kolejną nazwę</h4>
            <p className="mt-1 text-sm text-slate-600">
              Najpierw zgłoś nazwę w panelu SMSAPI. Następnie dodaj ją tutaj — CRM
              sprawdzi jej bieżący status. Maksymalnie 11 znaków.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={newSender}
                onChange={(event) => setNewSender(event.target.value)}
                maxLength={11}
                placeholder="np. IdeaSol"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-950 outline-none focus:border-fuchsia-600"
              />
              <button
                type="button"
                onClick={() => void addSender()}
                disabled={saving || !newSender.trim()}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                Dodaj i sprawdź w SMSAPI
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
