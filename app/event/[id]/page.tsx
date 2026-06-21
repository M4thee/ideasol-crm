"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CalendarEvent = {
  id: string;
  source_activity_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  event_type: "meeting" | "reminder" | string;
  event_at: string;
  status: string | null;
  created_by: string | null;
  assigned_user_id: string | null;
  microsoft_event_id: string | null;
  microsoft_event_url: string | null;
  microsoft_sync_status: string | null;
  microsoft_sync_error: string | null;
};

type Client = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  address: string | null;
};

type EventOwner = {
  id: string;
  display_name: string | null;
  role: string | null;
  email?: string | null;
};

type AssignableUser = {
  id: string;
  display_name: string | null;
  role: string | null;
  email?: string | null;
  manager_id?: string | null;
};

type PhoneStatus =
  | ""
  | "nie odbiera"
  | "prośba o ponowny kontakt"
  | "niezainteresowany"
  | "umówione spotkanie";

type MeetingEffectStatus =
  | ""
  | "Zainteresowany"
  | "Niezainteresowany"
  | "Rezygnacja"
  | "Przełożenie"
  | "Sprzedaż";

type NextContactType = "phone" | "meeting";

type SaleInsertPayload = {
  event_id: string;
  client_id: string | null;
  seller_id: string | null;
  sale_date: string;
  status: string;
};

type SaleInsertResult = {
  id: string;
};

type SupabaseErrorDetails = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export default function EventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [eventOwner, setEventOwner] = useState<EventOwner | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [selectedMeetingOwnerId, setSelectedMeetingOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingSale, setCreatingSale] = useState(false);
  const [existingSaleId, setExistingSaleId] = useState<string | null>(null);
  const [showTaskEffectPanel, setShowTaskEffectPanel] = useState(false);
  const [taskPhoneStatus, setTaskPhoneStatus] = useState<PhoneStatus>("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskReminderAt, setTaskReminderAt] = useState("");
  const [taskMeetingAt, setTaskMeetingAt] = useState("");
  const [savingTaskEffect, setSavingTaskEffect] = useState(false);
  const [showMeetingEffectPanel, setShowMeetingEffectPanel] = useState(false);
  const [meetingEffectStatus, setMeetingEffectStatus] = useState<MeetingEffectStatus>("");
  const [meetingEffectDescription, setMeetingEffectDescription] = useState("");
  const [nextContactType, setNextContactType] = useState<NextContactType>("phone");
  const [nextContactAt, setNextContactAt] = useState("");
  const [savingMeetingEffect, setSavingMeetingEffect] = useState(false);
  const [rescheduledMeetingAt, setRescheduledMeetingAt] = useState("");
  const [showReassignPanel, setShowReassignPanel] = useState(false);
  const [selectedReassignUserId, setSelectedReassignUserId] = useState("");
  const [savingReassign, setSavingReassign] = useState(false);

  function getClientAddress() {
    if (!client) return "Brak adresu";
    if (client.address) return client.address;

    const streetAddress = [client.street, client.building_number]
  .filter(Boolean)
  .join(" ");

const cityAddress = [client.postal_code, client.city]
  .filter(Boolean)
  .join(" ");

return [streetAddress, cityAddress]
  .filter(Boolean)
  .join(", ") || "Brak adresu";
  }

  function localDateTimeToIso(value: string) {
    if (!value) return null;
    return new Date(value).toISOString();
  }

  function addMinutesToIsoDateTime(value: string, minutes: number) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  const hourOptions = Array.from({ length: 13 }, (_, index) =>
    String(index + 8).padStart(2, "0")
  );

  const minuteOptions = ["00", "15", "30", "45"];

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
      <div>
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
                min={new Date().toISOString().slice(0, 10)}
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
                  const nextDate = selectedDate || new Date().toISOString().slice(0, 10);
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
                  const nextDate = selectedDate || new Date().toISOString().slice(0, 10);
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

  async function updateOutlookEventAfterReschedule(params: {
    calendarEventId: string;
    microsoftEventId: string | null;
    ownerId: string | null;
    title: string;
    description: string | null;
    eventAt: string;
    clientName: string;
    clientPhone: string | null;
    clientAddress: string;
  }) {
    if (!params.microsoftEventId || !params.ownerId) {
      await supabase
        .from("calendar_events")
        .update({
          microsoft_sync_status: "error",
          microsoft_sync_error: !params.microsoftEventId
            ? "Brak microsoft_event_id — nie można zaktualizować wydarzenia Outlook."
            : "Brak właściciela wydarzenia — nie można ustalić kalendarza Outlook.",
        })
        .eq("id", params.calendarEventId);
      return;
    }

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", params.ownerId)
      .maybeSingle();

    if (!ownerProfile?.email) {
      await supabase
        .from("calendar_events")
        .update({
          microsoft_sync_status: "error",
          microsoft_sync_error: "Brak adresu e-mail właściciela wydarzenia — nie można ustalić kalendarza Outlook.",
        })
        .eq("id", params.calendarEventId);
      return;
    }

    try {
      const response = await fetch("/api/microsoft/outlook/events", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: ownerProfile.email,
          microsoftEventId: params.microsoftEventId,
          subject: params.title,
          body: params.description || "",
          clientName: params.clientName,
          clientPhone: params.clientPhone || "",
          clientAddress: params.clientAddress,
          crmUrl: `${window.location.origin}/event/${params.calendarEventId}`,
          location: params.clientAddress,
          startDateTime: new Date(params.eventAt).toISOString(),
          endDateTime: addMinutesToIsoDateTime(params.eventAt, 60),
          timeZone: "Europe/Warsaw",
          reminderMinutesBeforeStart: 10,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zaktualizować wydarzenia Outlook.");
      }

      await supabase
        .from("calendar_events")
        .update({
          microsoft_sync_status: "synced",
          microsoft_sync_error: null,
        })
        .eq("id", params.calendarEventId);
    } catch (error) {
      console.error("Nie udało się zaktualizować wydarzenia Outlook", error);

      await supabase
        .from("calendar_events")
        .update({
          microsoft_sync_status: "error",
          microsoft_sync_error:
            error instanceof Error ? error.message : "Nieznany błąd aktualizacji Outlook.",
        })
        .eq("id", params.calendarEventId);
    }
  }

  function canChooseMeetingOwner() {
    return ["cc", "admin", "owner", "manager"].includes(currentUserRole || "");
  }

  function canReassignEvent() {
    if (!event || !currentUserId || event.event_type !== "meeting") return false;

    const role = currentUserRole || "";

    if (["admin", "owner", "cc"].includes(role)) return true;

    const eventOwnerId = event.assigned_user_id || event.created_by;

    if (role === "seller") {
      return eventOwnerId === currentUserId;
    }

    if (role === "manager") {
      return Boolean(eventOwnerId && visibleUserIds?.includes(eventOwnerId));
    }

    return false;
  }

  function getReassignableUsers() {
    const role = currentUserRole || "";
    const allowedTargetRoles = ["seller", "manager", "owner", "admin"];

    return assignableUsers.filter((assignableUser) => {
      if (!assignableUser.id) return false;
      const eventOwnerId = event?.assigned_user_id || event?.created_by;
      if (eventOwnerId && assignableUser.id === eventOwnerId) return false;

      const targetRole = assignableUser.role || "";
      if (!allowedTargetRoles.includes(targetRole)) return false;

      if (role === "manager") {
        return Boolean(visibleUserIds?.includes(assignableUser.id)) && !["owner", "admin"].includes(targetRole);
      }

      if (role === "seller") {
        return event?.created_by === currentUserId;
      }

      return ["admin", "owner", "cc"].includes(role);
    });
  }

  function canViewAllEvents() {
    return ["admin", "owner"].includes(currentUserRole || "");
  }

  function canManageTeamEvents() {
    return currentUserRole === "manager";
  }
  async function loadVisibleUserIds(
    userId: string,
    role: string | null
  ) {
    if (["admin", "owner"].includes(role || "")) {
      setVisibleUserIds(null);
      return null;
    }

    if (["seller", "cc"].includes(role || "")) {
      const ids = [userId];
      setVisibleUserIds(ids);
      return ids;
    }

    if (role === "manager") {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("manager_id", userId);

      if (error) {
        console.error("Błąd ładowania zespołu managera", error);
        const ids = [userId];
        setVisibleUserIds(ids);
        return ids;
      }

      const ids = [
        userId,
        ...(data || []).map((item) => item.id),
      ];

      setVisibleUserIds(ids);
      return ids;
    }

    const fallbackIds = [userId];
    setVisibleUserIds(fallbackIds);
    return fallbackIds;
  }

  function getMeetingOwnerId(fallbackUserId: string | null | undefined) {
    if (canChooseMeetingOwner()) {
      return selectedMeetingOwnerId || null;
    }
    return fallbackUserId || null;
  }

  function isCompletedEvent(status: string | null) {
    return status === "done" || status?.startsWith("Zakończone");
  }

  function getEventStatusStyle(status: string | null) {
    if (!status) return "bg-slate-100 text-slate-700 border-slate-200";

    if (status.includes("Zainteresowany")) {
      return "bg-[#FF4AC1]/10 text-[#B00079] border-[#FF4AC1]/30";
    }

    if (status.includes("Niezainteresowany")) {
      return "bg-[#6B6464]/10 text-[#4A4545] border-[#6B6464]/30";
    }

    if (status.includes("Rezygnacja")) {
      return "bg-[#780707]/10 text-[#780707] border-[#780707]/30";
    }

    if (status.includes("Przełożenie") || status.includes("Przełożone")) {
      return "bg-blue-100 text-blue-900 border-blue-200";
    }

    if (status.includes("Sprzedaż")) {
      return "bg-[#138525]/10 text-[#0F6B1E] border-[#138525]/30";
    }

    if (status === "done" || status.startsWith("Zakończone")) {
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    }

    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  async function sendMeetingReassignmentTeamsNotifications(params: {
    newAdvisorEmail: string;
    previousAdvisorEmail: string;
    eventId: string;
    title: string;
    eventAt: string;
    description: string | null;
  }) {
    if (!params.newAdvisorEmail) return;

    const eventStart = new Date(params.eventAt);
    const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);

    try {
      const response = await fetch("/api/microsoft/outlook/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationType: "meeting_reassigned",
          assignedUserEmail: params.newAdvisorEmail,
          previousUserEmail: params.previousAdvisorEmail || undefined,
          subject: params.title,
          clientName,
          clientPhone: client?.phone || undefined,
          clientAddress: getClientAddress() || undefined,
          meetingNote: params.description || undefined,
          crmUrl: `${window.location.origin}/event/${params.eventId}`,
          startDateTime: eventStart.toISOString(),
          endDateTime: eventEnd.toISOString(),
          timeZone: "Europe/Warsaw",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.warn("Spotkanie przepisane, ale nie udało się wysłać powiadomień Teams", result);
      }
    } catch (teamsError) {
      console.warn("Spotkanie przepisane, ale nie udało się wysłać powiadomień Teams", teamsError);
    }
  }

async function findReassignVacationConflict(advisorId: string, eventDateTime: string) {
  if (!advisorId || !eventDateTime) return null;

  const dateValue = getDateValue(eventDateTime);

  if (!dateValue) return null;

  const dayStart = `${dateValue}T00:00:00`;
  const dayEnd = `${dateValue}T23:59:59`;

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, title, event_at")
    .eq("event_type", "vacation")
    .eq("assigned_user_id", advisorId)
    .gte("event_at", dayStart)
    .lte("event_at", dayEnd)
    .limit(1);

  if (error) {
    console.error("Nie udało się sprawdzić urlopu doradcy przy przepisywaniu spotkania", error);
    return null;
  }

  return data?.[0] || null;
}

async function reassignEventOwner() {
    if (!event) return;

    if (!canReassignEvent()) {
      alert("Nie masz uprawnień do przepisania tego spotkania.");
      return;
    }

    if (!selectedReassignUserId) {
      alert("Wybierz nowego doradcę.");
      return;
    }

    const targetUser = getReassignableUsers().find((assignableUser) => assignableUser.id === selectedReassignUserId);

    if (!targetUser) {
      alert("Wybrany użytkownik nie jest dostępny do przepisania tego spotkania.");
      return;
    }

    const vacationConflict = await findReassignVacationConflict(selectedReassignUserId, event.event_at);

    if (vacationConflict) {
      const conflictDate = new Date(vacationConflict.event_at).toLocaleDateString("pl-PL");
      const advisorLabel = targetUser.display_name || targetUser.email || "Ten doradca";

      alert(
        `${advisorLabel} ma urlop w dniu ${conflictDate}. Wybierz innego doradcę albo inny termin.`
      );
      return;
    }

    const previousOwnerId = event.assigned_user_id || event.created_by;
    let previousAdvisorEmail =
      eventOwner?.id === previousOwnerId ? eventOwner.email || "" : "";

    if (!previousAdvisorEmail && previousOwnerId) {
      const { data: previousOwnerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", previousOwnerId)
        .maybeSingle();

      previousAdvisorEmail = previousOwnerProfile?.email || "";
    }

    const newAdvisorEmail = targetUser.email || "";

    setSavingReassign(true);

    const { data: updatedEvent, error: updateError } = await supabase
      .from("calendar_events")
      .update({
        created_by: selectedReassignUserId,
        assigned_user_id: selectedReassignUserId,
      })
      .eq("id", event.id)
      .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, assigned_user_id, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error")
      .single();

    if (updateError || !updatedEvent) {
      console.error("Nie udało się przepisać spotkania", updateError);
      alert(
        `Nie udało się przepisać spotkania.\n\n${
          updateError?.message || "Brak szczegółów błędu."
        }`
      );
      setSavingReassign(false);
      return;
    }

    setEvent(updatedEvent as CalendarEvent);
    setEventOwner({
      id: targetUser.id,
      display_name: targetUser.display_name,
      role: targetUser.role,
      email: targetUser.email || null,
    });
    setSelectedReassignUserId("");
    setShowReassignPanel(false);
    setSavingReassign(false);

    void sendMeetingReassignmentTeamsNotifications({
      newAdvisorEmail,
      previousAdvisorEmail,
      eventId: updatedEvent.id,
      title: updatedEvent.title || "Spotkanie CRM",
      eventAt: updatedEvent.event_at,
      description: updatedEvent.description,
    });

    alert("Spotkanie zostało przepisane na innego doradcę.");
  }

  async function saveTaskEffect() {
    if (!event) return;

    if (!taskPhoneStatus) {
      alert("Wybierz efekt kontaktu.");
      return;
    }

    const needsReminder =
      taskPhoneStatus === "nie odbiera" ||
      taskPhoneStatus === "prośba o ponowny kontakt";
    const needsMeeting = taskPhoneStatus === "umówione spotkanie";

    // --- Meeting owner selection support ---
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const chosenMeetingOwnerId = getMeetingOwnerId(user?.id);

    if (needsReminder && !taskReminderAt) {
      alert("Ten efekt wymaga ustawienia terminu ponownego kontaktu.");
      return;
    }
    if (needsMeeting && !taskMeetingAt) {
      alert("Ten efekt wymaga ustawienia terminu spotkania.");
      return;
    }

    if (needsMeeting && canChooseMeetingOwner() && !chosenMeetingOwnerId) {
      alert("Wybierz użytkownika, do którego kalendarza trafi spotkanie.");
      return;
    }

    if (needsReminder && new Date(taskReminderAt).getTime() <= Date.now()) {
      alert("Termin ponownego kontaktu musi być w przyszłości.");
      return;
    }
    if (needsMeeting && new Date(taskMeetingAt).getTime() <= Date.now()) {
      alert("Termin spotkania musi być w przyszłości.");
      return;
    }

    setSavingTaskEffect(true);

    const description = taskDescription.trim();

    const { error: activityError } = await supabase.from("client_activities").insert({
      client_id: event.client_id,
      activity_type: "phone",
      contact_type: "Kontakt marketingowy",
      status: taskPhoneStatus,
      description: description || null,
      follow_up_at: needsReminder ? taskReminderAt : null,
      created_by: user?.id || null,
    });

    if (activityError) {
      console.error("Błąd zapisu efektu zadania:", activityError);
      alert(`Nie udało się zapisać efektu zadania: ${activityError.message}`);
      setSavingTaskEffect(false);
      return;
    }

    if (needsReminder) {
      const { error: reminderError } = await supabase.from("calendar_events").insert({
        client_id: event.client_id,
        title: `Ponowny kontakt: ${taskPhoneStatus}`,
        description:
          description ||
          `Poprzedni status telefonu: ${taskPhoneStatus}. Kontakt marketingowy.`,
        event_type: "reminder",
        event_at: taskReminderAt,
        status: "planned",
        created_by: user?.id || null,
      });

      if (reminderError) {
        console.error("Efekt zapisany, ale nie udało się utworzyć zadania:", reminderError);
        alert(`Efekt zapisany, ale nie udało się utworzyć zadania: ${reminderError.message}`);
        setSavingTaskEffect(false);
        return;
      }
    }
    if (needsMeeting) {
      const { error: meetingError } = await supabase.from("calendar_events").insert({
        client_id: event.client_id,
        title: `Spotkanie: ${client?.full_name || client?.company_name || "Klient"}`,
        description:
          description ||
          "Spotkanie umówione po kontakcie telefonicznym. Kontakt marketingowy.",
        event_type: "meeting",
        event_at: taskMeetingAt,
        status: "planned",
        created_by: chosenMeetingOwnerId,
      });

      if (meetingError) {
        console.error("Efekt zapisany, ale nie udało się utworzyć spotkania:", meetingError);
        alert(`Efekt zapisany, ale nie udało się utworzyć spotkania: ${meetingError.message}`);
        setSavingTaskEffect(false);
        return;
      }
    }

    const completedStatus = `Zakończone - ${taskPhoneStatus}`;

    const { data: completedEvent, error: completeEventError } = await supabase
      .from("calendar_events")
      .update({ status: completedStatus })
      .eq("id", event.id)
      .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error")
      .single();

    if (completeEventError || !completedEvent) {
      console.error(
        "Efekt zadania został zapisany, ale nie udało się oznaczyć starego przypomnienia jako wykonane:",
        completeEventError
      );

      alert(
        `Efekt zadania został zapisany, ale stare przypomnienie nie zostało oznaczone jako wykonane.\n\n${
          completeEventError?.message || "Brak szczegółów błędu."
        }`
      );

      setSavingTaskEffect(false);
      return;
    }

    setEvent(completedEvent as CalendarEvent);
    setTaskPhoneStatus("");
    setTaskDescription("");
    setTaskReminderAt("");
    setTaskMeetingAt("");
    setSelectedMeetingOwnerId(canChooseMeetingOwner() ? "" : currentUserId || "");
    setShowTaskEffectPanel(false);
    setSavingTaskEffect(false);

    alert("Efekt zadania został zapisany, a stare przypomnienie oznaczono jako wykonane.");
  }

  async function saveMeetingEffect() {
    if (!event) return;

    if (!meetingEffectStatus) {
      alert("Wybierz efekt spotkania.");
      return;
    }

    const description = meetingEffectDescription.trim();

    if (!description) {
      alert("Dodaj notatkę z efektu spotkania.");
      return;
    }

    const needsNextContact = meetingEffectStatus === "Zainteresowany";
    const needsReschedule = meetingEffectStatus === "Przełożenie";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const chosenMeetingOwnerId = getMeetingOwnerId(user?.id);

    if (needsNextContact && !nextContactAt) {
      alert("Wybierz datę kolejnego kontaktu.");
      return;
    }

    if (
      needsNextContact &&
      nextContactType === "meeting" &&
      canChooseMeetingOwner() &&
      !chosenMeetingOwnerId
    ) {
      alert("Wybierz użytkownika, do którego kalendarza trafi spotkanie.");
      return;
    }

    if (needsReschedule && !rescheduledMeetingAt) {
      alert("Wybierz nowy termin spotkania.");
      return;
    }

    if (needsNextContact && new Date(nextContactAt).getTime() <= Date.now()) {
      alert("Data kolejnego kontaktu musi być w przyszłości.");
      return;
    }

    if (needsReschedule && new Date(rescheduledMeetingAt).getTime() <= Date.now()) {
      alert("Nowy termin spotkania musi być w przyszłości.");
      return;
    }

    if (meetingEffectStatus === "Sprzedaż") {
      setSavingMeetingEffect(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: activityError } = await supabase.from("client_activities").insert({
        client_id: event.client_id,
        activity_type: "meeting",
        contact_type: "Efekt spotkania",
        status: meetingEffectStatus,
        description,
        created_by: user?.id || null,
      });

      if (activityError) {
        console.error("Błąd zapisu efektu spotkania:", activityError);
        alert(`Nie udało się zapisać efektu spotkania: ${activityError.message}`);
        setSavingMeetingEffect(false);
        return;
      }

      const { data: completedEvent, error: completeEventError } = await supabase
        .from("calendar_events")
        .update({ status: "Zakończone - Sprzedaż" })
        .eq("id", event.id)
        .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error")
        .single();

      if (completeEventError || !completedEvent) {
        console.error(
          "Efekt spotkania został zapisany, ale nie udało się oznaczyć wydarzenia jako sprzedaż:",
          completeEventError
        );
        alert(
          `Efekt spotkania został zapisany, ale nie udało się oznaczyć wydarzenia jako sprzedaż.\n\n${
            completeEventError?.message || "Brak szczegółów błędu."
          }`
        );
        setSavingMeetingEffect(false);
        return;
      }

      setEvent(completedEvent as CalendarEvent);
      setMeetingEffectStatus("");
      setMeetingEffectDescription("");
      setNextContactType("phone");
      setNextContactAt("");
      setRescheduledMeetingAt("");
      setShowMeetingEffectPanel(false);
      setSavingMeetingEffect(false);

      router.push(
        `/offers?clientId=${event.client_id || ""}&createSale=1&eventId=${event.id}`
      );
      return;
    }

    setSavingMeetingEffect(true);

    // Already got user and chosenMeetingOwnerId above

    const { error: activityError } = await supabase.from("client_activities").insert({
      client_id: event.client_id,
      activity_type: "meeting",
      contact_type: "Efekt spotkania",
      status: meetingEffectStatus,
      description,
      created_by: user?.id || null,
    });

    if (activityError) {
      console.error("Błąd zapisu efektu spotkania:", activityError);
      alert(`Nie udało się zapisać efektu spotkania: ${activityError.message}`);
      setSavingMeetingEffect(false);
      return;
    }

    if (needsReschedule) {
      const newEventAt = localDateTimeToIso(rescheduledMeetingAt);

      const { data: rescheduledEvent, error: rescheduleError } = await supabase
        .from("calendar_events")
        .update({
          event_at: newEventAt,
          status: "planned",
          description:
            description ||
            `Spotkanie przełożone z terminu ${new Date(event.event_at).toLocaleString("pl-PL")}.`,
        })
        .eq("id", event.id)
        .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, assigned_user_id, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error")
        .single();

      if (rescheduleError || !rescheduledEvent) {
        console.error("Efekt spotkania zapisany, ale nie udało się przełożyć spotkania:", rescheduleError);
        alert(
          `Efekt spotkania zapisany, ale nie udało się przełożyć spotkania.\n\n${
            rescheduleError?.message || "Brak szczegółów błędu."
          }`
        );
        setSavingMeetingEffect(false);
        return;
      }

      await updateOutlookEventAfterReschedule({
        calendarEventId: rescheduledEvent.id,
        microsoftEventId: rescheduledEvent.microsoft_event_id || event.microsoft_event_id,
        ownerId: rescheduledEvent.assigned_user_id || rescheduledEvent.created_by || event.assigned_user_id || event.created_by,
        title: rescheduledEvent.title,
        description: rescheduledEvent.description,
        eventAt: rescheduledEvent.event_at,
        clientName,
        clientPhone: client?.phone || null,
        clientAddress: getClientAddress(),
      });

      setEvent(rescheduledEvent as CalendarEvent);
      setMeetingEffectStatus("");
      setMeetingEffectDescription("");
      setNextContactType("phone");
      setNextContactAt("");
      setRescheduledMeetingAt("");
      setSelectedMeetingOwnerId(canChooseMeetingOwner() ? "" : currentUserId || "");
      setShowMeetingEffectPanel(false);
      setSavingMeetingEffect(false);

      alert("Spotkanie zostało przełożone na nowy termin.");
      return;
    }

    if (needsNextContact) {
      const nextEventAt = localDateTimeToIso(nextContactAt);

      const { error: nextEventError } = await supabase.from("calendar_events").insert({
        client_id: event.client_id,
        source_activity_id: event.source_activity_id,
        title:
          nextContactType === "phone"
            ? "Ponowny kontakt: Zainteresowany"
            : `Spotkanie: ${clientName}`,
        description,
        event_type: nextContactType === "phone" ? "reminder" : "meeting",
        event_at: nextEventAt,
        status: "planned",
        created_by: nextContactType === "meeting" ? chosenMeetingOwnerId : user?.id || null,
      });

      if (nextEventError) {
        console.error(
          "Efekt spotkania zapisany, ale nie udało się utworzyć kolejnego kontaktu:",
          nextEventError
        );
        alert(
          `Efekt spotkania zapisany, ale nie udało się utworzyć kolejnego kontaktu: ${nextEventError.message}`
        );
        setSavingMeetingEffect(false);
        return;
      }
    }

    const completedStatus = `Zakończone - ${meetingEffectStatus}`;

    const { data: completedEvent, error: completeEventError } = await supabase
      .from("calendar_events")
      .update({ status: completedStatus })
      .eq("id", event.id)
      .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error")
      .single();

    if (completeEventError || !completedEvent) {
      console.error(
        "Efekt spotkania został zapisany, ale nie udało się zamknąć wydarzenia:",
        completeEventError
      );
      alert(
        `Efekt spotkania został zapisany, ale nie udało się zamknąć wydarzenia.\n\n${
          completeEventError?.message || "Brak szczegółów błędu."
        }`
      );
      setSavingMeetingEffect(false);
      return;
    }

    setEvent(completedEvent as CalendarEvent);
    setMeetingEffectStatus("");
    setMeetingEffectDescription("");
    setNextContactType("phone");
    setNextContactAt("");
    setRescheduledMeetingAt("");
    setSelectedMeetingOwnerId(canChooseMeetingOwner() ? "" : currentUserId || "");
    setShowMeetingEffectPanel(false);
    setSavingMeetingEffect(false);

    alert("Efekt spotkania został zapisany, a wydarzenie oznaczono jako zakończone.");
  }

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    setLoading(true);
    setErrorMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);

    let visibleIds: string[] | null = null;
    let loadedRole: string | null = null;

    if (user?.id) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      loadedRole = profileData?.role || null;

      setCurrentUserRole(loadedRole);
      setSelectedMeetingOwnerId(
        ["cc", "admin", "owner"].includes(loadedRole || "") ? "" : user.id
      );

      visibleIds = await loadVisibleUserIds(user.id, loadedRole);

      if (["cc", "admin", "owner", "manager", "seller"].includes(loadedRole || "")) {
        let usersQuery = supabase
          .from("profiles")
          .select("id, display_name, role, email, manager_id")
          .eq("hidden_from_assignment", false)
          .order("display_name", { ascending: true });

        if (loadedRole === "manager" && visibleIds?.length) {
          usersQuery = usersQuery.in("id", visibleIds);
        } else if (loadedRole === "seller") {
          usersQuery = usersQuery.in("role", ["seller", "manager", "owner", "admin"]);
        } else {
          usersQuery = usersQuery.in("role", [
            "seller",
            "manager",
            "owner",
            "admin",
            "cc",
          ]);
        }

  

        const { data: usersData } = await usersQuery;

        setAssignableUsers((usersData || []) as AssignableUser[]);
      }
    }

    let { data: eventData, error: eventError } = await supabase
      .from("calendar_events")
      .select(
        "id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, assigned_user_id, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error"
      )
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !eventData) {
      const { data: fallbackEventData, error: fallbackEventError } = await supabase
        .from("calendar_events")
        .select(
          "id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by, assigned_user_id, microsoft_event_id, microsoft_event_url, microsoft_sync_status, microsoft_sync_error"
        )
        .eq("source_activity_id", eventId)
        .maybeSingle();

      if (fallbackEventError || !fallbackEventData) {
        console.error("Błąd ładowania wydarzenia:", eventError || fallbackEventError);
        setErrorMessage(
          eventError?.message ||
            fallbackEventError?.message ||
            "Nie znaleziono wydarzenia w tabeli calendar_events."
        );
        setLoading(false);
        return;
      }

      eventData = fallbackEventData;
    }

    // Permissions check: if user has visibleUserIds, restrict access
    const loadedEventOwnerId = eventData.assigned_user_id || eventData.created_by;

    if (
      visibleUserIds &&
      loadedEventOwnerId &&
      !visibleUserIds.includes(loadedEventOwnerId)
    ) {
      setErrorMessage("Nie masz uprawnień do podglądu tego wydarzenia.");
      setLoading(false);
      return;
    }

    setEvent(eventData as CalendarEvent);
    const loadedOwnerProfileId = eventData.assigned_user_id || eventData.created_by;
    if (loadedOwnerProfileId) {
      const { data: ownerData, error: ownerError } = await supabase
        .from("profiles")
        .select("id, display_name, role, email")
        .eq("id", loadedOwnerProfileId)
        .maybeSingle();

      if (ownerError) {
        console.error("Błąd ładowania opiekuna wydarzenia:", ownerError);
      }

      setEventOwner((ownerData as EventOwner) || null);
    } else {
      setEventOwner(null);
    }

    const { data: existingSale } = await supabase
      .from("sales")
      .select("id")
      .eq("event_id", eventData.id)
      .maybeSingle();

    if (existingSale?.id) {
      setExistingSaleId(existingSale.id);
    }

    if (eventData.client_id) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, company_name, phone, email, city, street, building_number, postal_code, address")
        .eq("id", eventData.client_id)
        .maybeSingle();

      if (clientError) {
        console.error("Błąd ładowania klienta:", clientError);
      }

      setClient((clientData as Client) || null);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="text-slate-900">
        <div>
          <p className="text-slate-500">Ładowanie wydarzenia...</p>
        </div>
      </main>
    );
  }

  if (errorMessage || !event) {
    return (
      <main className="text-slate-900">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Nie udało się otworzyć wydarzenia
          </h1>

          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {errorMessage}
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Szukane ID:</p>
            <p className="break-all">{eventId}</p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/calendar")}
            className="inline-flex px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold"
          >
            Wróć do kalendarza
          </button>
        </div>
      </main>
    );
  }

  const visibleEventId = `EV-${String(event.id).slice(0, 8).toUpperCase()}`;
  const clientName = client?.full_name || client?.company_name || "Brak klienta";
  const isReminderEvent = event.event_type === "reminder";
  const isMeetingEvent = event.event_type === "meeting";
  const isDoneEvent = isCompletedEvent(event.status);
  const eventStatusLabel = event.status === "done" ? "Zakończone" : event.status || "Brak statusu";

  const previousContactStatus = isReminderEvent && event.title.startsWith("Ponowny kontakt: ")
    ? event.title.replace("Ponowny kontakt: ", "")
    : "";

  const taskTitle = isReminderEvent
    ? "Zadanie: ponowny kontakt z klientem"
    : event.title;

  const taskReason = previousContactStatus
    ? `Poprzedni status telefonu: ${previousContactStatus}`
    : "Powód: zaplanowano ponowny kontakt po wcześniejszej aktywności telefonicznej.";

  const previousContactStatusStyles: Record<string, string> = {
    "nie odbiera": "bg-red-100 text-red-900 border-red-200",
    "prośba o ponowny kontakt": "bg-amber-100 text-amber-900 border-amber-200",
    niezainteresowany: "bg-slate-100 text-slate-800 border-slate-200",
    "umówione spotkanie": "bg-emerald-100 text-emerald-900 border-emerald-200",
  };

  const previousContactStatusClass =
    previousContactStatusStyles[previousContactStatus] ||
    "bg-slate-100 text-slate-800 border-slate-200";

  const taskEffectNeedsReminder =
    taskPhoneStatus === "nie odbiera" ||
    taskPhoneStatus === "prośba o ponowny kontakt";

  const minimumReminderDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  const meetingEffectNeedsNextContact = meetingEffectStatus === "Zainteresowany";

  


  return (
    <main className="text-slate-900">
      <div className="space-y-6">

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-1">{visibleEventId}</p>

          <h1 className="text-3xl font-bold text-slate-900">{taskTitle}</h1>
          {eventOwner?.display_name && (
            <div className="mt-2 text-sm text-slate-500">
              <p className="font-semibold">
                Opiekun: {eventOwner.display_name}
              </p>
              {eventOwner.role && (
                <p className="text-xs text-slate-400 mt-1">
                  Rola: {eventOwner.role}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Adres klienta</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{getClientAddress()}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Telefon</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{client?.phone || "Brak telefonu"}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">E-mail</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">{client?.email || "Brak e-maila"}</p>
            </div>
          </div>

          {event.description && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Notatka z wydarzenia</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                event.event_type === "meeting"
                  ? isDoneEvent
                    ? "bg-slate-100 text-slate-800"
                    : "bg-sky-100 text-sky-900"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {event.event_type === "meeting" ? "Spotkanie" : "Zadanie"}
            </span>

            <span
              className={`px-3 py-1 rounded-full border text-sm font-semibold ${getEventStatusStyle(
                event.status
              )}`}
            >
              {eventStatusLabel}
            </span>

            <div className="ml-auto flex items-center gap-3 flex-wrap">
              {event.client_id && (
                <button
                  type="button"
                  onClick={() => router.push(`/clients/${event.client_id}`)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition"
                >
                  Powrót na kartę klienta
                </button>
              )}

              {isMeetingEvent && !isDoneEvent && canReassignEvent() ? (
                <button
                  type="button"
                  onClick={() => setShowReassignPanel((current) => !current)}
                  className="px-4 py-2 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold transition"
                >
                  {showReassignPanel ? "Zwiń przepisywanie" : "Przepisz spotkanie"}
                </button>
              ) : null}

              {isReminderEvent && !isDoneEvent ? (
                <button
                  type="button"
                  onClick={() => setShowTaskEffectPanel((current) => !current)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold transition"
                >
                  {showTaskEffectPanel ? "Zwiń efekt zadania" : "Ustaw efekt zadania"}
                </button>
              ) : isMeetingEvent && !isDoneEvent ? (
                <button
                  type="button"
                  onClick={() => setShowMeetingEffectPanel((current) => !current)}
                  className="px-4 py-2 rounded-xl bg-[#FF4AC1] hover:opacity-90 text-white font-semibold transition"
                >
                  {showMeetingEffectPanel ? "Zwiń efekt spotkania" : "Efekt spotkania"}
                </button>
              ) : existingSaleId ? (
                <button
                  type="button"
                  onClick={() => router.push(`/sales/${existingSaleId}`)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white font-semibold transition"
                >
                  Otwórz sprzedaż
                </button>
              ) : null}
            </div>
          </div>
        </section>
        {isMeetingEvent && !isDoneEvent && showReassignPanel && canReassignEvent() && (
          <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold text-blue-700">Przepisanie spotkania</p>
              <h2 className="text-xl font-bold text-slate-900">Zmień doradcę przypisanego do spotkania</h2>
              <p className="mt-1 text-sm text-slate-500">
                Zmiana dotyczy CRM. Synchronizację Outlook/Teams zostawiamy bez zmian na późniejszy etap.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Obecny doradca</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {eventOwner?.display_name || event.assigned_user_id || event.created_by || "Brak przypisania"}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-blue-700">
                  Nowy doradca
                </label>
                <select
                  value={selectedReassignUserId}
                  onChange={(input) => setSelectedReassignUserId(input.target.value)}
                  className="w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                >
                  <option value="">Wybierz nowego doradcę</option>
                  {getReassignableUsers().map((assignableUser) => (
                    <option key={assignableUser.id} value={assignableUser.id}>
                      {assignableUser.display_name || assignableUser.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReassignPanel(false);
                  setSelectedReassignUserId("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={reassignEventOwner}
                disabled={savingReassign || !selectedReassignUserId}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {savingReassign ? "Przepisywanie..." : "Przepisz spotkanie"}
              </button>
            </div>
          </section>
        )}

        {isReminderEvent && !isDoneEvent && showTaskEffectPanel && (
          <section className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <p className="text-sm text-amber-700 font-semibold mb-1">
                  Efekt zadania
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  Ustaw wynik ponownego kontaktu
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Powód zadania: {taskReason}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                  Typ kontaktu
                </label>
                <select
                  value="Kontakt marketingowy"
                  disabled
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <option>Kontakt marketingowy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                  Efekt kontaktu
                </label>
                <select
                  value={taskPhoneStatus}
                  onChange={(input) => setTaskPhoneStatus(input.target.value as PhoneStatus)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400"
                >
                  <option value="">Wybierz efekt</option>
                  <option value="nie odbiera">Nie odbiera</option>
                  <option value="prośba o ponowny kontakt">Prośba o ponowny kontakt</option>
                  <option value="niezainteresowany">Niezainteresowany</option>
                  <option value="umówione spotkanie">Umówione spotkanie</option>
                </select>
              </div>
            </div>

            {taskEffectNeedsReminder && (
              <div className="mt-4">
                <DateTimePicker
                  label="Termin kolejnego ponownego kontaktu"
                  value={taskReminderAt}
                  onChange={setTaskReminderAt}
                />
              </div>
            )}

            {taskPhoneStatus === "umówione spotkanie" && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <DateTimePicker
                  label="Termin spotkania"
                  value={taskMeetingAt}
                  onChange={setTaskMeetingAt}
                />

                {canChooseMeetingOwner() && (
                  <div className="mt-4">
                    <label className="block text-xs uppercase font-semibold text-blue-700 mb-2">
                      Kalendarz użytkownika
                    </label>

                    <select
                      value={selectedMeetingOwnerId}
                      onChange={(input) => setSelectedMeetingOwnerId(input.target.value)}
                      className="w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                    >
                      <option value="">Wybierz użytkownika</option>

                      {assignableUsers.map((assignableUser) => (
                        <option key={assignableUser.id} value={assignableUser.id}>
                          {assignableUser.display_name || assignableUser.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <textarea
              value={taskDescription}
              onChange={(input) => setTaskDescription(input.target.value)}
              placeholder="Opis efektu kontaktu..."
              className="w-full min-h-[120px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 mt-4"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowTaskEffectPanel(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={saveTaskEffect}
                disabled={
                  savingTaskEffect ||
                  !taskPhoneStatus ||
                  (taskEffectNeedsReminder && !taskReminderAt) ||
                  (taskPhoneStatus === "umówione spotkanie" &&
                    (!taskMeetingAt ||
                      (canChooseMeetingOwner() && !selectedMeetingOwnerId)))
                }
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold text-sm"
              >
                {savingTaskEffect ? "Zapisywanie..." : "Zapisz efekt zadania"}
              </button>
            </div>
          </section>
        )}

        {isMeetingEvent && !isDoneEvent && showMeetingEffectPanel && (
          <section className="bg-white rounded-2xl shadow-sm border border-pink-200 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <p className="text-sm text-[#FF4AC1] font-semibold mb-1">
                  Efekt spotkania
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  Ustaw wynik spotkania
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Zapisz notatkę i zdecyduj, co dalej z klientem.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                  Efekt spotkania
                </label>
                <select
                  value={meetingEffectStatus}
                  onChange={(input) => {
                    setMeetingEffectStatus(input.target.value as MeetingEffectStatus);
                    setNextContactAt("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-pink-400"
                >
                  <option value="">Wybierz efekt</option>
                  <option value="Zainteresowany">Zainteresowany</option>
                  <option value="Niezainteresowany">Niezainteresowany</option>
                  <option value="Rezygnacja">Rezygnacja</option>
                  <option value="Przełożenie">Przełożenie</option>
                  <option value="Sprzedaż">Sprzedaż</option>
                </select>
              </div>

              {meetingEffectNeedsNextContact && (
                <div>
                  <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                    Forma kolejnego kontaktu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNextContactType("phone")}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                        nextContactType === "phone"
                          ? "border-[#FF4AC1] bg-[#FF4AC1] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Telefon
                    </button>
                    <button
                      type="button"
                      onClick={() => setNextContactType("meeting")}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                        nextContactType === "meeting"
                          ? "border-[#FF4AC1] bg-[#FF4AC1] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Spotkanie
                    </button>
                  </div>
                </div>
              )}
            </div>

            {meetingEffectNeedsNextContact && (
              <div className="mt-4">
                <DateTimePicker
                  label="Data kolejnego kontaktu"
                  value={nextContactAt}
                  onChange={setNextContactAt}
                />

                {nextContactType === "meeting" && canChooseMeetingOwner() && (
                  <div className="mt-4">
                    <label className="block text-xs uppercase font-semibold text-pink-700 mb-2">
                      Kalendarz użytkownika
                    </label>

                    <select
                      value={selectedMeetingOwnerId}
                      onChange={(input) => setSelectedMeetingOwnerId(input.target.value)}
                      className="w-full rounded-xl border border-pink-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-pink-400"
                    >
                      <option value="">Wybierz użytkownika</option>

                      {assignableUsers.map((assignableUser) => (
                        <option key={assignableUser.id} value={assignableUser.id}>
                          {assignableUser.display_name || assignableUser.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            {meetingEffectStatus === "Przełożenie" && (
              <div className="mt-4 block">
                <DateTimePicker
                  label="Nowy termin spotkania"
                  value={rescheduledMeetingAt}
                  onChange={setRescheduledMeetingAt}
                />
              </div>
            )}

            <textarea
              value={meetingEffectDescription}
              onChange={(input) => setMeetingEffectDescription(input.target.value)}
              placeholder="Opis efektu spotkania..."
              className="w-full min-h-[120px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-pink-400 mt-4"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowMeetingEffectPanel(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={saveMeetingEffect}
                disabled={
                  savingMeetingEffect ||
                  !meetingEffectStatus ||
                  !meetingEffectDescription.trim() ||
                  (meetingEffectNeedsNextContact && !nextContactAt) ||
                  (meetingEffectStatus === "Przełożenie" && !rescheduledMeetingAt) ||
                  (meetingEffectNeedsNextContact &&
                    nextContactType === "meeting" &&
                    canChooseMeetingOwner() &&
                    !selectedMeetingOwnerId)
                }
                className="px-5 py-2.5 rounded-xl bg-[#FF4AC1] hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm"
              >
                {savingMeetingEffect ? "Zapisywanie..." : "Zapisz efekt spotkania"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}