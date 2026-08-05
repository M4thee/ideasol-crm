"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type ManualSmsRecipient = {
  id: string;
  label: string;
  phone: string | null | undefined;
};

export default function ManualSmsComposer({
  clientId,
  saleId,
  recipients,
  onSent,
}: {
  clientId?: string | null;
  saleId?: string | null;
  recipients: ManualSmsRecipient[];
  onSent?: () => void | Promise<void>;
}) {
  const availableRecipients = recipients.filter((recipient) =>
    String(recipient.phone || "").trim()
  );
  const [recipientId, setRecipientId] = useState(
    () => availableRecipients[0]?.id || ""
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const selectedRecipient = availableRecipients.find(
    (recipient) => recipient.id === recipientId
  );

  async function sendManualSms() {
    const trimmedMessage = message.trim();

    if (!selectedRecipient?.phone) {
      setStatus("Wybierz numer odbiorcy.");
      return;
    }

    if (!trimmedMessage) {
      setStatus("Wpisz treść wiadomości SMS.");
      return;
    }

    if (!window.confirm("Czy na pewno chcesz wysłać ten SMS?")) return;

    setSending(true);
    setStatus("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token || "";

      if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: clientId || null,
          saleId: saleId || null,
          phone: selectedRecipient.phone,
          message: trimmedMessage,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nie udało się wysłać SMS-a.");
      }

      setMessage("");
      setStatus(
        result.testMode
          ? `SMS testowy wysłano na numer ${result.actualRecipientPhone}.`
          : "Wiadomość własna została wysłana."
      );
      await onSent?.();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Nie udało się wysłać SMS-a."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-fuchsia-700">
          Tylko administrator
        </p>
        <h3 className="mt-1 text-lg font-black text-slate-950">
          Wiadomość własna
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Wpisz dowolną treść. Polskie znaki zostaną automatycznie zamienione, a
          wysyłka zapisze się w historii klienta.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
        <label className="text-sm font-bold text-slate-700">
          Numer odbiorcy
          <select
            value={recipientId}
            onChange={(event) => setRecipientId(event.target.value)}
            disabled={sending || availableRecipients.length === 0}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-fuchsia-600 disabled:bg-slate-100"
          >
            {availableRecipients.length === 0 ? (
              <option value="">Brak numeru telefonu</option>
            ) : (
              availableRecipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.label} — {recipient.phone}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="text-sm font-bold text-slate-700">
          Treść SMS
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={sending}
            maxLength={1200}
            rows={5}
            placeholder="Wpisz wiadomość..."
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100 disabled:bg-slate-100"
          />
          <span className="mt-1 block text-right text-xs font-medium text-slate-400">
            {message.length}/1200 znaków
          </span>
        </label>
      </div>

      {status ? (
        <p className="mt-3 rounded-xl border border-fuchsia-200 bg-white px-4 py-3 text-sm font-semibold text-fuchsia-900">
          {status}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void sendManualSms()}
        disabled={sending || !selectedRecipient?.phone || !message.trim()}
        className="mt-4 rounded-xl bg-fuchsia-800 px-5 py-3 text-sm font-bold text-white hover:bg-fuchsia-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? "Wysyłanie..." : "Wyślij wiadomość własną"}
      </button>
    </section>
  );
}
