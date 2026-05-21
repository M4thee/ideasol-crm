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
};

type Client = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
};

type EventOwner = {
  id: string;
  display_name: string | null;
  role: string | null;
};

type AssignableUser = {
  id: string;
  display_name: string | null;
  role: string | null;
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

  function localDateTimeToIso(value: string) {
    if (!value) return null;
    return new Date(value).toISOString();
  }

  function canChooseMeetingOwner() {
    return ["cc", "admin", "owner"].includes(currentUserRole || "");
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

  async function createSaleFromEvent() {
    if (!event) return;

    try {
      setCreatingSale(true);

      const { data: authData } = await supabase.auth.getUser();

      const { data: existingSale, error: existingSaleError } = await supabase
        .from("sales")
        .select("id")
        .eq("event_id", event.id)
        .maybeSingle<SaleInsertResult>();

      if (existingSaleError) {
        const supabaseError = existingSaleError as SupabaseErrorDetails;

        console.error("Błąd sprawdzania istniejącej sprzedaży:", existingSaleError);

        alert(
          `Nie udało się sprawdzić, czy sprzedaż już istnieje.\n\n` +
            `Message: ${supabaseError.message || "brak"}\n` +
            `Details: ${supabaseError.details || "brak"}\n` +
            `Hint: ${supabaseError.hint || "brak"}\n` +
            `Code: ${supabaseError.code || "brak"}`
        );

        return;
      }

      if (existingSale?.id) {
        setExistingSaleId(existingSale.id);
        router.push(`/sales/${existingSale.id}`);
        return;
      }

      const payload: SaleInsertPayload = {
        event_id: event.id,
        client_id: event.client_id,
        seller_id: authData.user?.id || event.created_by || null,
        sale_date: new Date().toISOString(),
        status: "Oczekiwanie na zaksięgowanie zaliczki",
      };

      console.log("Tworzenie sprzedaży - payload:", payload);

      const { data, error } = await supabase
        .from("sales")
        .insert(payload)
        .select("id")
        .single<SaleInsertResult>();

      if (error || !data) {
        const supabaseError = error as SupabaseErrorDetails | null;

        console.error("Błąd tworzenia sprzedaży:", error);

        if (supabaseError?.code === "23505") {
          const { data: duplicateSale } = await supabase
            .from("sales")
            .select("id")
            .eq("event_id", event.id)
            .maybeSingle<SaleInsertResult>();

          if (duplicateSale?.id) {
            setExistingSaleId(duplicateSale.id);
            router.push(`/sales/${duplicateSale.id}`);
            return;
          }
        }

        alert(
          `Nie udało się utworzyć sprzedaży.\n\n` +
            `Message: ${supabaseError?.message || "brak"}\n` +
            `Details: ${supabaseError?.details || "brak"}\n` +
            `Hint: ${supabaseError?.hint || "brak"}\n` +
            `Code: ${supabaseError?.code || "brak"}`
        );

        return;
      }

      router.push(`/sales/${data.id}`);
    } catch (error) {
      console.error("Nieoczekiwany błąd tworzenia sprzedaży:", error);

      alert(
        `Wystąpił nieoczekiwany błąd podczas tworzenia sprzedaży.\n\n${
          error instanceof Error ? error.message : "Brak szczegółów błędu."
        }`
      );
    } finally {
      setCreatingSale(false);
    }
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
      .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by")
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
        .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by")
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

      await createSaleFromEvent();
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
        .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by")
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
      .select("id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by")
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

    if (user?.id) {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const loadedRole = profileData?.role || null;

      setCurrentUserRole(loadedRole);
      setSelectedMeetingOwnerId(
        ["cc", "admin", "owner"].includes(loadedRole || "") ? "" : user.id
      );

      if (["cc", "admin", "owner"].includes(loadedRole || "")) {
        const { data: usersData } = await supabase
          .from("user_profiles")
          .select("id, display_name, role")
          .in("role", ["seller", "owner", "admin", "cc"])
          .eq("hidden_from_assignment", false)
          .order("display_name", { ascending: true });

        setAssignableUsers((usersData || []) as AssignableUser[]);
      }
    }

    const { data: eventData, error: eventError } = await supabase
      .from("calendar_events")
      .select(
        "id, source_activity_id, client_id, title, description, event_type, event_at, status, created_by"
      )
      .eq("id", eventId)
      .single();

    if (eventError || !eventData) {
      console.error("Błąd ładowania wydarzenia:", eventError);
      setErrorMessage(
        eventError?.message || "Nie znaleziono wydarzenia w tabeli calendar_events."
      );
      setLoading(false);
      return;
    }

    setEvent(eventData as CalendarEvent);
    if (eventData.created_by) {
      const { data: ownerData, error: ownerError } = await supabase
        .from("user_profiles")
        .select("id, display_name, role")
        .eq("id", eventData.created_by)
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
        .select("id, full_name, company_name, phone, email, city")
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
            onClick={() => router.push("/kalendarz")}
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
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Opiekun: {eventOwner.display_name}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
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
              ) : isMeetingEvent && !isDoneEvent ? (
                <button
                  type="button"
                  onClick={createSaleFromEvent}
                  disabled={creatingSale}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold transition"
                >
                  {creatingSale ? "Tworzenie sprzedaży..." : "Dodaj sprzedaż"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

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
                <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                  Termin kolejnego ponownego kontaktu
                </label>
                <input
                  type="datetime-local"
                  value={taskReminderAt}
                  min={minimumReminderDateTime}
                  onChange={(input) => setTaskReminderAt(input.target.value)}
                  className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400"
                />
                <p className="text-xs text-amber-700 mt-2">
                  Ten efekt utworzy kolejne zadanie w kalendarzu CRM.
                </p>
              </div>
            )}

            {taskPhoneStatus === "umówione spotkanie" && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <label className="block text-xs uppercase font-semibold text-blue-700 mb-2">
                  Termin spotkania
                </label>
                <input
                  type="datetime-local"
                  value={taskMeetingAt}
                  min={minimumReminderDateTime}
                  onChange={(input) => setTaskMeetingAt(input.target.value)}
                  className="w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                />
                <p className="text-xs text-blue-700 mt-2">
                  Ten efekt utworzy spotkanie w kalendarzu CRM.
                </p>

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
                <label className="block text-xs uppercase font-semibold text-slate-400 mb-2">
                  Data kolejnego kontaktu
                </label>
                <input
                  type="datetime-local"
                  value={nextContactAt}
                  min={minimumReminderDateTime}
                  onChange={(input) => setNextContactAt(input.target.value)}
                  className="w-full rounded-xl border border-pink-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-pink-400"
                />
                <p className="text-xs text-pink-700 mt-2">
                  Ten efekt utworzy kolejny kontakt w kalendarzu CRM.
                </p>

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
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <label className="block text-xs uppercase font-semibold text-blue-700 mb-2">
                  Nowy termin spotkania
                </label>
                <input
                  type="datetime-local"
                  value={rescheduledMeetingAt}
                  min={minimumReminderDateTime}
                  onChange={(input) => setRescheduledMeetingAt(input.target.value)}
                  className="w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                />
                <p className="text-xs text-blue-700 mt-2">
                  Ten efekt zmieni termin obecnego spotkania w kalendarzu CRM.
                </p>
              </div>
            )}

            {meetingEffectStatus === "Sprzedaż" && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Ten efekt otworzy formularz dodania sprzedaży i utworzy nowy Sale ID.
              </div>
            )}

            <textarea
              value={meetingEffectDescription}
              onChange={(input) => setMeetingEffectDescription(input.target.value)}
              placeholder="Notatka z efektu spotkania..."
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
                  (meetingEffectNeedsNextContact &&
                    (!nextContactAt ||
                      (nextContactType === "meeting" &&
                        canChooseMeetingOwner() &&
                        !selectedMeetingOwnerId))) ||
                  (meetingEffectStatus === "Przełożenie" && !rescheduledMeetingAt)
                }
                className={`px-5 py-2.5 rounded-xl disabled:opacity-50 text-white font-bold text-sm transition ${
                  meetingEffectStatus === "Niezainteresowany"
                    ? "bg-[#6B6464] hover:opacity-90"
                    : meetingEffectStatus === "Rezygnacja"
                      ? "bg-[#780707] hover:opacity-90"
                      : meetingEffectStatus === "Przełożenie"
                        ? "bg-blue-600 hover:bg-blue-500"
                        : meetingEffectStatus === "Sprzedaż"
                          ? "bg-[#138525] hover:opacity-90"
                          : "bg-[#FF4AC1] hover:opacity-90"
                }`}
              >
                {savingMeetingEffect || creatingSale ? "Zapisywanie..." : "Zapisz efekt spotkania"}
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Szczegóły wydarzenia
            </h2>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Termin
                </p>
                <p className="font-bold text-slate-900">
                  {new Date(event.event_at).toLocaleString("pl-PL")}
                </p>
              </div>
              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Opiekun wydarzenia
                </p>
                <p className="font-bold text-slate-900">
                  {eventOwner?.display_name || "Brak opiekuna"}
                </p>
                {eventOwner?.role && (
                  <p className="text-xs text-slate-500 mt-1">
                    Rola: {eventOwner.role}
                  </p>
                )}
              </div>

              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Opis
                </p>
                <div className="space-y-3">
                  <p className="text-slate-800 whitespace-pre-wrap">
                    {event.description || "Brak opisu"}
                  </p>

                  {isReminderEvent && (
                    <div className={`rounded-xl border p-4 ${previousContactStatusClass}`}>
                      <p className="text-xs uppercase font-semibold opacity-80 mb-1">
                        Zadanie
                      </p>

                      <p className="font-bold">
                        Ponowny kontakt z klientem
                      </p>

                      <div className="mt-3 rounded-lg bg-white/60 border border-white/70 px-3 py-2">
                        <p className="text-xs uppercase font-semibold opacity-70 mb-1">
                          Powód utworzenia zadania
                        </p>

                        <p className="font-semibold">
                          {taskReason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Source Activity ID
                </p>
                <p className="text-slate-800">
                  {event.source_activity_id || "Brak"}
                </p>
              </div>
            </div>
          </section>

          <aside className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Klient</h2>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Nazwa
                </p>
                <p className="font-bold text-slate-900">{clientName}</p>
              </div>

              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Telefon
                </p>
                <p className="text-slate-800">{client?.phone || "Brak"}</p>
              </div>

              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Email
                </p>
                <p className="text-slate-800">{client?.email || "Brak"}</p>
              </div>

              <div>
                <p className="text-slate-400 uppercase font-semibold text-xs mb-1">
                  Miasto
                </p>
                <p className="text-slate-800">{client?.city || "Brak"}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}