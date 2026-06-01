"use client";

import { useMemo, useState } from "react";

export type ContactFormPayload = {
  contactMethod: "phone" | "sms" | "email" | "meeting";
  phoneContactType?: "marketing" | "relationship" | "incoming";
  phoneStatus?: string;
  description: string;
  reminderAt?: string;
  meetingAt?: string;
  assignedUserId?: string;
};

type AdvisorOption = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type Props = {
  onSubmit: (payload: ContactFormPayload) => Promise<void> | void;
  isSubmitting?: boolean;
  advisors?: AdvisorOption[];
};

export default function ClientContactForm({ onSubmit, isSubmitting, advisors = [] }: Props) {
  const [contactMethod, setContactMethod] =
    useState<ContactFormPayload["contactMethod"]>("phone");

  const [phoneContactType, setPhoneContactType] =
    useState<ContactFormPayload["phoneContactType"]>("marketing");

  const [phoneStatus, setPhoneStatus] = useState("");
  const [description, setDescription] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [advisorSearch, setAdvisorSearch] = useState("");

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

  const selectedAdvisor = advisors.find((advisor) => advisor.id === advisorId) || null;

  const filteredAdvisors = advisors.filter((advisor) => {
    const query = advisorSearch.trim().toLowerCase();

    if (query.length < 2) return false;

    return [advisor.display_name, advisor.email, advisor.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function getRoleLabel(role: string | null) {
    if (role === "seller") return "Doradca";
    if (role === "manager") return "Manager";
    if (role === "owner") return "Owner";

    return role || "Użytkownik";
  }

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

  const hourOptions = Array.from({ length: 13 }, (_, index) =>
    String(index + 8).padStart(2, "0")
  );

  const minuteOptions = ["00", "15", "30", "45"];

  const meetingDescriptionTemplate = `Posiada PV? TAK / NIE
Wysokość rachunków: - zł/mc
Miejsce montażu: blacha / dachówka / grunt / płaski dach
System rozliczeń: net-billing / net-metering`;

  function getDateValue(value: string) {
    return value ? value.slice(0, 10) : "";
  }

  function getTimeValue(value: string) {
    return value ? value.slice(11, 16) : "";
  }

  function combineDateAndTime(date: string, time: string) {
    if (!date || !time) return "";
    return `${date}T${time}`;
  }

  function DateTimePicker({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) {
    const selectedDate = getDateValue(value);
    const selectedTime = getTimeValue(value);
    const selectedHour = selectedTime ? selectedTime.slice(0, 2) : "09";
    const selectedMinute = selectedTime ? selectedTime.slice(3, 5) : "00";

    return (
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          {label}
        </label>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mt-1 flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Data
              </label>
              <input
                type="date"
                value={selectedDate}
                min={minimumDateTime.slice(0, 10)}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  onChange(combineDateAndTime(nextDate, `${selectedHour}:00`));
                }}
                className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Godzina
              </label>
              <select
                value={selectedHour}
                onChange={(event) => {
                  const nextDate = selectedDate || minimumDateTime.slice(0, 10);
                  onChange(combineDateAndTime(nextDate, `${event.target.value}:${selectedMinute}`));
                }}
                className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Minuty
              </label>
              <select
                value={selectedMinute}
                onChange={(event) => {
                  const nextDate = selectedDate || minimumDateTime.slice(0, 10);
                  onChange(combineDateAndTime(nextDate, `${selectedHour}:${event.target.value}`));
                }}
                className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      if (requiresMeeting && !advisorId) {
        alert("Wybierz doradcę do spotkania.");
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
      assignedUserId: requiresMeeting ? advisorId : undefined,
    });

    setDescription("");
    setReminderAt("");
    setMeetingAt("");
    setPhoneStatus("");
    setAdvisorId("");
    setAdvisorSearch("");
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
                    setAdvisorId("");
                    setAdvisorSearch("");
                    setDescription(
                      method.value === "meeting" ? meetingDescriptionTemplate : ""
                    );
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
                setAdvisorId("");
                setAdvisorSearch("");
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
                setReminderAt("");
                setMeetingAt("");
                setAdvisorId("");
                setAdvisorSearch("");
                const nextStatus = e.target.value;

                if (
                  (phoneContactType === "marketing" && nextStatus === "umowione_spotkanie") ||
                  (phoneContactType === "incoming" && nextStatus === "zainteresowanie_oferta")
                ) {
                  setDescription(meetingDescriptionTemplate);
                } else {
                  setDescription("");
                }
                setPhoneStatus(nextStatus);
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
          <DateTimePicker
            label="Data ponownego kontaktu"
            value={reminderAt}
            onChange={setReminderAt}
          />
        )}

        {requiresMeeting && (
          <DateTimePicker
            label="Data i godzina spotkania"
            value={meetingAt}
            onChange={setMeetingAt}
          />
        )}

        {requiresMeeting && (
          <div className="md:col-span-2 rounded-2xl border border-[#E7D49A] bg-[#F7EAC1] p-4">
            <span className="text-sm font-bold text-slate-900">Wybierz doradcę</span>
            <p className="mt-1 text-xs text-slate-600">
              Spotkanie zostanie zapisane w kalendarzu tego doradcy.
            </p>

            <div className="relative mt-3">
              <input
                type="text"
                value={advisorSearch}
                onChange={(event) => {
                  setAdvisorSearch(event.target.value);
                  setAdvisorId("");
                }}
                className="w-full rounded-xl border border-[#E7D49A] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                placeholder="Wyszukaj doradcę po imieniu, nazwisku, e-mailu lub roli..."
              />

              {selectedAdvisor && (
                <div className="mt-2 rounded-xl border border-[#E7D49A] bg-white px-4 py-3 text-sm text-slate-900">
                  <span className="font-bold">Wybrano:</span> {selectedAdvisor?.display_name || selectedAdvisor?.email || "Doradca"}
                  <span className="ml-2 text-xs font-semibold text-slate-600">
                    {getRoleLabel(selectedAdvisor?.role || null)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdvisorId("");
                      setAdvisorSearch("");
                    }}
                    className="ml-3 font-bold text-slate-700 underline underline-offset-2"
                  >
                    zmień
                  </button>
                </div>
              )}

              {!selectedAdvisor && (
                <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-[#E7D49A] bg-white shadow-sm">
                  {advisorSearch.trim().length < 2 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      Wpisz minimum 2 znaki, aby wyszukać doradcę.
                    </div>
                  ) : filteredAdvisors.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      Brak doradców pasujących do wyszukiwania.
                    </div>
                  ) : (
                    filteredAdvisors.map((advisor) => (
                      <button
                        key={advisor.id}
                        type="button"
                        onClick={() => {
                          setAdvisorId(advisor.id);
                          setAdvisorSearch(advisor.display_name || advisor.email || "Doradca");
                        }}
                        className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-[#F7EAC1]/60"
                      >
                        <span className="block font-bold text-slate-900">
                          {advisor.display_name || "Doradca bez nazwy"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {[advisor.email, getRoleLabel(advisor.role)].filter(Boolean).join(" • ")}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
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
          placeholder={requiresMeeting ? meetingDescriptionTemplate : "Opisz rozmowę, ustalenia, pytania klienta albo powód ponownego kontaktu..."}
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