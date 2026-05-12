"use client";

import { useMemo, useState } from "react";

export type ContactFormPayload = {
  contactMethod: "phone" | "sms" | "email" | "meeting";
  phoneContactType?: "marketing" | "relationship" | "incoming";
  phoneStatus?: string;
  description: string;
  reminderAt?: string;
  meetingAt?: string;
};

type Props = {
  onSubmit: (payload: ContactFormPayload) => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function ClientContactForm({ onSubmit, isSubmitting }: Props) {
  const [contactMethod, setContactMethod] =
    useState<ContactFormPayload["contactMethod"]>("phone");

  const [phoneContactType, setPhoneContactType] =
    useState<ContactFormPayload["phoneContactType"]>("marketing");

  const [phoneStatus, setPhoneStatus] = useState("");
  const [description, setDescription] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");

  const statuses = useMemo(() => {
    if (phoneContactType === "marketing") {
      return [
        { value: "nie_odbiera", label: "Nie odbiera" },
        { value: "prosba_o_ponowny_kontakt", label: "Prośba o ponowny kontakt" },
        { value: "niezainteresowany", label: "Niezainteresowany" },
        { value: "umowione_spotkanie", label: "Umówione spotkanie" },
      ];
    }

    if (phoneContactType === "incoming") {
      return [
        { value: "pytania_techniczne", label: "Pytania techniczne" },
        { value: "reklamacja", label: "Reklamacja" },
        { value: "zainteresowanie_oferta", label: "Zainteresowanie ofertą" },
        { value: "inne", label: "Inne" },
      ];
    }

    return [];
  }, [phoneContactType]);

  const requiresReminder =
    phoneContactType === "marketing" &&
    ["nie_odbiera", "prosba_o_ponowny_kontakt"].includes(phoneStatus);

  const requiresMeeting =
    (phoneContactType === "marketing" && phoneStatus === "umowione_spotkanie") ||
    (phoneContactType === "incoming" && phoneStatus === "zainteresowanie_oferta") ||
    contactMethod === "meeting";

  function localDateTimeToIso(value: string) {
    if (!value) return undefined;
    return new Date(value).toISOString();
  }

  function getMinimumLocalDateTime() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  function isPastDateTime(value: string) {
    return new Date(value).getTime() <= Date.now();
  }

  const minimumDateTime = getMinimumLocalDateTime();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!description.trim()) {
      alert("Dodaj opis kontaktu.");
      return;
    }

    if (contactMethod === "phone") {
      if (!phoneContactType) {
        alert("Wybierz typ kontaktu telefonicznego.");
        return;
      }

      if (phoneContactType !== "relationship" && !phoneStatus) {
        alert("Wybierz status kontaktu.");
        return;
      }

      if (requiresReminder && !reminderAt) {
        alert("Ustaw datę i godzinę ponownego kontaktu.");
        return;
      }

      if (requiresReminder && isPastDateTime(reminderAt)) {
        alert("Data ponownego kontaktu musi być w przyszłości.");
        return;
      }

      if (requiresMeeting && !meetingAt) {
        alert("Ustaw datę i godzinę spotkania.");
        return;
      }

      if (requiresMeeting && isPastDateTime(meetingAt)) {
        alert("Data spotkania musi być w przyszłości.");
        return;
      }
    }

    await onSubmit({
      contactMethod,
      phoneContactType: contactMethod === "phone" ? phoneContactType : undefined,
      phoneStatus:
        contactMethod === "phone" && phoneContactType !== "relationship"
          ? phoneStatus
          : undefined,
      description: description.trim(),
      reminderAt: requiresReminder ? localDateTimeToIso(reminderAt) : undefined,
      meetingAt: requiresMeeting ? localDateTimeToIso(meetingAt) : undefined,
    });

    setDescription("");
    setReminderAt("");
    setMeetingAt("");
    setPhoneStatus("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Dodaj kontakt
        </h3>
        <p className="text-sm text-slate-500">
          Zapisz rozmowę, SMS, e-mail, spotkanie albo zaplanuj ponowny kontakt.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Forma kontaktu
          </label>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { value: "phone", label: "Telefon" },
              { value: "sms", label: "SMS" },
              { value: "email", label: "E-mail" },
              { value: "meeting", label: "Spotkanie" },
            ].map((method) => {
              const isActive = contactMethod === method.value;

              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => {
                    setContactMethod(
                      method.value as ContactFormPayload["contactMethod"]
                    );
                    setPhoneStatus("");
                    setReminderAt("");
                    setMeetingAt("");
                  }}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {method.label}
                </button>
              );
            })}
          </div>
        </div>

        {contactMethod === "phone" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Typ kontaktu
            </label>
            <select
              value={phoneContactType}
              onChange={(e) => {
                setPhoneContactType(
                  e.target.value as ContactFormPayload["phoneContactType"]
                );
                setPhoneStatus("");
                setReminderAt("");
                setMeetingAt("");
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="marketing">Kontakt marketingowy</option>
              <option value="relationship">Kontakt relacyjny</option>
              <option value="incoming">Kontakt przychodzący</option>
            </select>
          </div>
        )}

        {contactMethod === "phone" && phoneContactType !== "relationship" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Efekt / status
            </label>
            <select
              value={phoneStatus}
              onChange={(e) => {
                setPhoneStatus(e.target.value);
                setReminderAt("");
                setMeetingAt("");
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Wybierz status</option>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {requiresReminder && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Data ponownego kontaktu
            </label>
            <input
              type="datetime-local"
              value={reminderAt}
              min={minimumDateTime}
              onChange={(e) => setReminderAt(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {requiresMeeting && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Data spotkania
            </label>
            <input
              type="datetime-local"
              value={meetingAt}
              min={minimumDateTime}
              onChange={(e) => setMeetingAt(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Opis
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Opisz rozmowę, ustalenia, pytania klienta albo powód ponownego kontaktu..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSubmitting ? "Zapisywanie..." : "Zapisz kontakt"}
        </button>
      </div>
    </form>
  );
}