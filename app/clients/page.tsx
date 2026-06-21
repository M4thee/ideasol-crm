"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const statusStyles: Record<string, string> = {
  "Nowy lead": "bg-blue-100 text-blue-900",
  Przypisany: "bg-amber-100 text-amber-900",
  "Klient aktywny": "bg-emerald-100 text-emerald-900",
  Utracony: "bg-red-100 text-red-900",
};

type Client = {
  id: string;
  public_id: number | null;
  full_name: string | null;
  company_name: string | null;
  client_type?: "B2C" | "B2B" | string | null;
  phone: string | null;
  email: string | null;
  province?: string | null;
  postal_code?: string | null;
  street?: string | null;
  building_number?: string | null;
  phone_country_code?: string | null;
  pesel?: string | null;
  nip?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  city: string | null;
  status: string | null;
  lead_source?: string | null;
  last_contact_status?: string | null;
  last_contact_at?: string | null;
  contact_followup_status?: "active" | "overdue" | null;
  assigned_user_id: string | null;
  assigned_user?: {
    id: string;
    display_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
  tags?: ClientTag[];
  tag_ids?: string[];
  created_at: string;
};

type UserRole =
  | "owner"
  | "admin"
  | "manager"
  | "cc"
  | "seller"
  | string;

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
  hidden_from_assignment?: boolean | null;
};

type ClientTag = {
  id: string;
  name: string;
  color: string | null;
};

type ClientTagLink = {
  client_id: string;
  tag_id: string;
};

const CLIENTS_FILTERS_STORAGE_KEY = "ideasol_clients_filters_v1";

function readPersistedString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readPersistedStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}


type ClientActivitySummary = {
  client_id: string;
  status: string | null;
  created_at: string;
};

type CalendarEventSummary = {
  client_id: string;
  title: string | null;
  event_type: string | null;
  event_at: string;
  status: string | null;
};


type ClientRow = Omit<Client, "assigned_user"> & {
  assigned_user?: Client["assigned_user"] | Client["assigned_user"][] | null;
};

function isHiddenAssignmentUser(profile: {
  display_name?: string | null;
  hidden_from_assignment?: boolean | null;
}) {
  return profile.hidden_from_assignment === true;
}

function isNotInterestedStatus(status?: string | null) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .includes("niezainteres");
}

function isClosedCalendarStatus(status?: string | null) {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  return ["done", "completed", "cancelled", "canceled", "closed", "zakończone", "zakończony", "anulowane", "anulowany"].includes(normalizedStatus);
}

function isContactFollowUpEvent(event: CalendarEventSummary) {
  const combinedValue = `${event.event_type || ""} ${event.title || ""}`.toLowerCase();

  return (
    combinedValue.includes("meeting") ||
    combinedValue.includes("spotkanie") ||
    combinedValue.includes("reminder") ||
    combinedValue.includes("follow") ||
    combinedValue.includes("kontakt") ||
    combinedValue.includes("ponown") ||
    combinedValue.includes("telefon")
  );
}

const provinces = [
  "Dolnośląskie",
  "Kujawsko-Pomorskie",
  "Lubelskie",
  "Lubuskie",
  "Łódzkie",
  "Małopolskie",
  "Mazowieckie",
  "Opolskie",
  "Podkarpackie",
  "Podlaskie",
  "Pomorskie",
  "Śląskie",
  "Świętokrzyskie",
  "Warmińsko-Mazurskie",
  "Wielkopolskie",
  "Zachodniopomorskie",
];

const countryPhoneCodes = [
  { code: "+48", label: "🇵🇱" },
  { code: "+49", label: "🇩🇪" },
  { code: "+420", label: "🇨🇿" },
  { code: "+421", label: "🇸🇰" },
  { code: "+43", label: "🇦🇹" },
  { code: "+44", label: "🇬🇧" },
  { code: "+353", label: "🇮🇪" },
  { code: "+31", label: "🇳🇱" },
  { code: "+32", label: "🇧🇪" },
  { code: "+33", label: "🇫🇷" },
  { code: "+34", label: "🇪🇸" },
  { code: "+39", label: "🇮🇹" },
  { code: "+351", label: "🇵🇹" },
  { code: "+45", label: "🇩🇰" },
  { code: "+46", label: "🇸🇪" },
  { code: "+47", label: "🇳🇴" },
  { code: "+358", label: "🇫🇮" },
  { code: "+370", label: "🇱🇹" },
  { code: "+371", label: "🇱🇻" },
  { code: "+372", label: "🇪🇪" },
  { code: "+380", label: "🇺🇦" },
  { code: "+375", label: "🇧🇾" },
  { code: "+40", label: "🇷🇴" },
  { code: "+36", label: "🇭🇺" },
  { code: "+385", label: "🇭🇷" },
  { code: "+386", label: "🇸🇮" },
  { code: "+381", label: "🇷🇸" },
  { code: "+359", label: "🇧🇬" },
  { code: "+30", label: "🇬🇷" },
  { code: "+90", label: "🇹🇷" },
  { code: "+1", label: "🇺🇸/🇨🇦" },
  { code: "+971", label: "🇦🇪" },
];

function ClientsPageContent() {
  const filtersPanelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreClientsRef = useRef(false);
  const filtersHydratedRef = useRef(false);
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("Wszystkie");
  const [subStatusFilter, setSubStatusFilter] = useState<string>("Wszystkie");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [selectedAdvisorIds, setSelectedAdvisorIds] = useState<string[]>([]);
  const [selectedClientTypes, setSelectedClientTypes] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [visibleClientsLimit, setVisibleClientsLimit] = useState(15);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [assigningClient, setAssigningClient] = useState<Client | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkAssignSellerId, setBulkAssignSellerId] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([]);
  const [bulkTagId, setBulkTagId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [showSelfAssignPrompt, setShowSelfAssignPrompt] = useState(false);
  const [loadingGusData, setLoadingGusData] = useState(false);
  const [clientType, setClientType] = useState<"B2C" | "B2B">("B2C");
  const [newClient, setNewClient] = useState({
    full_name: "",
    company_name: "",
    city: "",
    postal_code: "",
    street: "",
    building_number: "",
    province: "",
    phone_country_code: "+48",
    phone: "",
    email: "",
    pesel: "",
    nip: "",
    contact_person: "",
    contact_phone: "",
    contact_phone_country_code: "+48",
  });
  const [newClientNote, setNewClientNote] = useState("");

  useEffect(() => {
    initializePage();
  }, []);

  useEffect(() => {
    if (filtersHydratedRef.current) return;

    filtersHydratedRef.current = true;

    try {
      const savedFilters = window.localStorage.getItem(CLIENTS_FILTERS_STORAGE_KEY);

      if (!savedFilters) {
        setFiltersHydrated(true);
        return;
      }

      const parsedFilters = JSON.parse(savedFilters) as Record<string, unknown>;

      setStatusFilter(readPersistedString(parsedFilters.statusFilter, "Wszystkie"));
      setSubStatusFilter(readPersistedString(parsedFilters.subStatusFilter, "Wszystkie"));
      setSelectedAdvisorIds(readPersistedStringArray(parsedFilters.selectedAdvisorIds));
      setSelectedClientTypes(readPersistedStringArray(parsedFilters.selectedClientTypes));
      setSelectedProvinces(readPersistedStringArray(parsedFilters.selectedProvinces));
      setSelectedCities(readPersistedStringArray(parsedFilters.selectedCities));
      setSelectedTagIds(readPersistedStringArray(parsedFilters.selectedTagIds));
    } catch (error) {
      console.error("Błąd odczytu zapisanych filtrów klientów:", error);
      window.localStorage.removeItem(CLIENTS_FILTERS_STORAGE_KEY);
    }

    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;

    window.localStorage.setItem(
      CLIENTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        statusFilter,
        subStatusFilter,
        selectedAdvisorIds,
        selectedClientTypes,
        selectedProvinces,
        selectedCities,
        selectedTagIds,
      })
    );
  }, [
    filtersHydrated,
    statusFilter,
    subStatusFilter,
    selectedAdvisorIds,
    selectedClientTypes,
    selectedProvinces,
    selectedCities,
    selectedTagIds,
  ]);

  useEffect(() => {
    if (searchParams.get("addClient") === "1") {
      setShowAddClientModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filtersPanelRef.current &&
        !filtersPanelRef.current.contains(event.target as Node)
      ) {
        setShowFiltersPanel(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setVisibleClientsLimit(15);
  }, [
    statusFilter,
    subStatusFilter,
    selectedAdvisorIds,
    selectedClientTypes,
    selectedProvinces,
    selectedCities,
    selectedTagIds,
  ]);

  async function initializePage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Błąd ładowania profilu:", profileError);
    }

    const role = (profileData?.role || "seller") as UserRole;
    setCurrentUserRole(role);

    await Promise.all([loadClients(user.id, role), loadSellers(), loadAvailableTags()]);
  }

  async function loadAvailableTags() {
    const { data, error } = await supabase
      .from("client_tags")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania tagów klientów:", error);
      setAvailableTags([]);
      return;
    }

    setAvailableTags((data || []) as ClientTag[]);
  }
  async function loadSellers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, role, hidden_from_assignment")
      .in("role", ["seller", "manager", "owner", "admin", "cc"])
      .or("hidden_from_assignment.is.null,hidden_from_assignment.eq.false")
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania użytkowników:", error);
      return;
    }

    setSellers(
      ((data || []) as Omit<Profile, "email">[])
        .filter((profile) => !isHiddenAssignmentUser(profile))
        .map((profile) => ({
          ...profile,
          email: null,
        }))
    );
  }

  function canAssignClients() {
    return ["owner", "admin", "manager", "cc"].includes(currentUserRole || "");
  }

  function canAnonymizeClients() {
    return currentUserRole === "admin";
  }

  function canManageClientTags() {
    return currentUserRole === "admin";
  }

  function canOpenImportPage() {
    return ["seller", "cc", "manager", "owner", "admin"].includes(
      currentUserRole || ""
    );
  }

  function maskClientName(value: string | null) {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) return "Zanonimizowany kontakt";

    return cleanValue
      .split(" ")
      .filter(Boolean)
      .map((part) => {
        if (part.length <= 2) return `${part[0] || ""}***`;
        return `${part.slice(0, 2)}${"*".repeat(Math.max(part.length - 2, 3))}`;
      })
      .join(" ");
  }


  function getAdvisorName(client: Client) {
    return client.assigned_user?.display_name || client.assigned_user?.email || "Brak";
  }

  function normalizeTagFilterValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

  function clientMatchesSelectedTags(client: Client) {
  if (selectedTagIds.length === 0) return true;

  const normalizedSelectedTagIds = selectedTagIds.map((tagId) => tagId.trim());

  const selectedTagNames = availableTags
    .filter((tag) => normalizedSelectedTagIds.includes(tag.id))
    .map((tag) => normalizeTagFilterValue(tag.name))
    .filter(Boolean);

  const clientTagIds = [
    ...(client.tag_ids || []),
    ...(client.tags || []).map((tag) => tag.id),
  ].map((tagId) => tagId.trim());

  const clientTagNames = (client.tags || [])
    .map((tag) => normalizeTagFilterValue(tag.name))
    .filter(Boolean);

  const clientLeadSource = normalizeTagFilterValue(client.lead_source);

  const matchesLinkedTag = normalizedSelectedTagIds.some((selectedTagId) =>
    clientTagIds.includes(selectedTagId)
  );

  const matchesTagName = selectedTagNames.some((selectedTagName) =>
    clientTagNames.some(
      (clientTagName) =>
        selectedTagName === clientTagName ||
        clientTagName.includes(selectedTagName) ||
        selectedTagName.includes(clientTagName)
    )
  );

  const matchesLeadSource =
    clientLeadSource.length > 0 &&
    selectedTagNames.some(
      (selectedTagName) =>
        selectedTagName === clientLeadSource ||
        clientLeadSource.includes(selectedTagName) ||
        selectedTagName.includes(clientLeadSource)
    );

  return matchesLinkedTag || matchesTagName || matchesLeadSource;
}
  function getClientTypeLabel(client: Client) {
    return client.client_type || (client.company_name ? "B2B" : "B2C");
  }

  function getClientTypeClass(client: Client) {
    const type = getClientTypeLabel(client);

    return type === "B2B"
      ? "border-violet-200 bg-violet-100 text-violet-800"
      : "border-sky-200 bg-sky-100 text-sky-800";
  }

  function getRoleLabel(role: string | null) {
    if (role === "owner") return "Członek Zarządu";
    if (role === "admin") return "Administrator";
    if (role === "manager") return "Manager";
    if (role === "cc") return "Konsultant CC";
    if (role === "seller") return "Doradca Techniczny";

    return role || "Użytkownik";
  }

  function toggleFilterValue(
    value: string,
    currentValues: string[],
    setter: (values: string[]) => void
  ) {
    setter(
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]
    );
  }

  function clearAdvancedFilters() {
    setSelectedAdvisorIds([]);
    setSelectedClientTypes([]);
    setSelectedProvinces([]);
    setSelectedCities([]);
    setSelectedTagIds([]);
    setSubStatusFilter("Wszystkie");
  }

  function toggleSelectedClient(clientId: string) {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]
    );
  }

  function toggleAllVisibleClients() {
    const visibleIds = visibleClients.map((client) => client.id);

    if (visibleIds.length === 0) return;

    const allVisibleSelected = visibleIds.every((id) =>
      selectedClientIds.includes(id)
    );

    setSelectedClientIds(allVisibleSelected ? [] : visibleIds);
  }

  async function loadClients(userId = currentUserId, role = currentUserRole) {
    setLoading(true);

    let query = supabase
      .from("clients")
      .select(
        "id, public_id, full_name, company_name, client_type, phone, email, city, province, status, lead_source, assigned_user_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (role === "seller" && userId) {
      query = query.eq("assigned_user_id", userId);
    }

    if (role === "manager" && userId) {
      const { data: teamMembers, error: teamError } = await supabase
        .from("profiles")
        .select("id")
        .eq("manager_id", userId);

      if (teamError) {
        console.error("Błąd ładowania zespołu managera:", teamError);
      }

      const allowedUserIds = [
        userId,
        ...((teamMembers || []).map((item: { id: string }) => item.id)),
      ];

      query = query.in("assigned_user_id", allowedUserIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania klientów:", error);
    }

    const clientsWithoutAssignedUsers = (data || []) as ClientRow[];

    const clientIds = clientsWithoutAssignedUsers.map((client) => client.id);
    let tagsByClientId: Record<string, ClientTag[]> = {};
    let tagIdsByClientId: Record<string, string[]> = {};

    let lastActivityByClientId: Record<string, ClientActivitySummary> = {};
    const activityRangeStart = new Date();
    activityRangeStart.setDate(activityRangeStart.getDate() - 180);
    activityRangeStart.setHours(0, 0, 0, 0);

    const followUpRangeStart = new Date();
    followUpRangeStart.setDate(followUpRangeStart.getDate() - 90);
    followUpRangeStart.setHours(0, 0, 0, 0);

    const followUpRangeEnd = new Date();
    followUpRangeEnd.setDate(followUpRangeEnd.getDate() + 365);
    followUpRangeEnd.setHours(23, 59, 59, 999);
    const contactFollowUpStatusByClientId: Record<string, "active" | "overdue"> = {};

    if (clientIds.length > 0) {
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("client_activities")
        .select("client_id, status, created_at")
        .in("client_id", clientIds)
        .gte("created_at", activityRangeStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);

      if (activitiesError) {
        console.error("Błąd ładowania ostatnich aktywności klientów:", activitiesError);
      }

      lastActivityByClientId = ((activitiesData || []) as ClientActivitySummary[]).reduce(
        (accumulator, activity) => {
          if (!activity.client_id) return accumulator;
          if (accumulator[activity.client_id]) return accumulator;

          accumulator[activity.client_id] = activity;
          return accumulator;
        },
        {} as Record<string, ClientActivitySummary>
      );

      const { data: calendarEventsData, error: calendarEventsError } = await supabase
        .from("calendar_events")
        .select("client_id, title, event_type, event_at, status")
        .in("client_id", clientIds)
        .gte("event_at", followUpRangeStart.toISOString())
        .lte("event_at", followUpRangeEnd.toISOString())
        .limit(1000);

      if (calendarEventsError) {
        console.error("Błąd ładowania statusów kontaktu klientów:", calendarEventsError);
      }

      const nowTimestamp = Date.now();
      const contactEventsByClientId = ((calendarEventsData || []) as CalendarEventSummary[]).reduce(
        (accumulator, event) => {
          if (!event.client_id) return accumulator;
          if (!event.event_at) return accumulator;
          if (isClosedCalendarStatus(event.status)) return accumulator;
          if (!isContactFollowUpEvent(event)) return accumulator;

          accumulator[event.client_id] = [
            ...(accumulator[event.client_id] || []),
            event,
          ];

          return accumulator;
        },
        {} as Record<string, CalendarEventSummary[]>
      );

      Object.entries(contactEventsByClientId).forEach(([clientId, events]) => {
        const hasFutureContact = events.some(
          (event) => new Date(event.event_at).getTime() >= nowTimestamp
        );

        const hasOverdueContact = events.some(
          (event) => new Date(event.event_at).getTime() < nowTimestamp
        );

        // Jeżeli istnieje już zaplanowany przyszły kontakt/spotkanie,
        // klient ma być oznaczony jako „W kontakcie”, nawet jeśli w historii
        // wiszą stare niewykonane przypomnienia.
        if (hasFutureContact) {
          contactFollowUpStatusByClientId[clientId] = "active";
          return;
        }

        if (hasOverdueContact) {
          contactFollowUpStatusByClientId[clientId] = "overdue";
        }
      });
    }

    if (clientIds.length > 0) {
      const { data: clientTagLinksData, error: clientTagLinksError } = await supabase
        .from("client_tag_links")
        .select("client_id, tag_id")
        .in("client_id", clientIds);

      if (clientTagLinksError) {
        console.error("Błąd ładowania powiązań tagów klientów:", clientTagLinksError);
      }

      const clientTagLinks = (clientTagLinksData || []) as ClientTagLink[];
      tagIdsByClientId = clientTagLinks.reduce((accumulator, link) => {
        accumulator[link.client_id] = [
          ...(accumulator[link.client_id] || []),
          link.tag_id,
        ];
        return accumulator;
      }, {} as Record<string, string[]>);

      const tagIds = Array.from(new Set(clientTagLinks.map((link) => link.tag_id)));

      if (tagIds.length > 0) {
        const { data: tagsData, error: tagsError } = await supabase
          .from("client_tags")
          .select("id, name, color")
          .in("id", tagIds)
          .eq("is_active", true);

        if (tagsError) {
          console.error("Błąd ładowania tagów klientów:", tagsError);
        }

        const tagsById = new Map(
          ((tagsData || []) as ClientTag[]).map((tag) => [tag.id, tag])
        );

        tagsByClientId = clientTagLinks.reduce((accumulator, link) => {
          const tag = tagsById.get(link.tag_id);

          if (!tag) return accumulator;

          accumulator[link.client_id] = [
            ...(accumulator[link.client_id] || []),
            tag,
          ];

          return accumulator;
        }, {} as Record<string, ClientTag[]>);
      }
    }

    const assignedUserIds = Array.from(
      new Set(
        clientsWithoutAssignedUsers
          .map((client) => client.assigned_user_id)
          .filter(Boolean) as string[]
      )
    );

    let assignedUsersById: Record<string, Profile> = {};

    if (assignedUserIds.length > 0) {
      const { data: assignedUsersData, error: assignedUsersError } = await supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("id", assignedUserIds);

      if (assignedUsersError) {
        console.error("Błąd ładowania przypisanych użytkowników:", assignedUsersError);
      }

      assignedUsersById = Object.fromEntries(
        ((assignedUsersData || []) as Omit<Profile, "email">[]).map((profile) => [
          profile.id,
          {
            ...profile,
            email: null,
          },
        ])
      );
    }

    const normalizedClients = clientsWithoutAssignedUsers.map((client) => {
      const lastActivity = lastActivityByClientId[client.id] || null;

      return {
        ...client,
        assigned_user: client.assigned_user_id
          ? assignedUsersById[client.assigned_user_id] || null
          : null,
        tags: tagsByClientId[client.id] || [],
        tag_ids: tagIdsByClientId[client.id] || [],
        last_contact_status: lastActivity?.status || null,
        last_contact_at: lastActivity?.created_at || null,
        contact_followup_status: contactFollowUpStatusByClientId[client.id] || null,
      };
    });

    const sortedClients = normalizedClients.sort((firstClient, secondClient) => {
      const firstIsNotInterested =
        isNotInterestedStatus(firstClient.status) ||
        isNotInterestedStatus(firstClient.last_contact_status);
      const secondIsNotInterested =
        isNotInterestedStatus(secondClient.status) ||
        isNotInterestedStatus(secondClient.last_contact_status);

      if (firstIsNotInterested !== secondIsNotInterested) {
        return firstIsNotInterested ? 1 : -1;
      }

      const firstIsLost = firstClient.status === "Utracony";
      const secondIsLost = secondClient.status === "Utracony";

      if (firstIsLost !== secondIsLost) {
        return firstIsLost ? 1 : -1;
      }

      return (
        new Date(secondClient.created_at).getTime() -
        new Date(firstClient.created_at).getTime()
      );
    });

    setClients(sortedClients);
    setLoading(false);
  }

  function openAssignModal(client: Client) {
    setAssigningClient(client);
    setSelectedSellerId(client.assigned_user_id || "");
  }

  function closeAssignModal() {
    setAssigningClient(null);
    setSelectedSellerId("");
  }

  function openAddClientModal() {
    setShowAddClientModal(true);
  }

  function closeAddClientModal() {
    setShowAddClientModal(false);
    setShowSelfAssignPrompt(false);
    setClientType("B2C");
    setNewClient({
      full_name: "",
      company_name: "",
      city: "",
      postal_code: "",
      street: "",
      building_number: "",
      province: "",
      phone_country_code: "+48",
      phone: "",
      email: "",
      pesel: "",
      nip: "",
      contact_person: "",
      contact_phone: "",
      contact_phone_country_code: "+48",
    });
    setNewClientNote("");
  }

  async function fetchCompanyFromGus() {
    const nip = newClient.nip.replace(/\D/g, "");

    if (nip.length !== 10) {
      alert("Wpisz poprawny NIP składający się z 10 cyfr.");
      return;
    }

    setLoadingGusData(true);

    try {
      const response = await fetch("/api/gus/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nip }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result?.error || "Nie udało się pobrać danych z GUS.");
        setLoadingGusData(false);
        return;
      }

      const company = result.company;

      setNewClient((currentClient) => ({
        ...currentClient,
        nip: company.nip || currentClient.nip,
        company_name: company.company_name || currentClient.company_name,
        city: company.city || currentClient.city,
        postal_code: company.postal_code || currentClient.postal_code,
        street: company.street || currentClient.street,
        building_number: company.building_number || currentClient.building_number,
        province:
          provinces.find(
            (province) =>
              province.toLowerCase() === String(company.province || "").toLowerCase()
          ) || currentClient.province,
      }));
    } catch (error) {
      console.error("Błąd pobierania danych z GUS:", error);
      alert("Nie udało się połączyć z endpointem GUS.");
    }

    setLoadingGusData(false);
  }

  async function createCrmClient(assignToCurrentUser?: boolean) {
    if (
      clientType === "B2C" &&
      (!newClient.full_name || !newClient.phone)
    ) {
      alert("Uzupełnij imię i nazwisko oraz telefon.");
      return;
    }

    if (
      clientType === "B2B" &&
      (!newClient.company_name || !newClient.contact_person)
    ) {
      alert("Uzupełnij nazwę firmy oraz osobę kontaktową.");
      return;
    }

    const postalCodeRegex = /^\d{2}-\d{3}$/;

    if (newClient.postal_code && !postalCodeRegex.test(newClient.postal_code)) {
      alert("Kod pocztowy wpisz w formacie 00-000.");
      return;
    }

    const shouldAskAssignment = ["admin", "manager", "seller"].includes(
      currentUserRole || ""
    );

    if (shouldAskAssignment && typeof assignToCurrentUser === "undefined") {
      setShowSelfAssignPrompt(true);
      return;
    }

    setSavingClient(true);

    const normalizedPhone = newClient.phone.trim();
    const normalizedContactPhone = newClient.contact_phone.trim();

    const shouldAssignToCurrentUser = assignToCurrentUser === true;

    const payload = {
      created_by: currentUserId,
      client_type: clientType,
      full_name:
        clientType === "B2C" ? newClient.full_name : null,
      company_name:
        clientType === "B2B" ? newClient.company_name : null,
      city: newClient.city || null,
      postal_code: newClient.postal_code || null,
      street: newClient.street || null,
      building_number: newClient.building_number || null,
      province: newClient.province || null,
      phone:
        normalizedPhone
          ? `${newClient.phone_country_code} ${normalizedPhone}`
          : null,
      phone_country_code: newClient.phone_country_code || "+48",
      email: newClient.email || null,
      pesel: newClient.pesel || null,
      nip: newClient.nip || null,
      contact_person: newClient.contact_person || null,
      contact_phone:
        normalizedContactPhone
          ? `${newClient.contact_phone_country_code} ${normalizedContactPhone}`
          : null,
      status: shouldAssignToCurrentUser ? "Przypisany" : "Nowy lead",
      assigned_user_id: shouldAssignToCurrentUser ? currentUserId : null,
    };

    const { data: insertedClient, error } = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("Błąd dodawania klienta:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payload,
      });

      alert(
        `Nie udało się dodać klienta.\n\n` +
          `Message: ${error.message || "brak"}\n` +
          `Details: ${error.details || "brak"}\n` +
          `Hint: ${error.hint || "brak"}\n` +
          `Code: ${error.code || "brak"}`
      );

      setSavingClient(false);
      return;
    }

    const trimmedClientNote = newClientNote.trim();

    if (trimmedClientNote && insertedClient?.id && currentUserId) {
      const { error: noteError } = await supabase.from("client_notes").insert({
        client_id: insertedClient.id,
        created_by: currentUserId,
        content: trimmedClientNote,
      });

      if (noteError) {
        console.error("Błąd zapisu notatki do nowego klienta:", noteError);
      }
    }

    await loadClients(currentUserId, currentUserRole);

    setSavingClient(false);
    closeAddClientModal();
  }

  async function assignClientToSeller() {
    if (!assigningClient || !selectedSellerId) {
      alert("Wybierz użytkownika.");
      return;
    }

    setSavingAssignment(true);

    const { error } = await supabase
      .from("clients")
      .update({
        assigned_user_id: selectedSellerId,
        status: "Przypisany",
      })
      .eq("id", assigningClient.id);

    if (error) {
      console.error("Błąd przypisywania klienta:", error);
      alert(`Nie udało się przypisać klienta: ${error.message}`);
      setSavingAssignment(false);
      return;
    }

    const { data: verifyClient, error: verifyError } = await supabase
      .from("clients")
      .select("id, assigned_user_id")
      .eq("id", assigningClient.id)
      .single();

    console.log("Weryfikacja przypisania klienta:", {
      selectedSellerId,
      verifyClient,
      verifyError,
    });

    const clientName =
      assigningClient.full_name || assigningClient.company_name || "Nowy klient";
    const clientCity = assigningClient.city || "Brak miejscowości";

    const { error: notificationError } = await supabase.rpc("create_notification", {
      p_user_id: selectedSellerId,
      p_title: "Przypisano Ci nowego klienta",
      p_body: `${clientName}, ${clientCity}`,
      p_client_id: assigningClient.id,
    });

    if (notificationError) {
      console.error("Błąd tworzenia powiadomienia:", {
        message: notificationError.message,
        details: notificationError.details,
        hint: notificationError.hint,
        code: notificationError.code,
        selectedSellerId,
        clientId: assigningClient.id,
      });
    } else {
      window.dispatchEvent(new Event("ideasol-notifications-refresh"));
    }

    await loadClients(currentUserId, currentUserRole);

    setSavingAssignment(false);
    closeAssignModal();
  }

  async function assignSelectedClientsToSeller() {
    if (selectedClientIds.length === 0) {
      alert("Zaznacz klientów do przypisania.");
      return;
    }

    if (!bulkAssignSellerId) {
      alert("Wybierz użytkownika, do którego chcesz przypisać klientów.");
      return;
    }

    const selectedSeller = sellers.find((seller) => seller.id === bulkAssignSellerId);
    const selectedSellerName =
      selectedSeller?.display_name || selectedSeller?.email || "wybranego użytkownika";

    const confirmed = window.confirm(
      `Czy chcesz przypisać następującą liczbę klientów: ${selectedClientIds.length} do: ${selectedSellerName}?`
    );

    if (!confirmed) return;

    setBulkActionLoading(true);

    const { error } = await supabase
      .from("clients")
      .update({
        assigned_user_id: bulkAssignSellerId,
        status: "Przypisany",
      })
      .in("id", selectedClientIds);

    if (error) {
      console.error("Błąd masowego przypisywania klientów:", error);
      alert(`Nie udało się przypisać klientów: ${error.message}`);
      setBulkActionLoading(false);
      return;
    }

    setSelectedClientIds([]);
    setBulkAssignSellerId("");
    await loadClients(currentUserId, currentUserRole);
    setBulkActionLoading(false);
  }

  async function addTagToSelectedClients() {
    if (selectedClientIds.length === 0) {
      alert("Zaznacz klientów, którym chcesz dodać tag.");
      return;
    }

    if (!bulkTagId) {
      alert("Wybierz tag.");
      return;
    }

    const selectedTag = availableTags.find((tag) => tag.id === bulkTagId);
    const selectedTagName = selectedTag?.name || "wybrany tag";

    const confirmed = window.confirm(
      `Czy chcesz dodać tag "${selectedTagName}" do następującej liczby klientów: ${selectedClientIds.length}?`
    );

    if (!confirmed) return;

    setBulkActionLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rows = selectedClientIds.map((clientId) => ({
      client_id: clientId,
      tag_id: bulkTagId,
      created_by: user?.id || null,
    }));

    const { error } = await supabase
      .from("client_tag_links")
      .upsert(rows, { onConflict: "client_id,tag_id" });

    if (error) {
      console.error("Błąd masowego dodawania tagu:", error);
      alert(`Nie udało się dodać tagu: ${error.message}`);
      setBulkActionLoading(false);
      return;
    }

    setBulkTagId("");
    setSelectedClientIds([]);
    await loadClients(currentUserId, currentUserRole);
    setBulkActionLoading(false);
    alert(`Dodano tag "${selectedTagName}" do zaznaczonych klientów.`);
  }

  async function removeTagFromSelectedClients() {
    if (selectedClientIds.length === 0) {
      alert("Zaznacz klientów, którym chcesz usunąć tag.");
      return;
    }

    if (!bulkTagId) {
      alert("Wybierz tag.");
      return;
    }

    const selectedTag = availableTags.find((tag) => tag.id === bulkTagId);
    const selectedTagName = selectedTag?.name || "wybrany tag";

    const confirmed = window.confirm(
      `Czy chcesz usunąć tag "${selectedTagName}" z następującej liczby klientów: ${selectedClientIds.length}?`
    );

    if (!confirmed) return;

    setBulkActionLoading(true);

    const { error } = await supabase
      .from("client_tag_links")
      .delete()
      .eq("tag_id", bulkTagId)
      .in("client_id", selectedClientIds);

    if (error) {
      console.error("Błąd masowego usuwania tagu:", error);
      alert(`Nie udało się usunąć tagu: ${error.message}`);
      setBulkActionLoading(false);
      return;
    }

    setBulkTagId("");
    setSelectedClientIds([]);
    await loadClients(currentUserId, currentUserRole);
    setBulkActionLoading(false);
    alert(`Usunięto tag "${selectedTagName}" z zaznaczonych klientów.`);
  }

  async function anonymizeSelectedClients() {
    if (selectedClientIds.length === 0) {
      alert("Zaznacz klientów do anonimizacji.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz zanonimizować następującą liczbę klientów: ${selectedClientIds.length}?\n\nTa operacja usunie dane osobowe i kontaktowe oraz ustawi status Utracony.`
    );

    if (!confirmed) return;

    setBulkActionLoading(true);

    for (const clientId of selectedClientIds) {
      const client = clients.find((item) => item.id === clientId);

      if (!client) continue;

      const maskedFullName = client.full_name ? maskClientName(client.full_name) : null;
      const maskedCompanyName = client.company_name ? maskClientName(client.company_name) : null;

      const { error } = await supabase
        .from("clients")
        .update({
          full_name: maskedFullName,
          company_name: maskedCompanyName,
          phone: null,
          email: null,
          city: null,
          postal_code: null,
          street: null,
          building_number: null,
          province: null,
          phone_country_code: null,
          pesel: null,
          nip: null,
          contact_person: null,
          contact_phone: null,
          status: "Utracony",
        })
        .eq("id", client.id);

      if (error) {
        console.error("Błąd masowej anonimizacji klienta:", error);
        alert(`Nie udało się zanonimizować klienta ${client.full_name || client.company_name || client.id}: ${error.message}`);
        setBulkActionLoading(false);
        return;
      }
    }

    setSelectedClientIds([]);
    await loadClients(currentUserId, currentUserRole);
    setBulkActionLoading(false);
  }

  async function anonymizeClient(client: Client) {
    const clientName = client.full_name || client.company_name || "ten kontakt";

    const confirmed = window.confirm(
      `Czy na pewno chcesz zanonimizować kontakt: ${clientName}?\n\n` +
        "Ta operacja usunie dane osobowe i kontaktowe oraz ustawi status Utracony."
    );

    if (!confirmed) return;

    const maskedFullName = client.full_name ? maskClientName(client.full_name) : null;
    const maskedCompanyName = client.company_name ? maskClientName(client.company_name) : null;

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: maskedFullName,
        company_name: maskedCompanyName,
        phone: null,
        email: null,
        city: null,
        postal_code: null,
        street: null,
        building_number: null,
        province: null,
        phone_country_code: null,
        pesel: null,
        nip: null,
        contact_person: null,
        contact_phone: null,
        status: "Utracony",
      })
      .eq("id", client.id);

    if (error) {
      console.error("Błąd anonimizacji klienta:", error);
      alert(`Nie udało się zanonimizować kontaktu: ${error.message}`);
      return;
    }

    setClients((currentClients) =>
      currentClients.map((currentClient) =>
        currentClient.id === client.id
          ? {
              ...currentClient,
              full_name: maskedFullName,
              company_name: maskedCompanyName,
              phone: null,
              email: null,
              city: null,
              postal_code: null,
              street: null,
              building_number: null,
              province: null,
              phone_country_code: null,
              pesel: null,
              nip: null,
              contact_person: null,
              contact_phone: null,
              status: "Utracony",
            }
          : currentClient
      )
    );
  }

  const availableProvinces = Array.from(
    new Set(clients.map((client) => client.province).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, "pl"));

  const availableCities = Array.from(
    new Set(
      clients
        .filter(
          (client) =>
            selectedProvinces.length === 0 ||
            (client.province && selectedProvinces.includes(client.province))
        )
        .map((client) => client.city)
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => a.localeCompare(b, "pl"));

  const activeAdvancedFiltersCount =
    selectedAdvisorIds.length +
    selectedClientTypes.length +
    selectedProvinces.length +
    selectedCities.length +
    selectedTagIds.length;

  const filteredClients = clients.filter((client) => {
    const matchesStatus =
      statusFilter === "Wszystkie" || client.status === statusFilter;

    const clientIsNotInterested =
      isNotInterestedStatus(client.status) ||
      isNotInterestedStatus(client.last_contact_status);

    const matchesSubStatus =
      subStatusFilter === "Wszystkie" ||
      (subStatusFilter === "Zaległe" && client.contact_followup_status === "overdue") ||
      (subStatusFilter === "W kontakcie" && client.contact_followup_status === "active") ||
      (subStatusFilter === "Niezainteresowani" && clientIsNotInterested);

    const matchesAdvisor =
      selectedAdvisorIds.length === 0 ||
      (selectedAdvisorIds.includes("Brak") && !client.assigned_user_id) ||
      (client.assigned_user_id && selectedAdvisorIds.includes(client.assigned_user_id));

    const matchesClientType =
      selectedClientTypes.length === 0 ||
      selectedClientTypes.includes(getClientTypeLabel(client));

    const matchesProvince =
      selectedProvinces.length === 0 ||
      (client.province && selectedProvinces.includes(client.province));

    const matchesCity =
      selectedCities.length === 0 ||
      (client.city && selectedCities.includes(client.city));

    const matchesTags = clientMatchesSelectedTags(client);
    return (
      matchesStatus &&
      matchesSubStatus &&
      matchesAdvisor &&
      matchesClientType &&
      matchesProvince &&
      matchesCity &&
      matchesTags
    );
  });

  const visibleClients = filteredClients.slice(0, visibleClientsLimit);
  const hasMoreClients = visibleClients.length < filteredClients.length;

  function shouldLoadMoreClients() {
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;

    return scrollPosition >= pageHeight - 240;
  }

  useEffect(() => {
    function handleWindowScroll() {
      if (!shouldLoadMoreClients()) return;
      if (loadingMoreClientsRef.current) return;

      loadingMoreClientsRef.current = true;

      setVisibleClientsLimit((currentLimit) =>
        Math.min(currentLimit + 15, filteredClients.length)
      );

      window.setTimeout(() => {
        loadingMoreClientsRef.current = false;

        if (shouldLoadMoreClients()) {
          handleWindowScroll();
        }
      }, 120);
    }

    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [filteredClients.length]);

  const stats = {
    all: clients.length,
    newLeads: clients.filter((client) => client.status === "Nowy lead").length,
    assigned: clients.filter((client) => client.status === "Przypisany").length,
    active: clients.filter((client) => client.status === "Klient aktywny").length,
    lost: clients.filter((client) => client.status === "Utracony").length,
  };

  return (
    <main className="text-slate-900">
      <div className="space-y-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-sm text-slate-500">Moduł klientów</p>
              <h1 className="text-3xl font-bold text-slate-900">Klienci CRM</h1>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {canOpenImportPage() && (
                <Link
                  href="/clients/import"
                  className="inline-flex w-full justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-[#73C7BA] hover:shadow-md active:translate-y-0 active:scale-[0.98] sm:w-auto"
                >
                  Import
                </Link>
              )}

              <button
                type="button"
                onClick={openAddClientModal}
                className="inline-flex w-full justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400 sm:w-auto"
              >
                + Dodaj klienta
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap">
            <div className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700">
              Wszystkie: {stats.all}
            </div>

            <div className="rounded-xl bg-blue-100 px-4 py-2 font-semibold text-blue-900">
              Nowy lead: {stats.newLeads}
            </div>

            <div className="rounded-xl bg-amber-100 px-4 py-2 font-semibold text-amber-900">
              Przypisany: {stats.assigned}
            </div>

            <div className="rounded-xl bg-emerald-100 px-4 py-2 font-semibold text-emerald-900">
              Klient aktywny: {stats.active}
            </div>

            <div className="rounded-xl bg-red-100 px-4 py-2 font-semibold text-red-900">
              Utracony: {stats.lost}
            </div>
          </div>
        </header>

        <section className="relative z-40 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                Status klienta
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                  {[
                    "Wszystkie",
                    "Nowy lead",
                    "Przypisany",
                    "Klient aktywny",
                    "Utracony",
                  ].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                        statusFilter === status
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {[
                    "Wszystkie",
                    "Zaległe",
                    "W kontakcie",
                    "Niezainteresowani",
                  ].map((subStatus) => (
                    <button
                      key={subStatus}
                      type="button"
                      onClick={() => setSubStatusFilter(subStatus)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        subStatusFilter === subStatus
                          ? "bg-slate-800 text-white"
                          : subStatus === "Zaległe"
                          ? "bg-[#FBBCD0] text-[#700729] hover:bg-[#f7a8c0]"
                          : subStatus === "W kontakcie"
                          ? "bg-[#CCEBE6] text-slate-800 hover:bg-[#b8e0da]"
                          : subStatus === "Niezainteresowani"
                          ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {subStatus}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div ref={filtersPanelRef} className="relative z-50 w-full sm:w-[280px]">
              <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                Filtry dodatkowe
              </label>
              <button
                type="button"
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span>
                  Filtry{activeAdvancedFiltersCount > 0 ? ` (${activeAdvancedFiltersCount})` : ""}
                </span>
                <span className="text-slate-400">▾</span>
              </button>

              {showFiltersPanel && (
                <div className="absolute right-0 top-full z-[999] mt-2 max-h-[calc(100vh-220px)] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:w-[360px]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">Filtry klientów</p>
                    <button
                      type="button"
                      onClick={clearAdvancedFilters}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      Wyczyść
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                        Doradca
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={selectedAdvisorIds.includes("Brak")}
                            onChange={() =>
                              toggleFilterValue("Brak", selectedAdvisorIds, setSelectedAdvisorIds)
                            }
                          />
                          Brak doradcy
                        </label>

                        {sellers.map((seller) => (
                          <label
                            key={seller.id}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAdvisorIds.includes(seller.id)}
                              onChange={() =>
                                toggleFilterValue(seller.id, selectedAdvisorIds, setSelectedAdvisorIds)
                              }
                            />
                            {seller.display_name || seller.email || seller.id}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                        Typ klienta
                      </p>
                      <div className="flex gap-4">
                        {["B2C", "B2B"].map((type) => (
                          <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedClientTypes.includes(type)}
                              onChange={() =>
                                toggleFilterValue(type, selectedClientTypes, setSelectedClientTypes)
                              }
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                        Województwo
                      </p>
                      <div className="space-y-2">
                        {availableProvinces.length === 0 ? (
                          <p className="text-xs text-slate-400">Brak danych województw.</p>
                        ) : (
                          availableProvinces.map((province) => (
                            <label key={province} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedProvinces.includes(province)}
                                onChange={() => {
                                  toggleFilterValue(province, selectedProvinces, setSelectedProvinces);
                                  setSelectedCities([]);
                                }}
                              />
                              {province}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                        Miasto
                      </p>
                      <div className="space-y-2">
                        {availableCities.length === 0 ? (
                          <p className="text-xs text-slate-400">Brak miast dla wybranych filtrów.</p>
                        ) : (
                          availableCities.map((city) => (
                            <label key={city} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedCities.includes(city)}
                                onChange={() =>
                                  toggleFilterValue(city, selectedCities, setSelectedCities)
                                }
                              />
                              {city}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                        Tagi
                      </p>
                      <div className="space-y-2">
                        {availableTags.length === 0 ? (
                          <p className="text-xs text-slate-400">Brak aktywnych tagów.</p>
                        ) : (
                          availableTags.map((tag) => (
                            <label key={tag.id} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedTagIds.includes(tag.id)}
                                onChange={() =>
                                  toggleFilterValue(tag.id, selectedTagIds, setSelectedTagIds)
                                }
                              />
                              {tag.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {(canAssignClients() || canAnonymizeClients()) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm font-semibold text-slate-600">
                Zaznaczono: {selectedClientIds.length}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {canManageClientTags() && (
                  <>
                    <select
                      value={bulkTagId}
                      onChange={(event) => setBulkTagId(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="">Wybierz tag</option>
                      {availableTags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={addTagToSelectedClients}
                      disabled={bulkActionLoading || selectedClientIds.length === 0 || !bulkTagId}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Dodaj tag
                    </button>

                    <button
                      type="button"
                      onClick={removeTagFromSelectedClients}
                      disabled={bulkActionLoading || selectedClientIds.length === 0 || !bulkTagId}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Usuń tag
                    </button>
                  </>
                )}

                {canAssignClients() && (
                  <>
                    <select
                      value={bulkAssignSellerId}
                      onChange={(event) => setBulkAssignSellerId(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="">Wybierz użytkownika</option>
                      {sellers.map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.display_name || seller.email || seller.id} — {getRoleLabel(seller.role)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={assignSelectedClientsToSeller}
                      disabled={bulkActionLoading || selectedClientIds.length === 0 || !bulkAssignSellerId}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Przypisz zaznaczonych
                    </button>
                  </>
                )}

                {canAnonymizeClients() && (
                  <button
                    type="button"
                    onClick={anonymizeSelectedClients}
                    disabled={bulkActionLoading || selectedClientIds.length === 0}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anonimizuj zaznaczonych
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
        <section className="relative z-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-slate-500">Ładowanie klientów...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-6 text-slate-500">Brak klientów.</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full table-fixed text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="w-[5%] px-4 py-2.5 text-left font-semibold">
                      <input
                        type="checkbox"
                        checked={
                          visibleClients.length > 0 &&
                          visibleClients.every((client) => selectedClientIds.includes(client.id))
                        }
                        onChange={toggleAllVisibleClients}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="w-[24%] px-4 py-2.5 text-left font-semibold">Klient</th>
                    <th className="w-[13%] px-4 py-2.5 text-left font-semibold">Status</th>
                    <th className="w-[17%] px-4 py-2.5 text-left font-semibold">Doradca</th>
                    <th className="w-[15%] px-4 py-2.5 text-left font-semibold">Miasto</th>
                    <th className="w-[14%] px-4 py-2.5 text-left font-semibold">Województwo</th>
                    <th className="w-[12%] px-4 py-2.5 text-right font-semibold">Akcje</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleClients.map((client) => {
                    const isNotInterested =
                      isNotInterestedStatus(client.status) ||
                      isNotInterestedStatus(client.last_contact_status);
                    const contactBadge = client.contact_followup_status;
                    const rowBackgroundClass = isNotInterested
                      ? "bg-slate-100 text-slate-400 hover:bg-slate-100"
                      : contactBadge === "overdue"
                      ? "bg-[#FBBCD0] hover:bg-[#FBBCD0]"
                      : contactBadge === "active"
                      ? "bg-[#CCEBE6] hover:bg-[#CCEBE6]"
                      : "hover:bg-slate-50";

                    return (
                    <tr
                      key={client.id}
                      className={`border-b border-slate-100 transition ${rowBackgroundClass}`}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(client.id)}
                          onChange={() => toggleSelectedClient(client.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${getClientTypeClass(client)}`}
                          >
                            {getClientTypeLabel(client)}
                          </span>

                          <div className="min-w-0">
                            <div
                              className={`truncate font-semibold ${
                                isNotInterested ? "text-slate-400" : "text-slate-900"
                              }`}
                            >
                              {client.full_name || client.company_name || "Brak nazwy"}
                            </div>

                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              statusStyles[client.status || ""] ||
                              "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {client.status || "Brak statusu"}
                          </span>

                          {isNotInterested && (
                            <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                              Niezainteresowany
                            </span>
                          )}

                          {!isNotInterested && contactBadge === "active" && (
                            <span className="inline-flex rounded-full bg-[#73C7BA] px-2.5 py-0.5 text-[11px] font-bold text-slate-900">
                              W kontakcie
                            </span>
                          )}

                          {!isNotInterested && contactBadge === "overdue" && (
                            <span className="inline-flex rounded-full bg-[#700729] px-2.5 py-0.5 text-[11px] font-bold text-white">
                              Zaległy kontakt
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="truncate px-4 py-2.5 text-slate-700">
                        {getAdvisorName(client)}
                      </td>


                      <td className="truncate px-4 py-2.5 text-slate-700">
                        {client.city || "—"}
                      </td>

                      <td className="truncate px-4 py-2.5 text-slate-700">
                        {client.province || "—"}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          {canAssignClients() && (
                            <button
                              type="button"
                              onClick={() => openAssignModal(client)}
                              className="inline-flex rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Przypisz
                            </button>
                          )}

                          {canAnonymizeClients() && (
                            <button
                              type="button"
                              onClick={() => anonymizeClient(client)}
                              className="inline-flex rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                            >
                              Anonimizuj
                            </button>
                          )}

                          <Link
                            href={`/clients/${client.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                          >
                            Otwórz
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-400">
                {hasMoreClients
                  ? `Wyświetlono ${visibleClients.length} z ${filteredClients.length}. Przewiń niżej, aby doczytać kolejne.`
                  : `Wyświetlono wszystkie rekordy: ${filteredClients.length}.`}
              </div>
            </div>
          )}
        </section>
      </div>

      {assigningClient && canAssignClients() && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-4 sm:px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-5">
              <p className="text-sm font-semibold text-emerald-600">Przypisanie klienta</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {assigningClient.full_name || assigningClient.company_name || "Klient"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Wybierz użytkownika, do którego ma trafić ten klient.
              </p>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Użytkownik
            </label>
            <select
              value={selectedSellerId}
              onChange={(event) => setSelectedSellerId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Wybierz użytkownika</option>
              {sellers.map((seller) => {
                const roleLabel = getRoleLabel(seller.role);
                const isMe = seller.id === currentUserId;

                return (
                  <option key={seller.id} value={seller.id}>
                    {seller.display_name || seller.email || seller.id} — {roleLabel}
                    {isMe ? " — Ty" : ""}
                  </option>
                );
              })}
            </select>

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeAssignModal}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={assignClientToSeller}
                disabled={savingAssignment || !selectedSellerId}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
              >
                {savingAssignment ? "Przypisywanie..." : "Przypisz"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSelfAssignPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-3 py-4 sm:px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6">
              <p className="text-sm font-semibold text-emerald-600">
                Przypisanie klienta
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Czy przypisać tego klienta do Ciebie?
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Wybierając „Nie” lead wpadnie do ogólnej bazy.
                „Tak” przypisuje go od razu do Twoich kontaktów.
              </p>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowSelfAssignPrompt(false);
                  createCrmClient(false);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Nie
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSelfAssignPrompt(false);
                  createCrmClient(true);
                }}
                className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-400 sm:w-auto"
              >
                Tak
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <p className="text-sm font-semibold text-emerald-600">
                  Nowy klient CRM
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Dodawanie klienta
                </h2>
              </div>

              <button
                type="button"
                onClick={closeAddClientModal}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Zamknij
              </button>
            </div>

            <div className="mb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setClientType("B2C")}
                className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
                  clientType === "B2C"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                B2C
              </button>

              <button
                type="button"
                onClick={() => setClientType("B2B")}
                className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
                  clientType === "B2B"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                B2B
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {clientType === "B2C" ? (
                <>
                  <input
                    type="text"
                    placeholder="Imię i nazwisko"
                    value={newClient.full_name}
                    onChange={(event) =>
                      setNewClient({ ...newClient, full_name: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    placeholder="PESEL (opcjonalnie)"
                    value={newClient.pesel}
                    onChange={(event) =>
                      setNewClient({ ...newClient, pesel: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      placeholder="NIP"
                      value={newClient.nip}
                      onChange={(event) =>
                        setNewClient({ ...newClient, nip: event.target.value })
                      }
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                    />

                    <button
                      type="button"
                      onClick={fetchCompanyFromGus}
                      disabled={loadingGusData}
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {loadingGusData ? "Pobieranie..." : "Pobierz z GUS"}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Nazwa firmy"
                    value={newClient.company_name}
                    onChange={(event) =>
                      setNewClient({ ...newClient, company_name: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </>
              )}

              <input
                type="text"
                placeholder="Miejscowość"
                value={newClient.city}
                onChange={(event) =>
                  setNewClient({ ...newClient, city: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Kod pocztowy"
                value={newClient.postal_code}
                onChange={(event) =>
                  setNewClient({ ...newClient, postal_code: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Ulica"
                value={newClient.street}
                onChange={(event) =>
                  setNewClient({ ...newClient, street: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Nr domu"
                value={newClient.building_number}
                onChange={(event) =>
                  setNewClient({
                    ...newClient,
                    building_number: event.target.value,
                  })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <select
                value={newClient.province}
                onChange={(event) =>
                  setNewClient({ ...newClient, province: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              >
                <option value="">Województwo</option>
                {provinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <select
                  value={newClient.phone_country_code}
                  onChange={(event) =>
                    setNewClient({
                      ...newClient,
                      phone_country_code: event.target.value,
                    })
                  }
                  className="w-[115px] shrink-0 rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-emerald-500"
                >
                  {countryPhoneCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label} {country.code}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Telefon"
                  value={newClient.phone}
                  onChange={(event) =>
                    setNewClient({ ...newClient, phone: event.target.value })
                  }
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              <input
                type="email"
                placeholder="Email"
                value={newClient.email}
                onChange={(event) =>
                  setNewClient({ ...newClient, email: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              {clientType === "B2B" && (
                <>
                  <input
                    type="text"
                    placeholder="Osoba kontaktowa"
                    value={newClient.contact_person}
                    onChange={(event) =>
                      setNewClient({
                        ...newClient,
                        contact_person: event.target.value,
                      })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <div className="flex gap-2">
                    <select
                      value={newClient.contact_phone_country_code}
                      onChange={(event) =>
                        setNewClient({
                          ...newClient,
                          contact_phone_country_code: event.target.value,
                        })
                      }
                      className="w-[115px] shrink-0 rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-emerald-500"
                    >
                      {countryPhoneCodes.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label} {country.code}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Telefon do osoby kontaktowej"
                      value={newClient.contact_phone}
                      onChange={(event) =>
                        setNewClient({
                          ...newClient,
                          contact_phone: event.target.value,
                        })
                      }
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Notatka do leada
                </span>

                <textarea
                  value={newClientNote}
                  onChange={(event) => setNewClientNote(event.target.value)}
                  placeholder="Opcjonalnie wpisz krótki opis kontaktu, ustalenia lub powód pozostawienia leada w ogólnej bazie..."
                  className="mt-2 min-h-[120px] w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Notatka zapisze się automatycznie na karcie klienta w module notatek.
                </p>
              </label>
            </div>
            <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeAddClientModal}
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={() => createCrmClient()}
                disabled={savingClient}
                className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
              >
                {savingClient ? "Zapisywanie..." : "Dodaj klienta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <main className="text-slate-900">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Ładowanie klientów...
          </div>
        </main>
      }
    >
      <ClientsPageContent />
    </Suspense>
  );
}