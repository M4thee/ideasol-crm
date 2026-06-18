"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ClientsTable from "@/app/clients/ClientsTable";
import { Client } from "@/app/clients/types";
import {
  canViewCompanySales,
  canViewTeamCalendar,
} from "@/lib/permissions";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    role?: "admin" | "owner" | "manager" | "seller" | "cc";
  };
};

type FollowUp = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  follow_up_at: string;
  status: string | null;
  client_name: string;
};

type Meeting = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  meeting_at: string;
  status: string | null;
  client_name: string;
  meeting_address: string;
  created_by: string | null;
  owner_name: string;
};

type SalesSummary = {
  closedMeetingsCount: number;
  meetingsWithSalesCount: number;
  conversionRate: number;
  monthlySellerMargin: number;
};

type ResolutionStatus =
  | "no_answer"
  | "call_back_request"
  | "not_interested"
  | "meeting_scheduled";

const resolutionStatusOptions = [
  { value: "no_answer", label: "Nie odbiera" },
  { value: "call_back_request", label: "Prośba o ponowny kontakt" },
  { value: "not_interested", label: "Niezainteresowany" },
  { value: "meeting_scheduled", label: "Umówione spotkanie" },
];

const AUTH_EXPIRY_STORAGE_KEY = "ideasol_auth_expires_at";
const AUTH_REMEMBER_STORAGE_KEY = "ideasol_auth_remember_me";
const SESSION_DURATION_REMEMBER_MS = 12 * 60 * 60 * 1000;

const SESSION_DURATION_SHORT_MS = 30 * 60 * 1000;

type UserRole = "admin" | "owner" | "manager" | "seller" | "cc";

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("seller");
  const [managerInfo, setManagerInfo] = useState<{
    display_name: string;
    role: string;
  } | null>(null);
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  async function loadVisibleUserIds() {
    if (!currentUser?.id) {
      setVisibleUserIds([]);
      return;
    }

    if (["admin", "owner"].includes(currentUserRole)) {
      setVisibleUserIds(null);
      return;
    }

    if (["seller", "cc"].includes(currentUserRole)) {
      setVisibleUserIds([currentUser.id]);
      return;
    }

    if (currentUserRole === "manager") {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("manager_id", currentUser.id);

      if (error) {
        console.error("Błąd ładowania zespołu managera", error);
        setVisibleUserIds([currentUser.id]);
        return;
      }

      const teamIds = (data || []).map((item) => item.id);

      setVisibleUserIds([currentUser.id, ...teamIds]);
    }
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetPasswordStatus, setResetPasswordStatus] = useState("");
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [showResetPasswordView, setShowResetPasswordView] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [salesSummary, setSalesSummary] = useState<SalesSummary>({
    closedMeetingsCount: 0,
    meetingsWithSalesCount: 0,
    conversionRate: 0,
    monthlySellerMargin: 0,
  });
  const [loadingSalesSummary, setLoadingSalesSummary] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"mine" | "team">("mine");
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [calendarShowMore, setCalendarShowMore] = useState(false);
  const [visibleFollowUpsCount, setVisibleFollowUpsCount] = useState(3);
  const [visibleClientsCount, setVisibleClientsCount] = useState(10);
  const [meetingsCollapsed, setMeetingsCollapsed] = useState(false);
  const [salesSummaryCollapsed, setSalesSummaryCollapsed] = useState(false);
  const [salesSummaryMode, setSalesSummaryMode] = useState<"mine" | "team">("mine");
  const [followUpsCollapsed, setFollowUpsCollapsed] = useState(false);
  const [clientsCollapsed, setClientsCollapsed] = useState(false);
  const [resolvingFollowUp, setResolvingFollowUp] = useState<FollowUp | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>("no_answer");
  const [resolutionDescription, setResolutionDescription] = useState("");
  const [resolutionFollowUpAt, setResolutionFollowUpAt] = useState("");
  const [resolutionMeetingAt, setResolutionMeetingAt] = useState("");
  const [resolutionError, setResolutionError] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const meetingsRef = useRef<HTMLDivElement | null>(null);
  const followUpsRef = useRef<HTMLDivElement | null>(null);
  const clientsRef = useRef<HTMLDivElement | null>(null);

  function scrollToWidget(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function getAuthExpiry() {
    if (typeof window === "undefined") return null;

    const rawExpiry = window.localStorage.getItem(AUTH_EXPIRY_STORAGE_KEY);
    const parsedExpiry = rawExpiry ? Number(rawExpiry) : null;

    return Number.isFinite(parsedExpiry) ? parsedExpiry : null;
  }

  function saveAuthExpiry(shouldRememberUser: boolean) {
    if (typeof window === "undefined") return;

    const duration = shouldRememberUser
      ? SESSION_DURATION_REMEMBER_MS
      : SESSION_DURATION_SHORT_MS;

    window.localStorage.setItem(
      AUTH_EXPIRY_STORAGE_KEY,
      String(Date.now() + duration)
    );
    window.localStorage.setItem(
      AUTH_REMEMBER_STORAGE_KEY,
      shouldRememberUser ? "true" : "false"
    );
  }

  async function clearExpiredSessionIfNeeded() {
    const expiry = getAuthExpiry();

    if (!expiry) return false;

    if (Date.now() <= expiry) return false;

    window.localStorage.removeItem(AUTH_EXPIRY_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_REMEMBER_STORAGE_KEY);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentUserRole("seller");
    setClients([]);
    setSelectedClient(null);
    setError("Sesja wygasła. Zaloguj się ponownie.");

    return true;
  }


  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const [clientType, setClientType] = useState("B2C");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [nip, setNip] = useState("");
  const [phone, setPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      setAuthLoading(true);

      if (typeof window !== "undefined") {
        setRememberMe(
          window.localStorage.getItem(AUTH_REMEMBER_STORAGE_KEY) === "true"
        );
      }

      const fallbackTimer = window.setTimeout(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      }, 2500);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Błąd pobierania sesji", sessionError);
        }

        if (!mounted) return;

        if (!session?.user) {
          setCurrentUser(null);
          setCurrentUserRole("seller");
          setAuthLoading(false);
          return;
        }

        setCurrentUser(session.user as AuthUser);
        setAuthLoading(false);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role, manager_id, is_active")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Błąd pobierania profilu użytkownika",
            JSON.stringify(profileError, null, 2)
          );
        }

        if (profileData?.is_active === false) {
          await supabase.auth.signOut();

          if (!mounted) return;

          setCurrentUser(null);
          setCurrentUserRole("seller");
          setClients([]);
          setSelectedClient(null);
          setError("Administrator dezaktywował Twój dostęp do CRM. Skontaktuj się z administratorem systemu.");
          setAuthLoading(false);
          return;
        }

        if (!mounted) return;

        setCurrentUserRole(
          (profileData?.role || "seller") as "admin" | "owner" | "manager" | "seller" | "cc"
        );
        if (profileData?.manager_id) {
          const { data: managerData } = await supabase
            .from("profiles")
            .select("display_name, role")
            .eq("id", profileData.manager_id)
            .maybeSingle();

          if (managerData) {
            setManagerInfo({
              display_name: managerData.display_name || "Brak nazwy",
              role: managerData.role || "manager",
            });
          }
        }
      } catch (authError) {
        console.error("Błąd sprawdzania sesji", authError);

        if (!mounted) return;

        setCurrentUser(null);
        setCurrentUserRole("seller");
        setAuthLoading(false);
      } finally {
        window.clearTimeout(fallbackTimer);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setAuthLoading(false);
        setCurrentUser(null);
        setCurrentUserRole("seller");
        setClients([]);
        setSelectedClient(null);
        return;
      }

      if (session?.user) {
        setCurrentUser(session.user as AuthUser);
        setAuthLoading(false);

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role, manager_id, is_active")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Błąd pobierania profilu po zmianie sesji",
            JSON.stringify(profileError, null, 2)
          );
        }

        if (profileData?.is_active === false) {
          await supabase.auth.signOut();

          if (!mounted) return;

          setCurrentUser(null);
          setCurrentUserRole("seller");
          setClients([]);
          setSelectedClient(null);
          setError("Administrator dezaktywował Twój dostęp do CRM.");
          setAuthLoading(false);
          return;
        }

        if (!mounted) return;

        setCurrentUserRole(
          (profileData?.role || "seller") as "admin" | "owner" | "manager" | "seller" | "cc"
        );
        if (profileData?.manager_id) {
          const { data: managerData } = await supabase
            .from("profiles")
            .select("display_name, role")
            .eq("id", profileData.manager_id)
            .maybeSingle();

          if (managerData) {
            setManagerInfo({
              display_name: managerData.display_name || "Brak nazwy",
              role: managerData.role || "manager",
            });
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    if (!currentUser?.id) return;

    loadVisibleUserIds();
  }, [currentUser?.id, currentUserRole]);

  useEffect(() => {
    if (!currentUser || visibleUserIds === undefined) return;

    loadClients();
    loadFollowUps();
    loadMeetings();
    loadSalesSummary();
  }, [
    currentUser?.id,
    currentUserRole,
    calendarMode,
    salesSummaryMode,
    JSON.stringify(visibleUserIds),
  ]);

  async function loadClients() {
    setLoadingClients(true);

    let query = supabase
      .from("clients")
      .select(
        "id, full_name, company_name, contact_person, nip, phone, email, street, building_number, postal_code, city, client_type, status, assigned_user_id"
      )
      .order("created_at", { ascending: false });

    if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("assigned_user_id", visibleUserIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania klientów", error);
    }

    if (data) {
      setClients(data);
    }

    setLoadingClients(false);
  }

  function isEventDone(status: string | null) {
    const normalizedStatus = (status || "").trim().toLowerCase();

    return (
      normalizedStatus === "done" ||
      normalizedStatus === "completed" ||
      normalizedStatus === "complete" ||
      normalizedStatus === "finished" ||
      normalizedStatus === "closed" ||
      normalizedStatus === "resolved" ||
      normalizedStatus === "zrobione" ||
      normalizedStatus === "wykonane" ||
      normalizedStatus === "zamknięte" ||
      normalizedStatus === "zamkniete" ||
      normalizedStatus.startsWith("zakończone") ||
      normalizedStatus.startsWith("zakonczone") ||
      normalizedStatus.startsWith("zakończony") ||
      normalizedStatus.startsWith("zakonczony") 
    );
  }

  function parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") return value;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function toFiniteNumber(value: unknown) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string") {
      const normalized = value
        .replace(/\s/g, "")
        .replace("zł", "")
        .replace(",", ".");

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  function findCompanyMarginDeep(value: unknown): number | null {
    const parsedValue = parseMaybeJson(value);

    if (!parsedValue || typeof parsedValue !== "object") return null;

    if (Array.isArray(parsedValue)) {
      for (const item of parsedValue) {
        const foundValue = findCompanyMarginDeep(item);
        if (foundValue !== null) return foundValue;
      }

      return null;
    }

    const record = parsedValue as Record<string, unknown>;

    const preferredKeys = [
      "companyMargin",
      "company_margin",
      "margin_company",
      "companyProfit",
      "company_profit",
      "realCompanyMargin",
      "real_company_margin",
    ];

    for (const key of preferredKeys) {
      const numberValue = toFiniteNumber(record[key]);
      if (numberValue !== null) return numberValue;
    }

    const label = String(record.label || record.name || record.title || "").toLowerCase();

    if (
      label.includes("marża firmy") ||
      label.includes("marza firmy") ||
      label.includes("realna marża") ||
      label.includes("realna marza")
    ) {
      const numberValue =
        toFiniteNumber(record.value) ??
        toFiniteNumber(record.amount) ??
        toFiniteNumber(record.net) ??
        toFiniteNumber(record.price);

      if (numberValue !== null) return numberValue;
    }

    for (const nestedValue of Object.values(record)) {
      const foundValue = findCompanyMarginDeep(nestedValue);
      if (foundValue !== null) return foundValue;
    }

    return null;
  }

  function findSellerCommissionAfterWarrantyDeep(value: unknown): number | null {
    const parsedValue = parseMaybeJson(value);

    if (!parsedValue || typeof parsedValue !== "object") return null;

    if (Array.isArray(parsedValue)) {
      for (const item of parsedValue) {
        const foundValue = findSellerCommissionAfterWarrantyDeep(item);
        if (foundValue !== null) return foundValue;
      }

      return null;
    }

    const record = parsedValue as Record<string, unknown>;

    const preferredKeys = [
      "sellerCommissionAfterWarranty",
      "seller_commission_after_warranty",
      "sellerCommissionNetAfterWarranty",
      "seller_commission_net_after_warranty",
      "sellerWarrantyCommissionNet",
      "seller_warranty_commission_net",
      "sellerCommissionNet",
      "seller_commission_net",
    ];

    for (const key of preferredKeys) {
      const numberValue = toFiniteNumber(record[key]);
      if (numberValue !== null) return numberValue;
    }

    const label = String(record.label || record.name || record.title || "").toLowerCase();

    if (
      label.includes("prowizja handlowca po rękojmi") ||
      label.includes("prowizja handlowca po rekojmi") ||
      label.includes("handlowca po rękojmi") ||
      label.includes("handlowca po rekojmi")
    ) {
      const numberValue =
        toFiniteNumber(record.value) ??
        toFiniteNumber(record.amount) ??
        toFiniteNumber(record.net) ??
        toFiniteNumber(record.price);

      if (numberValue !== null) return numberValue;
    }

    for (const nestedValue of Object.values(record)) {
      const foundValue = findSellerCommissionAfterWarrantyDeep(nestedValue);
      if (foundValue !== null) return foundValue;
    }

    return null;
  }

  function saleBelongsToCurrentUser(sale: Record<string, unknown>) {
    if (!currentUser?.id) return false;

    const userId = currentUser.id;
    const userEmail = currentUser.email || "";

    const directUserFields = [
      sale.seller_id,
      sale.user_id,
      sale.advisor_id,
      sale.owner_id,
    ];

    if (directUserFields.some((value) => value === userId)) return true;

    function deepIncludesUser(value: unknown): boolean {
      const parsedValue = parseMaybeJson(value);

      if (!parsedValue || typeof parsedValue !== "object") return false;

      if (Array.isArray(parsedValue)) {
        return parsedValue.some((item) => deepIncludesUser(item));
      }

      const record = parsedValue as Record<string, unknown>;

      const possibleIdKeys = [
        "id",
        "userId",
        "user_id",
        "sellerId",
        "seller_id",
        "advisorId",
        "advisor_id",
        "sellerUserId",
        "seller_user_id",
        "advisorUserId",
        "advisor_user_id",
      ];

      for (const key of possibleIdKeys) {
        if (record[key] === userId) return true;
      }

      const possibleEmailKeys = [
        "email",
        "sellerEmail",
        "seller_email",
        "advisorEmail",
        "advisor_email",
      ];

      for (const key of possibleEmailKeys) {
        if (userEmail && record[key] === userEmail) return true;
      }

      return Object.values(record).some((nestedValue) => deepIncludesUser(nestedValue));
    }

    return deepIncludesUser(sale);
  }

  async function loadFollowUps() {
    setLoadingFollowUps(true);

    let query = supabase
      .from("calendar_events")
      .select("id, client_id, title, description, event_at, status, created_by")
      .eq("event_type", "reminder")
      .not("client_id", "is", null)
      .order("event_at", { ascending: true });

    if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("created_by", visibleUserIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania przypomnień", error);
      setLoadingFollowUps(false);
      return;
    }

    const activeReminders = (data || []).filter(
      (item) => !isEventDone(item.status)
    );

    if (activeReminders.length === 0) {
      setFollowUps([]);
      setLoadingFollowUps(false);
      return;
    }

    const clientIds = [...new Set(activeReminders.map((item) => item.client_id))];

    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, company_name")
      .in("id", clientIds);

    if (clientsError) {
      console.error("Błąd ładowania klientów dla przypomnień", clientsError);
    }

    const clientsById = new Map(
      (clientsData || []).map((client) => [
        client.id,
        client.full_name || client.company_name || "Klient",
      ])
    );

    setFollowUps(
      activeReminders.map((item) => ({
        id: item.id,
        client_id: item.client_id,
        title: item.title || "Ponowny kontakt",
        description: item.description,
        follow_up_at: item.event_at,
        status: item.status,
        client_name: clientsById.get(item.client_id) || "Klient",
      }))
    );

    setLoadingFollowUps(false);
  }

  async function loadMeetings() {
    setLoadingMeetings(true);

    const nowIso = new Date().toISOString();

    let query = supabase
      .from("calendar_events")
      .select("id, client_id, title, description, event_at, status, created_by")
      .eq("event_type", "meeting")
      .not("client_id", "is", null)
      .gte("event_at", nowIso)
      .order("event_at", { ascending: true });

    if (calendarMode === "mine" && currentUser?.id) {
      query = query.eq("created_by", currentUser.id);
    } else if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("created_by", visibleUserIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania spotkań", error);
      setLoadingMeetings(false);
      return;
    }

    const activeMeetings = (data || []).filter(
      (item) => !isEventDone(item.status)
    );

    if (activeMeetings.length === 0) {
      setMeetings([]);
      setLoadingMeetings(false);
      return;
    }

    const clientIds = [...new Set(activeMeetings.map((item) => item.client_id))];
    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, company_name, street, building_number, postal_code, city, assigned_user_id")
      .in("id", clientIds);

    if (clientsError) {
      console.error("Błąd ładowania klientów dla spotkań", clientsError);
    }

    const clientsById = new Map(
      (clientsData || []).map((client) => [
        client.id,
        {
          name: client.full_name || client.company_name || "Klient",
          address: [
            [client.street, client.building_number].filter(Boolean).join(" "),
            [client.postal_code, client.city].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .join(", "),
          assigned_user_id: client.assigned_user_id as string | null,
        },
      ])
    );

    const ownerIds = [
      ...new Set(
        activeMeetings
          .flatMap((item) => [
            item.created_by,
            clientsById.get(item.client_id)?.assigned_user_id,
          ])
          .filter((item): item is string => Boolean(item))
      ),
    ];

    let ownersById = new Map<string, string>();

    if (ownerIds.length > 0) {
      const { data: ownersData, error: ownersError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ownerIds);

      if (ownersError) {
        console.warn("Nie udało się pobrać opiekunów spotkań", ownersError);
      }

      ownersById = new Map(
        (ownersData || []).map((owner) => [
          owner.id,
          owner.full_name ||
            owner.display_name ||
            owner.name ||
            owner.username ||
            owner.email ||
            `ID: ${owner.id.slice(0, 8)}`,
        ])
      );
    }

    setMeetings(
      activeMeetings.map((item) => ({
        id: item.id,
        client_id: item.client_id,
        title: item.title || "Spotkanie",
        description: item.description,
        meeting_at: item.event_at,
        status: item.status,
        client_name: clientsById.get(item.client_id)?.name || "Klient",
        meeting_address:
          clientsById.get(item.client_id)?.address || "Brak adresu spotkania",
        created_by: item.created_by,
        owner_name:
          (item.created_by && ownersById.get(item.created_by)) ||
          (clientsById.get(item.client_id)?.assigned_user_id &&
            ownersById.get(clientsById.get(item.client_id)?.assigned_user_id || "")) ||
          (item.created_by === currentUser?.id
            ? currentUser?.user_metadata?.display_name || currentUser?.email || "Ja"
            : item.created_by
              ? `Użytkownik ${item.created_by.slice(0, 8)}`
              : "Brak opiekuna"),
      }))
    );

    setLoadingMeetings(false);
  }

  async function loadSalesSummary() {
    setLoadingSalesSummary(true);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

    const canViewCompanySalesSummary =
      canViewCompanySales(currentUserRole as any);
    const shouldShowCompanySalesSummary =
      canViewCompanySalesSummary && salesSummaryMode === "team";

    let closedMeetingsQuery = supabase
      .from("calendar_events")
      .select("id, status, created_by")
      .eq("event_type", "meeting")
      .like("status", "Zakończone - %");

    if (!shouldShowCompanySalesSummary) {
      if (visibleUserIds && visibleUserIds.length > 0) {
        closedMeetingsQuery = closedMeetingsQuery.in(
          "created_by",
          visibleUserIds
        );
      }
    }

    const { data: closedMeetings, error: closedMeetingsError } = await closedMeetingsQuery;

    if (closedMeetingsError) {
      console.error("Błąd ładowania zamkniętych spotkań", closedMeetingsError);
    }

    const closedMeetingsCount = closedMeetings?.length || 0;

    const { data: allSales, error: monthlySalesError } = await supabase
      .from("sales")
      .select("*")
      .eq("status", "Zakończona");

    if (monthlySalesError) {
      console.warn("Nie udało się pobrać sprzedaży do podsumowania", monthlySalesError);
    }

    const monthlySales = (allSales || []).filter((sale) => {
      const rawSaleDate = sale.sale_date || sale.created_at;
      if (!rawSaleDate) return false;

      const saleDate = new Date(rawSaleDate);
      const isCurrentMonth = saleDate >= monthStart && saleDate < nextMonthStart;

      if (!isCurrentMonth) return false;

      if ((sale as any).deleted_at) return false;

      if (shouldShowCompanySalesSummary) return true;

      return saleBelongsToCurrentUser(sale as Record<string, unknown>);
    });

    const meetingsWithSalesCount = monthlySales.length;
    const conversionRate =
      closedMeetingsCount > 0
        ? Math.round((meetingsWithSalesCount / closedMeetingsCount) * 100)
        : 0;

    const monthlySellerMargin = monthlySales.reduce((sum, sale) => {
      if (shouldShowCompanySalesSummary) {
        const companyMargin = findCompanyMarginDeep(sale);
        return sum + (companyMargin ?? 0);
      }

      const sellerCommissionAfterWarranty = findSellerCommissionAfterWarrantyDeep(sale);

      return sum + (sellerCommissionAfterWarranty ?? 0);
    }, 0);

    setSalesSummary({
      closedMeetingsCount,
      meetingsWithSalesCount,
      conversionRate,
      monthlySellerMargin,
    });

    setLoadingSalesSummary(false);
  }

  const visibleMeetingsLimit = calendarShowMore ? 12 : calendarExpanded ? 6 : 3;
  const visibleMeetings = meetings.slice(0, visibleMeetingsLimit);

  function shortenText(value: string, maxLength = 28) {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trim()}...`;
  }
  const canManageTeamCalendar =
    canViewTeamCalendar(currentUserRole as any);
  const canViewCompanySalesSummary =
    canViewCompanySales(currentUserRole as any);
  const visibleClients = clients.slice(0, visibleClientsCount);
  const visibleFollowUps = followUps.slice(0, visibleFollowUpsCount);
  const salesSummaryCircleRadius = 42;
  const salesSummaryCircleCircumference = 2 * Math.PI * salesSummaryCircleRadius;
  const salesSummaryCircleOffset =
    salesSummaryCircleCircumference -
    (salesSummary.conversionRate / 100) * salesSummaryCircleCircumference;

  function startResolvingFollowUp(followUp: FollowUp) {
    setResolvingFollowUp(followUp);
    setResolutionStatus("no_answer");
    setResolutionDescription("");
    setResolutionFollowUpAt("");
    setResolutionMeetingAt("");
    setResolutionError("");
  }

  function closeResolutionModal() {
    setResolvingFollowUp(null);
    setResolutionError("");
  }

  function needsNextFollowUp(status: ResolutionStatus) {
    return ["no_answer", "call_back_request"].includes(status);
  }

  function needsMeeting(status: ResolutionStatus) {
    return status === "meeting_scheduled";
  }

  function getResolutionStatusLabel(status: ResolutionStatus) {
    return (
      resolutionStatusOptions.find((option) => option.value === status)?.label ||
      status
    );
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

  function addMinutesToIsoDateTime(value: string, minutes: number) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  async function syncMeetingToOutlook(params: {
    calendarEventId: string;
    title: string;
    description: string | null;
    eventAt: string;
    clientName: string;
  }) {
    if (!currentUser?.email) {
      return;
    }

    try {
      const response = await fetch("/api/microsoft/outlook/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: currentUser.email,
          subject: params.title,
          body: [
            `<strong>Klient:</strong> ${params.clientName}`,
            params.description ? `<br/><br/>${params.description}` : "",
            `<br/><br/><a href="${window.location.origin}/event/${params.calendarEventId}">Otwórz spotkanie w CRM</a>`,
          ].join(""),
          startDateTime: new Date(params.eventAt).toISOString(),
          endDateTime: addMinutesToIsoDateTime(params.eventAt, 60),
          timeZone: "Europe/Warsaw",
          reminderMinutesBeforeStart: 10,
        }),
      });

      const result = await response.json();

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
      console.error("Nie udało się zsynchronizować spotkania z Outlook", error);

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

  async function resolveFollowUp() {
    if (!resolvingFollowUp || !currentUser) return;

    setResolutionError("");

    if (needsNextFollowUp(resolutionStatus) && !resolutionFollowUpAt) {
      setResolutionError("Ustaw datę kolejnego przypomnienia");
      return;
    }
    if (
      needsNextFollowUp(resolutionStatus) &&
      new Date(resolutionFollowUpAt).getTime() <= Date.now()
    ) {
      setResolutionError("Data kolejnego przypomnienia nie może być z przeszłości");
      return;
    }

    if (needsMeeting(resolutionStatus) && !resolutionMeetingAt) {
      setResolutionError("Ustaw datę spotkania");
      return;
    }
    if (
      needsMeeting(resolutionStatus) &&
      new Date(resolutionMeetingAt).getTime() <= Date.now()
    ) {
      setResolutionError("Data spotkania nie może być z przeszłości");
      return;
    }

    setSavingResolution(true);

    const completedStatus = `Zakończone - ${getResolutionStatusLabel(resolutionStatus)}`;

    const { error: updateError } = await supabase
      .from("calendar_events")
      .update({ status: completedStatus })
      .eq("id", resolvingFollowUp.id);

    if (updateError) {
      console.error(updateError);
      setResolutionError("Nie udało się zamknąć zadania");
      setSavingResolution(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("client_activities")
      .insert({
        client_id: resolvingFollowUp.client_id,
        created_by: currentUser.id,
        activity_type: "phone",
        title: getResolutionStatusLabel(resolutionStatus),
        description: resolutionDescription,
        phone_contact_type: "marketing",
        phone_status: resolutionStatus,
        follow_up_at: needsNextFollowUp(resolutionStatus)
          ? resolutionFollowUpAt
          : null,
        meeting_at: needsMeeting(resolutionStatus)
          ? resolutionMeetingAt
          : null,
        meeting_owner_id: needsMeeting(resolutionStatus)
          ? currentUser.id
          : null,
      });

    if (insertError) {
      console.error(insertError);
    }

    if (needsNextFollowUp(resolutionStatus)) {
      const { error: reminderError } = await supabase.from("calendar_events").insert({
        client_id: resolvingFollowUp.client_id,
        title: `Ponowny kontakt: ${getResolutionStatusLabel(resolutionStatus)}`,
        description: resolutionDescription || null,
        event_type: "reminder",
        event_at: resolutionFollowUpAt,
        status: "planned",
        created_by: currentUser.id,
      });

      if (reminderError) {
        console.error("Nie udało się utworzyć kolejnego przypomnienia", reminderError);
        setResolutionError("Rezultat zapisany, ale nie udało się utworzyć kolejnego przypomnienia");
        setSavingResolution(false);
        return;
      }
    }

    if (needsMeeting(resolutionStatus)) {
      const meetingTitle = `Spotkanie: ${resolvingFollowUp.client_name}`;
      const meetingDescription = resolutionDescription || null;

      const { data: meetingData, error: meetingError } = await supabase
        .from("calendar_events")
        .insert({
          client_id: resolvingFollowUp.client_id,
          title: meetingTitle,
          description: meetingDescription,
          event_type: "meeting",
          event_at: resolutionMeetingAt,
          status: "planned",
          created_by: currentUser.id,
          microsoft_sync_status: "pending",
        })
        .select("id")
        .single();

      if (meetingError) {
        console.error("Nie udało się utworzyć spotkania", meetingError);
        setResolutionError("Rezultat zapisany, ale nie udało się utworzyć spotkania");
        setSavingResolution(false);
        return;
      }

      if (meetingData?.id) {
        await syncMeetingToOutlook({
          calendarEventId: meetingData.id,
          title: meetingTitle,
          description: meetingDescription,
          eventAt: resolutionMeetingAt,
          clientName: resolvingFollowUp.client_name,
        });
      }
    }

    setSavingResolution(false);
    closeResolutionModal();
    loadFollowUps();
    loadMeetings();
  }

  async function openClientFromFollowUp(clientId: string) {
    if (!["seller", "cc"].includes(currentUserRole)) {
      router.push(`/clients/${clientId}`);
      return;
    }

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, assigned_user_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientData?.assigned_user_id !== currentUser?.id) {
      alert("Nie masz uprawnień do przeglądania tego profilu");
      return;
    }

    router.push(`/clients/${clientId}`);
  }

  function getFollowUpGroup(followUpAt: string) {
    const now = new Date();
    const date = new Date(followUpAt);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const dayAfterTomorrowStart = new Date(todayStart);
    dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 2);

    if (date < now) return "Zaległe";
    if (date >= todayStart && date < tomorrowStart) return "Dzisiaj";
    if (date >= tomorrowStart && date < dayAfterTomorrowStart) return "Jutro";

    return "Później";
  }

  async function createCrmClient() {
    if (!currentUser) return;

    setClientError("");

    if (clientType === "B2C" && !fullName.trim()) {
      setClientError("Wprowadź imię i nazwisko klienta");
      return;
    }

    if (clientType === "B2B" && !companyName.trim()) {
      setClientError("Wprowadź nazwę firmy");
      return;
    }

    setSavingClient(true);

    const { error } = await supabase.from("clients").insert({
      created_by: currentUser.id,
      assigned_to: currentUser.id,
      assigned_user_id: currentUser.id,
      client_type: clientType,
      full_name: clientType === "B2C" ? fullName : null,
      company_name: clientType === "B2B" ? companyName : null,
      contact_person: clientType === "B2B" ? contactPerson : null,
      nip: clientType === "B2B" ? nip : null,
      phone,
      email: clientEmail,
      street,
      building_number: buildingNumber,
      city,
      postal_code: postalCode,
      status: "assigned",
    });

    if (error) {
      console.error("Błąd dodawania klienta", error);
      setClientError("Nie udało się dodać klienta");
      setSavingClient(false);
      return;
    }

    setFullName("");
    setCompanyName("");
    setContactPerson("");
    setNip("");
    setPhone("");
    setClientEmail("");
    setStreet("");
    setBuildingNumber("");
    setCity("");
    setPostalCode("");

    setShowAddClientModal(false);
    setSavingClient(false);

    loadClients();
  }

  async function login() {
    setError("");
    setResetPasswordStatus("");
    setAuthLoading(false);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Nieprawidłowy login lub hasło");
      setAuthLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Administrator dezaktywował Twój dostęp do CRM.");
      setAuthLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role, password_reset_required, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Błąd sprawdzania profilu po logowaniu",
        JSON.stringify(profileError, null, 2)
      );
    }

    if (profileData?.is_active === false) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setCurrentUserRole("seller");
      setClients([]);
      setSelectedClient(null);
      setError("Administrator dezaktywował Twój dostęp do CRM.");
      setAuthLoading(false);
      return;
    }

    setCurrentUser(user as AuthUser);
    setCurrentUserRole(
      (profileData?.role || "seller") as "admin" | "owner" | "manager" | "seller" | "cc"
    );
    setPassword("");
    setAuthLoading(false);
  }

  async function sendPasswordReset() {
    setError("");
    setResetPasswordStatus("");

    if (!email.trim()) {
      setResetPasswordStatus("Wpisz adres e-mail, żeby wysłać link resetujący hasło.");
      return;
    }

    setSendingPasswordReset(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error("Błąd wysyłki resetu hasła", error);
      setResetPasswordStatus("Nie udało się wysłać linku resetującego hasło.");
      setSendingPasswordReset(false);
      return;
    }

    const { error: resetFlagError } = await supabase
      .from("profiles")
      .update({
        password_reset_required: true,
        password_reset_requested_at: new Date().toISOString(),
      })
      .eq("email", email.trim());

    if (resetFlagError) {
      console.error("Błąd ustawiania flagi resetu hasła", resetFlagError);
      setResetPasswordStatus(
        "Link został wysłany, ale nie udało się zablokować starego hasła. Sprawdź kolumnę email w profiles."
      );
      setSendingPasswordReset(false);
      return;
    }

    setResetPasswordStatus(
      "Link do resetowania hasła został wysłany na podany e-mail. Stare hasło zostało zablokowane w CRM."
    );
    setSendingPasswordReset(false);
  }


  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
          <p className="text-sm font-semibold text-slate-600">Sprawdzanie sesji...</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/logo.png"
              alt="IdeaSol CRM"
              className="h-[72px] w-auto"
            />

            <span className="text-lg font-bold text-slate-900">CRM</span>
          </div>

          <p className="text-slate-500 mb-8">
            {showResetPasswordView
              ? "Wpisz adres e-mail, żeby otrzymać link do resetowania hasła."
              : "Zaloguj się do systemu CRM."}
          </p>

          {showResetPasswordView ? (
            <div className="space-y-4">
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900"
              />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {resetPasswordStatus && (
                <p className="text-sm font-medium text-slate-600">
                  {resetPasswordStatus}
                </p>
              )}

              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={sendingPasswordReset}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl px-4 py-3 disabled:bg-slate-300 disabled:text-slate-500"
              >
                {sendingPasswordReset ? "Wysyłanie..." : "Wyślij link resetujący"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowResetPasswordView(false);
                  setResetPasswordStatus("");
                  setError("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Powrót do logowania
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900"
              />

              <input
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900"
              />

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  Zapamiętaj mnie
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordView(true);
                    setResetPasswordStatus("");
                    setError("");
                  }}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-600"
                >
                  Przypomnij hasło
                </button>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="button"
                onClick={login}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl px-4 py-3"
              >
                Zaloguj
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="text-slate-900">
      <div>

        <section className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div ref={meetingsRef} className="xl:col-span-2 self-start bg-white border border-slate-200 rounded-2xl shadow-sm p-6 scroll-mt-6">
            <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Kalendarz spotkań</h2>

                <p className="text-slate-500 text-sm mt-1">
                  Najbliższe przyszłe spotkania zapisane w CRM.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!meetingsCollapsed && canManageTeamCalendar && (
                  <div className="flex rounded-xl border border-emerald-200 bg-emerald-50 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarMode("mine");
                        setCalendarExpanded(false);
                        setCalendarShowMore(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        calendarMode === "mine"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-emerald-700 hover:bg-white"
                      }`}
                    >
                      Moje spotkania
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCalendarMode("team");
                        setCalendarExpanded(false);
                        setCalendarShowMore(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        calendarMode === "team"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-emerald-700 hover:bg-white"
                      }`}
                    >
                      Spotkania handlowców
                    </button>
                  </div>
                )}

                {!meetingsCollapsed && (
                  <button
                    type="button"
                    onClick={loadMeetings}
                    className="bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm"
                  >
                    Odśwież
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMeetingsCollapsed((value) => !value)}
                  className="bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm"
                >
                  {meetingsCollapsed ? "Rozwiń" : "Zwiń"}
                </button>
              </div>
            </div>

            {meetingsCollapsed ? null : loadingMeetings ? (
              <p className="text-sm text-slate-400">Ładowanie spotkań...</p>
            ) : meetings.length === 0 ? (
              <p className="text-sm text-slate-400">Brak zaplanowanych spotkań.</p>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                {visibleMeetings.map((meeting) => {
                  const meetingDate = new Date(meeting.meeting_at);

                  return (
                    <div
                      key={meeting.id}
                      className="flex h-full min-h-[120px] flex-col justify-between border border-slate-200 rounded-2xl bg-slate-50 p-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-bold text-slate-900 leading-snug"
                              title={meeting.client_name}
                            >
                              {shortenText(meeting.client_name, 32)}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-purple-700">
                              {meetingDate.toLocaleDateString("pl-PL")} · {meetingDate.toLocaleTimeString("pl-PL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                            Spotkanie
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                              Adres spotkania
                            </p>

                            <p className="truncate font-medium text-slate-700">
                              {meeting.meeting_address}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                              Opiekun
                            </p>

                            <p
                              className="max-w-[90px] truncate font-semibold text-slate-900"
                              title={meeting.owner_name}
                            >
                              {shortenText(meeting.owner_name, 14)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => openClientFromFollowUp(meeting.client_id)}
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                        >
                          Otwórz klienta
                        </button>

                        <button
                          type="button"
                          onClick={() => router.push(`/event/${meeting.id}`)}
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white font-medium"
                        >
                          Przejdź do spotkania
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!meetingsCollapsed && meetings.length > 3 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {!calendarExpanded && (
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarExpanded(true);
                      setCalendarShowMore(false);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                  >
                    Pokaż 6 spotkań
                  </button>
                )}

                {calendarExpanded && !calendarShowMore && meetings.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setCalendarShowMore(true)}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                  >
                    Pokaż więcej
                  </button>
                )}

                {(calendarExpanded || calendarShowMore) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarExpanded(false);
                      setCalendarShowMore(false);
                      scrollToWidget(meetingsRef);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                  >
                    Pokaż mniej
                  </button>
                )}
                </div>
            )}
          </div>

            <div className="self-start bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold">Podsumowanie sprzedaży</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    {salesSummaryMode === "team"
  ? currentUserRole === "manager"
    ? "Konwersja spotkań i marża zespołu managera w tym miesiącu."
    : "Konwersja spotkań i marża całej firmy w tym miesiącu."
  : "Konwersja spotkań i marża doradcy w tym miesiącu."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!salesSummaryCollapsed && canViewCompanySalesSummary && (
                    <div className="flex rounded-xl border border-emerald-200 bg-emerald-50 p-1">
                      <button
                        type="button"
                        onClick={() => setSalesSummaryMode("mine")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          salesSummaryMode === "mine"
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "text-emerald-700 hover:bg-white"
                        }`}
                      >
                        Moje wyniki
                      </button>

                      <button
                        type="button"
                        onClick={() => setSalesSummaryMode("team")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          salesSummaryMode === "team"
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "text-emerald-700 hover:bg-white"
                        }`}
                      >
                        {currentUserRole === "manager"
  ? "Wyniki zespołu"
  : "Wyniki firmy"}
                      </button>
                    </div>
                  )}

                  {!salesSummaryCollapsed && (
                    <button
                      type="button"
                      onClick={loadSalesSummary}
                      className="bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs"
                    >
                      Odśwież
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSalesSummaryCollapsed((value) => !value)}
                    className="bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs"
                  >
                    {salesSummaryCollapsed ? "Rozwiń" : "Zwiń"}
                  </button>
                </div>
              </div>

              {salesSummaryCollapsed ? null : loadingSalesSummary ? (
                <p className="text-sm text-slate-400">Ładowanie podsumowania...</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex flex-1 items-center justify-center">
                    <div className="relative h-32 w-32 shrink-0">
                      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r={salesSummaryCircleRadius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          className="text-slate-200"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r={salesSummaryCircleRadius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={salesSummaryCircleCircumference}
                          strokeDashoffset={salesSummaryCircleOffset}
                          className="text-emerald-500 transition-all"
                        />
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-3xl font-black text-slate-900">
                          {salesSummary.conversionRate}%
                        </p>
                        <p className="text-xs text-slate-500">konwersji</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-36 shrink-0 grid-cols-1 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500 leading-tight">Odbyte spotkania</p>
                      <p className="text-lg font-bold text-slate-900 leading-tight mt-1">
                        {salesSummary.closedMeetingsCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] text-emerald-700 leading-tight">Sprzedaże</p>
                      <p className="text-lg font-bold text-emerald-900 leading-tight mt-1">
                        {salesSummary.meetingsWithSalesCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {salesSummaryMode === "team"
                          ? currentUserRole === "manager"
                            ? "Marża zespołu"
                            : "Marża firmy"
                          : "Zarobek"}
                      </p>
                      <p className="text-lg font-black text-slate-900 leading-tight mt-1">
                        {salesSummary.monthlySellerMargin.toLocaleString("pl-PL", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} zł
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={followUpsRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 scroll-mt-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Przypomnienia</h2>

                <p className="text-slate-500 text-sm mt-1">
                  Kontakty, które wymagają ponownego działania.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!followUpsCollapsed && (
                  <button
                    type="button"
                    onClick={loadFollowUps}
                    className="bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm"
                  >
                    Odśwież
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setFollowUpsCollapsed((value) => !value)}
                  className="bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm"
                >
                  {followUpsCollapsed ? "Rozwiń" : "Zwiń"}
                </button>
              </div>
            </div>

            {followUpsCollapsed ? null : loadingFollowUps ? (
              <p className="text-sm text-slate-400"> Ładowanie przypomnień...</p>
            ) : followUps.length === 0 ? (
              <p className="text-sm text-slate-400">Brak aktywnych przypomnień.</p>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {["Zaległe", "Dzisiaj", "Jutro", "Później"].map((group) => {
                  const groupItems = visibleFollowUps.filter(
                    (followUp) => getFollowUpGroup(followUp.follow_up_at) === group
                  );
                  const isEmptyOverdueGroup = group === "Zaległe" && groupItems.length === 0;

                  return (
                    <div
                      key={group}
                      className={`rounded-2xl border p-4 ${
                        group === "Zaległe" && !isEmptyOverdueGroup
                          ? "border-red-200 bg-red-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <h3 className="font-bold mb-4">
                        {group} ({groupItems.length})
                      </h3>

                      {groupItems.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          {group === "Zaległe"
                            ? "Brak zaległych zadań, Kasia byłaby dumna 🙂"
                            : "Brak zadań."}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {groupItems.map((followUp) => (
                            <div
                              key={followUp.id}
                              className={`rounded-xl border p-3 ${
                                group === "Zaległe"
                                  ? "border-red-200 bg-white"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <p className="font-semibold text-sm">
                                {followUp.client_name}
                              </p>

                              <p className="text-xs text-slate-400 mt-1">
                                {new Date(followUp.follow_up_at).toLocaleString(
                                  "pl-PL"
                                )}
                              </p>

                              <p className="text-sm text-slate-700 mt-3">
                                {followUp.title}
                              </p>

                              {followUp.description && (
                                <p className="text-xs text-slate-500 mt-2 line-clamp-3">
                                  {followUp.description}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2 mt-4">
                                <button
                                  type="button"
                                  onClick={() => openClientFromFollowUp(followUp.client_id)}
                                  className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                                >
                                  Otwórz klienta
                                </button>

                                <button
                                  type="button"
                                  onClick={() => startResolvingFollowUp(followUp)}
                                  className="text-xs px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium"
                                >
                                  Wykonano
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!followUpsCollapsed && followUps.length > 8 && (
              <div className="flex justify-center gap-2 mt-4">
                {visibleFollowUpsCount < followUps.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleFollowUpsCount((count) => count + 8)}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                  >
                    Pokaż kolejne przypomnienia
                  </button>
                )}

                {visibleFollowUpsCount > 8 && (
                  <button
                    type="button"
                   onClick={() => {
  setVisibleFollowUpsCount(3);
  scrollToWidget(followUpsRef);
}}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                  >
                    Pokaż mniej
                  </button>
                )}
              </div>
            )}
          </div>
          <div ref={clientsRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 scroll-mt-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Klienci CRM</h2>

                <p className="text-slate-500 text-sm mt-1">
                  Lista klientów przypisanych do użytkownika.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!clientsCollapsed && (
                  <button
                    type="button"
                    onClick={() => router.push("/clients?addClient=1")}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl px-4 py-2 shadow-sm text-sm"
                  >
                    + Dodaj klienta
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setClientsCollapsed((value) => !value)}
                  className="bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm"
                >
                  {clientsCollapsed ? "Rozwiń" : "Zwiń"}
                </button>
              </div>
            </div>

            {clientsCollapsed ? null : (
              <>
                <ClientsTable
                  clients={visibleClients}
                  loadingClients={loadingClients}
                  selectedClient={selectedClient}
                  onSelectClient={setSelectedClient}
                  onCloseClient={() => setSelectedClient(null)}
                />
                

                {clients.length > 10 && (
                  <div className="flex justify-center gap-2 mt-4">
                    {visibleClientsCount < clients.length && (
                      <button
                        type="button"
                        onClick={() => setVisibleClientsCount((count) => count + 10)}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                      >
                        Pokaż kolejnych klientów
                      </button>
                    )}

                    {visibleClientsCount > 10 && (
                      <button
                        type="button"
                        onClick={() => {
                          setVisibleClientsCount(10);
                          scrollToWidget(clientsRef);
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                      >
                        Pokaż mniej
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

        </section>
      </div>

      {resolvingFollowUp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Rezultat kontaktu</h2>

                <p className="text-sm text-slate-500 mt-1">
                  {resolvingFollowUp.client_name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeResolutionModal}
                className="text-slate-400 hover:text-slate-700 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <select
                value={resolutionStatus}
                onChange={(event) => setResolutionStatus(event.target.value as ResolutionStatus)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                {resolutionStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              {needsNextFollowUp(resolutionStatus) && (
                <DateTimePicker
                  label="Data ponownego kontaktu"
                  value={resolutionFollowUpAt}
                  onChange={setResolutionFollowUpAt}
                />
              )}

              {needsMeeting(resolutionStatus) && (
                <DateTimePicker
                  label="Data i godzina spotkania"
                  value={resolutionMeetingAt}
                  onChange={setResolutionMeetingAt}
                />
              )}

              <textarea
                placeholder="Opis kontaktu..."
                value={resolutionDescription}
                onChange={(event) => setResolutionDescription(event.target.value)}
                className="w-full min-h-[120px] rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 resize-none"
              />
            </div>

            {resolutionError && (
              <p className="text-sm text-red-500 mt-4">{resolutionError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeResolutionModal}
                className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={resolveFollowUp}
                disabled={savingResolution}
                className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold disabled:opacity-50"
              >
                {savingResolution ? "Zapisywanie..." : "Zapisz rezultat"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
} 