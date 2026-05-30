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

  const contactMethods = [
    {
      value: "phone",
      label: "Telefon",
      activeClass: "border-[#C93200] bg-[#C93200] text-white shadow-sm",
      inactiveClass: "border-[#C93200] bg-white text-[#C93200] hover:bg-[#C93200] hover:text-white",
    },
    {
      value: "sms",
      label: "SMS",
      activeClass: "border-[#910049] bg-[#910049] text-white shadow-sm",
      inactiveClass: "border-[#910049] bg-white text-[#910049] hover:bg-[#910049] hover:text-white",
    },
    {
      value: "email",
      label: "E-mail",
      activeClass: "border-[#187B96] bg-[#187B96] text-white shadow-sm",
      inactiveClass: "border-[#187B96] bg-white text-[#187B96] hover:bg-[#187B96] hover:text-white",
    },
    {
      value: "meeting",
      label: "Spotkanie",
      activeClass: "border-[#3A752A] bg-[#3A752A] text-white shadow-sm",
      inactiveClass: "border-[#3A752A] bg-white text-[#3A752A] hover:bg-[#3A752A] hover:text-white",
    },
  ] as const;

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
      className="space-y-4"
    >
      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        DODAJ KONTAKT
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {contactMethods.map((method) => {
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
                  className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                    isActive ? method.activeClass : method.inactiveClass
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
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
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
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
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
            <div className="relative">
              <input
                type="datetime-local"
                value={reminderAt}
                min={minimumDateTime}
                onChange={(e) => setReminderAt(e.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition hover:border-[#119182]/60 focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                ⏱
              </span>
            </div>
          </div>
        )}

        {requiresMeeting && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Data spotkania
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={meetingAt}
                min={minimumDateTime}
                onChange={(e) => setMeetingAt(e.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition hover:border-[#119182]/60 focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                📅
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
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

      <div className="flex justify-end">
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