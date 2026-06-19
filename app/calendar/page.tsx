// REPLACEMENT FILE CONTENT
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CalendarItem = {
  id: string;
  event_id: string;
  source_activity_id: string | null;
  client_id: string;
  title: string;
  description: string | null;
  date: string;
  type: "meeting" | "phone_call" | "reminder";
  status: string | null;
  client_name: string;
  owner_id: string | null;
  owner_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
};

type CalendarView = "month" | "week" | "day";

type CalendarOwner = {
  id: string;
  display_name: string | null;
  role: string | null;
  manager_id?: string | null;
};

type AdvisorForCalendarEvent = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type ClientForCalendarEvent = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  address: string | null;
};

export default function CalendarPage() {
  const router = useRouter();
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "owner" | "manager" | "seller" | "cc">("seller");
  const [calendarOwners, setCalendarOwners] = useState<CalendarOwner[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [isOwnerFilterOpen, setIsOwnerFilterOpen] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [clientsForEvent, setClientsForEvent] = useState<ClientForCalendarEvent[]>([]);
  const [advisorsForEvent, setAdvisorsForEvent] = useState<AdvisorForCalendarEvent[]>([]);
  const [newEventAdvisorId, setNewEventAdvisorId] = useState("");
  const [newEventAdvisorSearch, setNewEventAdvisorSearch] = useState("");
  const [newEventClientId, setNewEventClientId] = useState("");
  const [newEventClientSearch, setNewEventClientSearch] = useState("");
  const [newEventType, setNewEventType] = useState<"meeting" | "phone_call">("meeting");
  const [newEventAt, setNewEventAt] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [createEventError, setCreateEventError] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  useEffect(() => {
    initializeCalendar();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    loadCalendarItems();
  }, [currentUserId, currentUserRole, selectedOwnerIds, visibleUserIds, currentDate]);

  // --- Manager-aware calendar visibility scopes ---
  async function loadVisibleUserIds(
    userId: string,
    role: string
  ) {
    if (["admin", "owner"].includes(role)) {
      setVisibleUserIds(null);
      return null;
    }

    if (["seller", "cc"].includes(role)) {
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
  async function initializeCalendar() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId(null);
      setCalendarItems([]);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .maybeSingle();

    setCurrentUserRole(
      (profileData?.role || "seller") as "admin" | "owner" | "manager" | "seller" | "cc"
    );
    const role = (profileData?.role || "seller") as "admin" | "owner" | "manager" | "seller" | "cc";

    const ids = await loadVisibleUserIds(user.id, role);

    if (role === "seller") {
      setCalendarOwners([
        {
          id: user.id,
          display_name: profileData?.display_name || "Moje spotkania",
          role,
        },
      ]);
      setSelectedOwnerIds([user.id]);
      return;
    }

    const { data: ownersData, error: ownersError } = await supabase
  .from("profiles")
  .select("id, display_name, role, manager_id")
  .eq("hidden_from_assignment", false)
  .order("display_name", { ascending: true });

    let filteredOwners = ownersData || [];

    if (role === "manager" && ids?.length) {
      filteredOwners = filteredOwners.filter((owner) =>
        ids.includes(owner.id)
      );
    }

    if (ownersError) {
      console.error("Błąd ładowania użytkowników do filtra kalendarza", ownersError);
      setCalendarOwners([]);
      return;
    }

    setCalendarOwners(filteredOwners as CalendarOwner[]);
  }

  async function loadCalendarItems() {
    setLoading(true);

    const rangeStart = new Date(currentDate);
    rangeStart.setDate(rangeStart.getDate() - 45);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(currentDate);
    rangeEnd.setDate(rangeEnd.getDate() + 45);
    rangeEnd.setHours(23, 59, 59, 999);

    let query = supabase
      .from("calendar_events")
      .select(
        "id, client_id, source_activity_id, event_type, title, description, event_at, status, created_by, assigned_user_id"
      )
      .not("event_at", "is", null)
      .gte("event_at", rangeStart.toISOString())
      .lte("event_at", rangeEnd.toISOString())
      .order("event_at", { ascending: true });

    const canSeeAllCalendarEvents = ["admin", "owner", "cc"].includes(currentUserRole);

    if (selectedOwnerIds.length > 0) {
      query = query.in("assigned_user_id", selectedOwnerIds);
    } else if (!canSeeAllCalendarEvents && visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("assigned_user_id", visibleUserIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania kalendarza", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setCalendarItems([]);
      setLoading(false);
      return;
    }

    const clientIds = [
      ...new Set(data.map((item) => item.client_id).filter(Boolean)),
    ];

    const { data: clientsData, error: clientsError } = clientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, full_name, company_name")
          .in("id", clientIds)
      : { data: [], error: null };

    if (clientsError) {
      console.error("Błąd ładowania klientów dla kalendarza", clientsError);
    }

    const clientsById = new Map(
      (clientsData || []).map((client) => [
        client.id,
        client.full_name || client.company_name || "Klient",
      ])
    );

    const ownerIds = [
      ...new Set([
        ...data.map((item) => item.created_by).filter(Boolean),
        ...data.map((item) => item.assigned_user_id).filter(Boolean),
      ]),
    ];

    const { data: ownersData, error: ownersError } = ownerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, role")
          .in("id", ownerIds)
      : { data: [], error: null };

    if (ownersError) {
      console.error("Błąd ładowania właścicieli wydarzeń", ownersError);
    }

    const ownersById = new Map(
      (ownersData || []).map((owner) => [
        owner.id,
        owner.display_name || "Użytkownik",
      ])
    );

    const parsedItems: CalendarItem[] = data.map((item: any) => ({
      id: item.id,
      event_id: `EV-${String(item.id).slice(0, 8).toUpperCase()}`,
      source_activity_id: item.source_activity_id || null,
      client_id: item.client_id,
      title: item.title,
      description: item.description,
      date: item.event_at,
      type:
        item.event_type === "meeting"
          ? "meeting"
          : item.event_type === "phone_call"
            ? "phone_call"
            : "reminder",
      status: item.status || null,
      client_name: clientsById.get(item.client_id) || "Klient",
      owner_id: item.created_by || null,
      owner_name: item.created_by ? ownersById.get(item.created_by) || "Użytkownik" : null,
      assigned_user_id: item.assigned_user_id || null,
      assigned_user_name: item.assigned_user_id ? ownersById.get(item.assigned_user_id) || "Doradca" : null,
    }));

    setCalendarItems(parsedItems);
    setLoading(false);
  }

  function getItemsForDate(date: Date) {
    return calendarItems.filter((item) => {
      const itemDate = new Date(item.date);

      return (
        itemDate.getFullYear() === date.getFullYear() &&
        itemDate.getMonth() === date.getMonth() &&
        itemDate.getDate() === date.getDate()
      );
    });
  }

  function isToday(date: Date) {
    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  function openCalendarItem(event: React.MouseEvent, item: CalendarItem) {
    event.stopPropagation();
    setSelectedItem(item);
  }

  function openEventPage(item: CalendarItem) {
    router.push(`/event/${item.id}`);
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

  function getClientDisplayName(client: ClientForCalendarEvent) {
    return client.full_name || client.company_name || client.contact_person || "Klient bez nazwy";
  }

  function getClientLocation(client: ClientForCalendarEvent) {
    if (client.address) return client.address;

    const streetLine = [client.street, client.building_number]
      .filter(Boolean)
      .join(" ");

    const cityLine = [client.postal_code, client.city]
      .filter(Boolean)
      .join(" ");

    return [streetLine, cityLine]
      .filter(Boolean)
      .join(", ");
  }

async function loadClientsForEventModal() {
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, company_name, contact_person, email, phone, city, street, building_number, postal_code, address"
    )
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error(
      "Nie udało się pobrać klientów do formularza wydarzenia",
      error
    );
    setCreateEventError("Nie udało się pobrać listy klientów.");
    return;
  }

  setClientsForEvent((data || []) as ClientForCalendarEvent[]);
}

async function loadAdvisorsForEventModal() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role")
    .neq("role", "admin")
    .eq("hidden_from_assignment", false)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Nie udało się pobrać doradców do formularza wydarzenia", error);
    setCreateEventError("Nie udało się pobrać listy doradców.");
    return;
  }

  setAdvisorsForEvent((data || []) as AdvisorForCalendarEvent[]);
}
async function openCreateEventModal() {
  setCreateEventError("");

  setNewEventClientId("");
  setNewEventClientSearch("");
  setNewEventAdvisorId("");
  setNewEventAdvisorSearch("");
  setNewEventType("meeting");
  setNewEventAt("");
  setNewEventDescription(meetingDescriptionTemplate);

  if (clientsForEvent.length === 0) {
    await loadClientsForEventModal();
  }

  await loadAdvisorsForEventModal();

  setShowCreateEventModal(true);
}
async function closeCreateEventModal() {
  setShowCreateEventModal(false);
  setCreateEventError("");
}

// --- Sync created meeting to Outlook ---
async function syncCreatedMeetingToOutlook(params: {
  calendarEventId: string;
  title: string;
  description: string | null;
  meetingNote: string | null;
  eventAt: string;
  clientName: string;
  location: string;
  phone: string;
  advisorEmail: string | null;
}) {
  if (!currentUserId) return;
  const syncUserEmail = params.advisorEmail;

  if (!syncUserEmail) return;

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const response = await fetch("/api/microsoft/outlook/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail: syncUserEmail,
        assignedUserEmail: syncUserEmail,
        subject: params.title,
        body: "",
        meetingNote: params.meetingNote || "",
        clientName: params.clientName,
        clientPhone: params.phone,
        clientAddress: params.location,
        crmUrl: `${appUrl}/event/${params.calendarEventId}`,
        location: params.location,
        startDateTime: new Date(params.eventAt).toISOString(),
        endDateTime: addMinutesToIsoDateTime(params.eventAt, 60),
        timeZone: "Europe/Warsaw",
        reminderMinutesBeforeStart: 10,
      }),
    });

    const result = await response.json();
    console.log("Outlook/Teams sync result:", result);

    console.log("Outlook response status:", response.status);
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Nie udało się utworzyć wydarzenia Outlook.");
    }

    await supabase
      .from("calendar_events")
      .update({
        microsoft_event_id: result.microsoftEventId || null,
        microsoft_event_url: result.microsoftEventUrl || null,
        microsoft_sync_status: "synced",
        microsoft_sync_error: null,
      })
      .eq("id", params.calendarEventId);
  } catch (error) {
    console.error("Nie udało się zsynchronizować wydarzenia z Outlook", error);

    await supabase
      .from("calendar_events")
      .update({
        microsoft_sync_status: "error",
        microsoft_sync_error:
          error instanceof Error ? error.message : "Nieznany błąd synchronizacji Outlook.",
      })
      .eq("id", params.calendarEventId);
  }
}

async function createCalendarEventFromModal() {
  setCreateEventError("");

  if (!currentUserId) {
    setCreateEventError("Brak zalogowanego użytkownika.");
    return;
  }

  if (!newEventClientId) {
    setCreateEventError("Wybierz klienta.");
    return;
  }

  if (!newEventAdvisorId) {
    setCreateEventError("Wybierz doradcę.");
    return;
  }

  if (!newEventAt) {
    setCreateEventError("Wybierz datę i godzinę wydarzenia.");
    return;
  }

  const selectedClient = clientsForEvent.find((client) => client.id === newEventClientId);
  const selectedAdvisor = advisorsForEvent.find((advisor) => advisor.id === newEventAdvisorId) || null;
  const clientName = selectedClient ? getClientDisplayName(selectedClient) : "Klient";
  const eventTitle = `${newEventType === "meeting" ? "Spotkanie" : "Kontakt telefoniczny"}: ${clientName}`;
  const eventLocation = selectedClient ? getClientLocation(selectedClient) : "";
  const eventPhone = selectedClient?.phone || "";
  setCreatingEvent(true);

  const { data: createdEvent, error } = await supabase
    .from("calendar_events")
    .insert({
      client_id: newEventClientId,
      title: eventTitle,
      description: newEventDescription || null,
      event_type: newEventType,
      event_at: newEventAt,
      status: "planned",
      created_by: currentUserId,
      assigned_user_id: newEventAdvisorId,
      microsoft_sync_status: newEventType === "meeting" ? "pending" : "not_synced",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Nie udało się utworzyć wydarzenia", error);
    setCreateEventError("Nie udało się utworzyć wydarzenia.");
    setCreatingEvent(false);
    return;
  }

  if (createdEvent?.id && newEventType === "meeting") {
    await syncCreatedMeetingToOutlook({
      calendarEventId: createdEvent.id,
      title: eventTitle,
      description: newEventDescription || null,
      meetingNote: newEventDescription || null,
      eventAt: newEventAt,
      clientName,
      location: eventLocation,
      phone: eventPhone,
      advisorEmail: selectedAdvisor?.email || null,
    });
  }

  setCreatingEvent(false);
  setShowCreateEventModal(false);
  setNewEventClientId("");
  setNewEventClientSearch("");
  setNewEventAdvisorId("");
  setNewEventAdvisorSearch("");
  setNewEventType("meeting");
  setNewEventAt("");
  setNewEventDescription("");

  await loadCalendarItems();
}
  function toggleOwnerFilter(ownerId: string) {
    setSelectedOwnerIds((current) =>
      current.includes(ownerId)
        ? current.filter((id) => id !== ownerId)
        : [...current, ownerId]
    );
  }

  function selectAllOwners() {
    setSelectedOwnerIds([]);
  }

  function selectOnlyMe() {
    if (!currentUserId) return;
    setSelectedOwnerIds([currentUserId]);
  }

  function getOwnerFilterLabel() {
    if (currentUserRole === "seller") return "Moje spotkania";
    if (currentUserRole === "cc" && selectedOwnerIds.length === 0) return "Wszystkie spotkania";
    if (selectedOwnerIds.length === 0) return "Wszyscy użytkownicy";
    if (selectedOwnerIds.length === 1) {
      const owner = calendarOwners.find((item) => item.id === selectedOwnerIds[0]);
      return owner?.display_name || "Wybrany użytkownik";
    }
    return `${selectedOwnerIds.length} użytkowników`;
  }

  function isCompletedEvent(status: string | null) {
    return status === "done" || status?.startsWith("Zakończone");
  }

  function isOverdueEvent(item: CalendarItem) {
    return !isCompletedEvent(item.status) && new Date(item.date).getTime() < Date.now();
  }

  function getCalendarItemStyle(item: CalendarItem) {
    if (item.type === "phone_call") {
      return {
        card: "bg-violet-100 border-violet-200 hover:bg-violet-200",
        time: "text-violet-900",
        badge: "bg-violet-200 text-violet-900",
      };
    }
    if (item.status?.includes("Zainteresowany")) {
      return {
        card: "bg-[#FF4AC1]/10 border-[#FF4AC1]/30 hover:bg-[#FF4AC1]/15",
        time: "text-[#B00079]",
        badge: "bg-[#FF4AC1]/20 text-[#B00079]",
      };
    }

    if (item.status?.includes("Niezainteresowany")) {
      return {
        card: "bg-[#6B6464]/10 border-[#6B6464]/30 hover:bg-[#6B6464]/15",
        time: "text-[#4A4545]",
        badge: "bg-[#6B6464]/20 text-[#4A4545]",
      };
    }

    if (item.status?.includes("Rezygnacja")) {
      return {
        card: "bg-[#780707]/10 border-[#780707]/30 hover:bg-[#780707]/15",
        time: "text-[#780707]",
        badge: "bg-[#780707]/20 text-[#780707]",
      };
    }

    if (item.status?.includes("Sprzedaż")) {
      return {
        card: "bg-[#138525]/10 border-[#138525]/30 hover:bg-[#138525]/15",
        time: "text-[#0F6B1E]",
        badge: "bg-[#138525]/20 text-[#0F6B1E]",
      };
    }

    if (isCompletedEvent(item.status)) {
      return {
        card: "bg-slate-100 border-slate-200 hover:bg-slate-200",
        time: "text-slate-600",
        badge: "bg-slate-200 text-slate-700",
      };
    }

    if (isOverdueEvent(item)) {
      return {
        card: "bg-red-50 border-red-200 hover:bg-red-100",
        time: "text-red-900",
        badge: "bg-red-100 text-red-900",
      };
    }

    if (item.type === "meeting") {
      return {
        card: "bg-sky-100 border-sky-200 hover:bg-sky-200",
        time: "text-sky-900",
        badge: "bg-sky-200 text-sky-900",
      };
    }

    return {
      card: "bg-amber-100 border-amber-200 hover:bg-amber-200",
      time: "text-amber-900",
      badge: "bg-amber-200 text-amber-900",
    };
  }

  function getCalendarItemLabel(item: CalendarItem) {
    if (item.status?.includes("Zainteresowany")) return "Zainteresowany";
    if (item.status?.includes("Niezainteresowany")) return "Niezainteresowany";
    if (item.status?.includes("Rezygnacja")) return "Rezygnacja";
    if (item.status?.includes("Sprzedaż")) return "Sprzedaż";
    if (isCompletedEvent(item.status)) return "Zakończone";
    if (isOverdueEvent(item)) return "Zaległe";
    // "reminder" w tym kontekście to przypomnienie / ponowny kontakt / zadanie.
    if (item.type === "meeting") return "Spotkanie";
    if (item.type === "phone_call") return "Kontakt telefoniczny";
    return "Przypomnienie";
  }

  function getDisplayTitle(title: string) {
    return title
      .replace(/^Follow-up:\s*/i, "Ponowny kontakt: ")
      .replace(/^Follow up:\s*/i, "Ponowny kontakt: ")
      .replace(/^FollowUp:\s*/i, "Ponowny kontakt: ")
      .replace(/\bfollow-up\b/gi, "ponowny kontakt")
      .replace(/\bfollow up\b/gi, "ponowny kontakt");
  }

  function getWeekDays(date: Date) {
    const day = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - day);

    return Array.from({ length: 7 }, (_, index) => {
      const weekDay = new Date(monday);
      weekDay.setDate(monday.getDate() + index);
      return weekDay;
    });
  }

  function changePeriod(direction: "previous" | "next") {
    const multiplier = direction === "previous" ? -1 : 1;

    if (calendarView === "month") {
      setCurrentDate(
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + multiplier,
          1
        )
      );
      return;
    }

    if (calendarView === "week") {
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + multiplier * 7);
      setCurrentDate(nextDate);
      return;
    }

    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + multiplier);
    setCurrentDate(nextDate);
  }

  const headerLabel = (() => {
    if (calendarView === "month") {
      return currentDate.toLocaleDateString("pl-PL", {
        month: "long",
        year: "numeric",
      });
    }

    if (calendarView === "week") {
      const days = getWeekDays(currentDate);
      const firstDay = days[0].toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
      });
      const lastDay = days[6].toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return `${firstDay} - ${lastDay}`;
    }

    return currentDate.toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  })();

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      items: CalendarItem[];
    }> = [];

    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);

      days.push({
        date,
        isCurrentMonth: false,
        items: [],
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);

      days.push({
        date,
        isCurrentMonth: true,
        items: getItemsForDate(date),
      });
    }

    while (days.length % 7 !== 0) {
      const nextDate = new Date(
        year,
        month,
        totalDays + (days.length % 7) + 1
      );

      days.push({
        date: nextDate,
        isCurrentMonth: false,
        items: [],
      });
    }

    return days;
  }, [currentDate, calendarItems]);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  function getRoleLabel(role: string | null) {
  if (role === "owner") return "Członek Zarządu";
  if (role === "admin") return "Administrator";
  if (role === "manager") return "Manager";
  if (role === "cc") return "Konsultant CC";
  if (role === "seller") return "Doradca Techniczny";

  return role || "Użytkownik";
}
  const dayItems = useMemo(
    () => getItemsForDate(currentDate),
    [currentDate, calendarItems]
  );

  const filteredClientsForEvent = clientsForEvent
    .filter((client) => {
      const searchValue = newEventClientSearch.trim().toLowerCase();

      if (searchValue.length < 2) return false;

      return [
        client.full_name,
        client.company_name,
        client.contact_person,
        client.email,
        client.phone,
        client.address,
        client.street,
        client.building_number,
        client.postal_code,
        client.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    })
    .slice(0, 20);

  const selectedEventClient = clientsForEvent.find((client) => client.id === newEventClientId) || null;

  const filteredAdvisorsForEvent = advisorsForEvent
    .filter((advisor) => {
      const searchValue = newEventAdvisorSearch.trim().toLowerCase();

      if (searchValue.length < 2) return false;

      return [advisor.display_name, advisor.email, getRoleLabel(advisor.role)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchValue);
    })
    .slice(0, 20);

  const selectedEventAdvisor =
    advisorsForEvent.find((advisor) => advisor.id === newEventAdvisorId) || null;

  return (
    <main className="text-slate-900">
      <div className="space-y-6">

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setCalendarView("month")}
                className={`px-4 py-2 rounded-xl font-medium ${
                  calendarView === "month"
                    ? "bg-emerald-500 text-white"
                    : "border border-slate-300 bg-white text-slate-600"
                }`}
              >
                Miesiąc
              </button>

              <button
                type="button"
                onClick={() => setCalendarView("week")}
                className={`px-4 py-2 rounded-xl font-medium ${
                  calendarView === "week"
                    ? "bg-emerald-500 text-white"
                    : "border border-slate-300 bg-white text-slate-600"
                }`}
              >
                Tydzień
              </button>

              <button
                type="button"
                onClick={() => setCalendarView("day")}
                className={`px-4 py-2 rounded-xl font-medium ${
                  calendarView === "day"
                    ? "bg-emerald-500 text-white"
                    : "border border-slate-300 bg-white text-slate-600"
                }`}
              >
                Dzień
              </button>

              <div className="relative ml-2">
                <button
                  type="button"
                  onClick={() => setIsOwnerFilterOpen((value) => !value)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  {getOwnerFilterLabel()}
                </button>

                {isOwnerFilterOpen && currentUserRole !== "seller" && (
                  <div className="absolute left-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllOwners}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Wszyscy
                      </button>
                      <button
                        type="button"
                        onClick={selectOnlyMe}
                        className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Moje
                      </button>
                    </div>

                    <div className="max-h-72 space-y-1 overflow-auto">
                      {calendarOwners.map((owner) => (
                        <label
                          key={owner.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedOwnerIds.includes(owner.id)}
                            onChange={() => toggleOwnerFilter(owner.id)}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span className="font-medium text-slate-700">
                          {owner.display_name || "Użytkownik"}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">
  {getRoleLabel(owner.role)}
</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <button
                type="button"
                onClick={openCreateEventModal}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
              >
                Dodaj wydarzenie
              </button>
              <button
                type="button"
                onClick={() => changePeriod("previous")}
                className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                ←
              </button>

              <h1 className="text-3xl font-bold capitalize min-w-[220px] text-center">
                {headerLabel}
              </h1>

              <button
                type="button"
                onClick={() => changePeriod("next")}
                className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                →
              </button>

              <button
                type="button"
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50"
              >
                Dziś
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Ładowanie kalendarza...</p>
          ) : calendarView === "month" ? (
            <>
              <div className="grid grid-cols-7 border border-slate-200 rounded-t-2xl overflow-hidden">
                {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map(
                  (day) => (
                    <div
                      key={day}
                      className="bg-slate-50 border-r border-slate-200 p-4 text-center font-semibold text-slate-600"
                    >
                      {day}
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-7 border-x border-b border-slate-200 rounded-b-2xl overflow-hidden">
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setCurrentDate(day.date);
                      setCalendarView("day");
                    }}
                    className={`min-h-[180px] border-r border-b border-slate-200 p-2 transition-all cursor-pointer hover:bg-slate-50 ${
                      !day.isCurrentMonth ? "bg-slate-50 text-slate-300" : "bg-white"
                    } ${
                      isToday(day.date)
                        ? "ring-2 ring-emerald-400 ring-inset"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className={`text-sm font-semibold px-2 py-1 rounded-lg ${
                          isToday(day.date) ? "bg-emerald-500 text-white" : ""
                        }`}
                      >
                        {day.date.getDate()}
                      </span>
                    </div>

                    <div className="space-y-2">
                  {day.items.slice(0, 3).map((item) => (
                    <CalendarEventCard
                      key={item.id}
                      item={item}
                      onClick={openCalendarItem}
                      showOwner={!["seller", "cc"].includes(currentUserRole)}
                    />
                  ))}

                      {day.items.length > 3 && (
                        <p className="text-[11px] text-slate-500 px-1">
                          +{day.items.length - 3} więcej
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : calendarView === "week" ? (
            <div className="grid grid-cols-7 border border-slate-200 rounded-2xl overflow-hidden">
              {weekDays.map((date) => {
                const items = getItemsForDate(date);

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => {
                      setCurrentDate(date);
                      setCalendarView("day");
                    }}
                    className={`min-h-[520px] border-r border-slate-200 bg-white p-3 cursor-pointer transition-all hover:bg-slate-50 ${
                      isToday(date) ? "bg-emerald-50" : ""
                    }`}
                  >
                    <p
                      className={`font-bold text-sm capitalize mb-1 ${
                        isToday(date) ? "text-emerald-700" : ""
                      }`}
                    >
                      {date.toLocaleDateString("pl-PL", { weekday: "short" })}
                    </p>

                    <p className="text-xs text-slate-400 mb-4">
                      {date.toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </p>

                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-slate-300">Brak wpisów.</p>
                      ) : (
                        items.map((item) => (
                          <CalendarEventCard
                            key={item.id}
                            item={item}
                            onClick={openCalendarItem}
                            showOwner={!["seller", "cc"].includes(currentUserRole)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm">
              {dayItems.length === 0 ? (
                <p className="text-sm text-slate-400">Brak wpisów na ten dzień.</p>
              ) : (
                <div className="space-y-3">
                  {dayItems.map((item) => {
                    const itemStyle = getCalendarItemStyle(item);

                    return (
                    <div
                      key={item.id}
                      onClick={(event) => openCalendarItem(event, item)}
                      className={`rounded-xl border p-4 cursor-pointer hover:scale-[1.01] transition-all ${itemStyle.card}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold">{item.client_name}</p>
                          {!["seller", "cc"].includes(currentUserRole) && (item.assigned_user_name || item.owner_name) && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Doradca: {item.assigned_user_name || item.owner_name}
                            </p>
                          )}
                          <p className="text-sm text-slate-600 mt-1">{getDisplayTitle(item.title)}</p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold">
                            {new Date(item.date).toLocaleTimeString("pl-PL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {getCalendarItemLabel(item)}
                          </p>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showCreateEventModal && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6">
              <div className="my-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                      Calendar
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-950">
                      Dodaj wydarzenie
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Wybierz klienta, doradcę, typ kontaktu i termin wydarzenia.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeCreateEventModal}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Zamknij
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="block">
                    <span className="text-sm font-semibold text-slate-700">Klient</span>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={newEventClientSearch}
                        onChange={(event) => {
                          setNewEventClientSearch(event.target.value);
                          setNewEventClientId("");
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        placeholder="Wyszukaj po nazwie, telefonie, e-mailu lub mieście..."
                      />

                      {selectedEventClient && (
                        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          <span className="font-bold">Wybrano:</span> {getClientDisplayName(selectedEventClient)}
                          <button
                            type="button"
                            onClick={() => {
                              setNewEventClientId("");
                              setNewEventClientSearch("");
                            }}
                            className="ml-3 font-bold text-emerald-700 underline underline-offset-2"
                          >
                            zmień
                          </button>
                        </div>
                      )}

                      {!selectedEventClient && (
                        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                          {newEventClientSearch.trim().length < 2 ? (
                            <div className="px-4 py-3 text-sm text-slate-400">
                              Wpisz minimum 2 znaki, aby wyszukać klienta.
                            </div>
                          ) : filteredClientsForEvent.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-400">
                              Brak klientów pasujących do wyszukiwania.
                            </div>
                          ) : (
                            filteredClientsForEvent.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setNewEventClientId(client.id);
                                  setNewEventClientSearch(getClientDisplayName(client));
                                }}
                                className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-emerald-50"
                              >
                                <span className="block font-bold text-slate-900">
                                  {getClientDisplayName(client)}
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  {[client.phone, client.email, client.city].filter(Boolean).join(" • ") || "Brak danych kontaktowych"}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#E7D49A] bg-[#F7EAC1] p-4">
                    <span className="text-sm font-bold text-slate-900">Wybierz doradcę</span>
                    <p className="mt-1 text-xs text-slate-600">
                      Ten doradca zostanie przypisany do wydarzenia i użyty przy synchronizacji Outlook / Teams.
                    </p>

                    <div className="relative mt-3">
                      <input
                        type="text"
                        value={newEventAdvisorSearch}
                        onChange={(event) => {
                          setNewEventAdvisorSearch(event.target.value);
                          setNewEventAdvisorId("");
                        }}
                        className="w-full rounded-xl border border-[#E7D49A] bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                        placeholder="Wyszukaj doradcę po imieniu, nazwisku, e-mailu lub roli..."
                      />

                      {selectedEventAdvisor && (
                        <div className="mt-2 rounded-xl border border-[#E7D49A] bg-white px-4 py-3 text-sm text-slate-900">
                          <span className="font-bold">Wybrano:</span> {selectedEventAdvisor.display_name || selectedEventAdvisor.email || "Doradca"}
                          <span className="ml-2 text-xs font-semibold text-slate-600">
                            {getRoleLabel(selectedEventAdvisor.role)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEventAdvisorId("");
                              setNewEventAdvisorSearch("");
                            }}
                            className="ml-3 font-bold text-slate-700 underline underline-offset-2"
                          >
                            zmień
                          </button>
                        </div>
                      )}

                      {!selectedEventAdvisor && (
                        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-[#E7D49A] bg-white shadow-sm">
                          {newEventAdvisorSearch.trim().length < 2 ? (
                            <div className="px-4 py-3 text-sm text-slate-400">
                              Wpisz minimum 2 znaki, aby wyszukać doradcę.
                            </div>
                          ) : filteredAdvisorsForEvent.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-400">
                              Brak doradców pasujących do wyszukiwania.
                            </div>
                          ) : (
                            filteredAdvisorsForEvent.map((advisor) => (
                              <button
                                key={advisor.id}
                                type="button"
                                onClick={() => {
                                  setNewEventAdvisorId(advisor.id);
                                  setNewEventAdvisorSearch(advisor.display_name || advisor.email || "Doradca");
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

                  <div>
                    <span className="text-sm font-semibold text-slate-700">Typ wydarzenia</span>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewEventType("meeting");
                          setNewEventDescription(meetingDescriptionTemplate);
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                          newEventType === "meeting"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100"
                            : "border-slate-300 bg-white text-slate-600 hover:border-emerald-300"
                        }`}
                      >
                        Spotkanie
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewEventType("phone_call");
                          setNewEventDescription("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                          newEventType === "phone_call"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100"
                            : "border-slate-300 bg-white text-slate-600 hover:border-emerald-300"
                        }`}
                      >
                        Kontakt telefoniczny
                      </button>
                    </div>
                  </div>

                  <DateTimePicker
                    label="Data i godzina"
                    value={newEventAt}
                    onChange={setNewEventAt}
                  />

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Opis / notatka</span>
                    <textarea
                      value={newEventDescription}
                      onChange={(event) => setNewEventDescription(event.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                      placeholder={newEventType === "meeting" ? meetingDescriptionTemplate : "Opis wydarzenia"}
                    />
                  </label>

                  {createEventError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {createEventError}
                    </div>
                  )}

                  <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeCreateEventModal}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Anuluj
                    </button>

                    <button
                      type="button"
                      onClick={createCalendarEventFromModal}
                      disabled={creatingEvent}
                      className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-100 transition hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {creatingEvent ? "Zapisywanie..." : "Zapisz wydarzenie"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {selectedItem && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
              <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
                <div className="flex items-start justify-between gap-6 mb-6">
                  <div>
                    <span
                      className={`inline-flex text-xs px-3 py-1 rounded-full font-semibold mb-3 ${getCalendarItemStyle(selectedItem).badge}`}
                    >
                      {getCalendarItemLabel(selectedItem)}
                    </span>

                    <h2 className="text-2xl font-bold">Karta wydarzenia</h2>

                    <p className="text-sm text-slate-500 mt-1">
                      {selectedItem.event_id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="text-slate-400 hover:text-slate-700 text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-400 uppercase font-semibold">Klient</p>
                      <p className="text-slate-800 font-bold mt-1">
                        {selectedItem.client_name}
                      </p>
                    </div>
                    {!["seller", "cc"].includes(currentUserRole) && (selectedItem.assigned_user_name || selectedItem.owner_name) && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs text-slate-400 uppercase font-semibold">Doradca</p>
                        <p className="text-slate-800 font-bold mt-1">
                          {selectedItem.assigned_user_name || selectedItem.owner_name}
                        </p>
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-400 uppercase font-semibold">Termin</p>
                      <p className="text-slate-800 font-bold mt-1">
                        {new Date(selectedItem.date).toLocaleString("pl-PL")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold">Temat</p>
                    <p className="text-slate-800 font-medium mt-1">{getDisplayTitle(selectedItem.title)}</p>
                  </div>

                  {selectedItem.description && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-semibold">Opis</p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                        {selectedItem.description}
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-3 pt-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-400 uppercase font-semibold">Notatki</p>
                      <p className="text-sm text-slate-600 mt-1">Do podpięcia</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-400 uppercase font-semibold">Statusy</p>
                      <p className="text-sm text-slate-600 mt-1">Do podpięcia</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-400 uppercase font-semibold">Aktywności</p>
                      <p className="text-sm text-slate-600 mt-1">Do podpięcia</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Zamknij
                  </button>

                  <button
                    type="button"
                    onClick={() => openEventPage(selectedItem)}
                    className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold"
                  >
                    Otwórz kartę wydarzenia
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

type CalendarEventCardProps = {
  item: CalendarItem;
  onClick: (event: React.MouseEvent, item: CalendarItem) => void;
  showOwner?: boolean;
};

function CalendarEventCard({ item, onClick, showOwner = false }: CalendarEventCardProps) {
  function getDisplayTitle(title: string) {
    return title
      .replace(/^Follow-up:\s*/i, "Ponowny kontakt: ")
      .replace(/^Follow up:\s*/i, "Ponowny kontakt: ")
      .replace(/^FollowUp:\s*/i, "Ponowny kontakt: ")
      .replace(/\bfollow-up\b/gi, "ponowny kontakt")
      .replace(/\bfollow up\b/gi, "ponowny kontakt");
  }

  const isCompleted = item.status === "done" || item.status?.startsWith("Zakończone");
  const isOverdue = !isCompleted && new Date(item.date).getTime() < Date.now();

  const itemStyle = (() => {
    if (item.status?.includes("Zainteresowany")) {
      return {
        card: "bg-[#FF4AC1]/10 border-[#FF4AC1]/30",
        time: "text-[#B00079]",
        badge: "bg-[#FF4AC1]/20 text-[#B00079]",
      };
    }

    if (item.status?.includes("Niezainteresowany")) {
      return {
        card: "bg-[#6B6464]/10 border-[#6B6464]/30",
        time: "text-[#4A4545]",
        badge: "bg-[#6B6464]/20 text-[#4A4545]",
      };
    }

    if (item.status?.includes("Rezygnacja")) {
      return {
        card: "bg-[#780707]/10 border-[#780707]/30",
        time: "text-[#780707]",
        badge: "bg-[#780707]/20 text-[#780707]",
      };
    }

    if (item.status?.includes("Sprzedaż")) {
      return {
        card: "bg-[#138525]/10 border-[#138525]/30",
        time: "text-[#0F6B1E]",
        badge: "bg-[#138525]/20 text-[#0F6B1E]",
      };
    }

    if (isCompleted) {
      return {
        card: "bg-slate-100 border-slate-200",
        time: "text-slate-600",
        badge: "bg-slate-200 text-slate-700",
      };
    }

    if (isOverdue) {
      return {
        card: "bg-red-50 border-red-200",
        time: "text-red-900",
        badge: "bg-red-100 text-red-900",
      };
    }

    if (item.type === "phone_call") {
      return {
        card: "bg-violet-100 border-violet-200",
        time: "text-violet-900",
        badge: "bg-violet-200 text-violet-900",
      };
    }

    if (item.type === "meeting") {
      return {
        card: "bg-sky-100 border-sky-200",
        time: "text-sky-900",
        badge: "bg-sky-200 text-sky-900",
      };
    }

    return {
      card: "bg-amber-100 border-amber-200",
      time: "text-amber-900",
      badge: "bg-amber-200 text-amber-900",
    };
  })();

  const itemLabel = (() => {
    if (item.status?.includes("Zainteresowany")) return "Zainteresowany";
    if (item.status?.includes("Niezainteresowany")) return "Niezainteresowany";
    if (item.status?.includes("Rezygnacja")) return "Rezygnacja";
    if (item.status?.includes("Sprzedaż")) return "Sprzedaż";
    if (isCompleted) return "Zakończone";
    if (isOverdue) return "Zaległe";
    // "reminder" w tym kontekście to przypomnienie / ponowny kontakt / zadanie.
    if (item.type === "meeting") return "Spotkanie";
    if (item.type === "phone_call") return "Kontakt telefoniczny";
    return "Przypomnienie";
  })();

  return (
    <div
      onClick={(event) => onClick(event, item)}
      className={`rounded-lg border p-2 text-xs cursor-pointer hover:scale-[1.02] transition-all ${itemStyle.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`font-bold ${itemStyle.time}`}
        >
          {new Date(item.date).toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <span
          className={`text-[10px] px-2 py-1 rounded-full font-semibold ${itemStyle.badge}`}
        >
          {itemLabel}
        </span>
      </div>

      <p className="font-medium text-slate-800 mt-1 line-clamp-2">
        {item.client_name}
      </p>
      {showOwner && (item.assigned_user_name || item.owner_name) && (
        <p className="mt-1 text-[11px] font-semibold text-slate-500 line-clamp-1">
          {item.assigned_user_name || item.owner_name}
        </p>
      )}

      <p className="text-slate-600 line-clamp-2 mt-1">{getDisplayTitle(item.title)}</p>
    </div>
  );
}