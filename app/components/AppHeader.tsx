"use client";

import Link from "next/link";
// ...no change above
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type AppHeaderProps = {
  currentUser?: {
    email?: string;
    user_metadata?: {
      display_name?: string;
    };
  } | null;
};

const navItems = [
  { href: "/", label: "Pulpit" },
  { href: "/calendar", label: "Kalendarz" },
  { href: "/clients", label: "Kontakty" },
  { href: "/tasks", label: "Zadania" },
  { href: "/sales", label: "Sprzedaże" },
  { href: "/reports", label: "Raporty" },
  { href: "/calculator", label: "Kalkulator" },
];

const roleLabels: Record<string, string> = {
  owner: "Właściciel",
  admin: "Administrator",
  manager: "Manager",
  cc: "Konsultant CC",
  seller: "Doradca Techniczny",
};

type ThemeMode = "light" | "dark" | "auto";

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Dzień" },
  { value: "dark", label: "Noc" },
  { value: "auto", label: "Auto" },
];


type HeaderProfile = {
  id: string;
  user_number: number | null;
  email: string | null;
  display_name: string | null;
  role: string | null;
};

type SearchResult = {
  id: string;
  type: "client" | "sale";
  public_id: string | null;
  title: string;
  subtitle: string | null;
};

type HeaderNotification = {
  id: string;
  title: string;
  body: string | null;
  client_id: string | null;
  is_read: boolean;
  created_at: string;
};


type InfobarItem = {
  id: string;
  message: string;
  backgroundColor: string;
  textColor: string;
  dismissible: boolean;
  priority: number;
  linkUrl: string | null;
};

type InfobarRow = {
  id: string;
  message: string;
  color: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
  dismissible: boolean | null;
  priority: number | null;
  link_url: string | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type SearchableClient = {
  id: string;
  public_id?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  postal_code?: string | null;
  street?: string | null;
  building_number?: string | null;
  address?: string | null;
  assigned_user_id?: string | null;
  [key: string]: unknown;
};

type SearchableSale = {
  id: string;
  public_id?: string | null;
  sale_id?: string | null;
  sale_number?: string | number | null;
  contract_number?: string | null;
  client_id?: string | null;
  event_id?: string | null;
  [key: string]: unknown;
};

function normalizeSearchValue(value: unknown) {
  if (value === null || value === undefined) return "";

  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRecordSearchText(record: Record<string, unknown>) {
  return Object.values(record)
    .map((value) => normalizeSearchValue(value))
    .join(" ");
}

function getRecordSearchDigits(record: Record<string, unknown>) {
  return Object.values(record)
    .map((value) => String(value ?? ""))
    .join(" ")
    .replace(/\D/g, "");
}

function pickFirstString(...values: unknown[]) {
  const value = values.find(
    (item) => item !== null && item !== undefined && String(item).trim() !== ""
  );

  return value ? String(value) : null;
}

function getReadableTextColor(backgroundColor: string) {
  const hex = backgroundColor.replace("#", "").trim();

  if (hex.length !== 6) return "#ffffff";

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 150 ? "#111827" : "#ffffff";
}

function isInfobarActiveNow(infobar: InfobarRow) {
  if (!infobar.is_active) return false;

  const now = Date.now();
  const startsAt = infobar.starts_at ? new Date(infobar.starts_at).getTime() : null;
  const endsAt = infobar.ends_at ? new Date(infobar.ends_at).getTime() : null;

  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;

  return true;
}

function normalizeInfobar(row: InfobarRow): InfobarItem {
  const backgroundColor = row.color || "#dc2626";

  return {
    id: row.id,
    message: row.message,
    backgroundColor,
    textColor: getReadableTextColor(backgroundColor),
    dismissible: row.dismissible !== false,
    priority: row.priority || 1,
    linkUrl: row.link_url || null,
  };
}

export default function AppHeader({ currentUser }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [toastNotification, setToastNotification] = useState<HeaderNotification | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState(false);
  const [isSafariBrowser, setIsSafariBrowser] = useState(false);
  const [infobars, setInfobars] = useState<InfobarItem[]>([]);
  const [closedInfobarIds, setClosedInfobarIds] = useState<string[]>([]);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsLoadedRef = useRef(false);
  const lastNotificationSoundRef = useRef<number>(0);

  const trimmedSearch = useMemo(() => searchQuery.trim(), [searchQuery]);

  const visibleInfobars = infobars.filter(
    (infobar) => !closedInfobarIds.includes(infobar.id)
  );

  const unreadNotificationsCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const activeThemeLabel =
    themeOptions.find((option) => option.value === themeMode)?.label || "Auto";

  function applyThemeMode(mode: ThemeMode) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = mode === "dark" || (mode === "auto" && prefersDark);

    document.documentElement.classList.toggle("dark", shouldUseDark);
    document.documentElement.dataset.theme = mode;
  }

  function changeThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    window.localStorage.setItem("ideasol_theme", mode);
    applyThemeMode(mode);
  }

  function cycleThemeMode() {
    const nextTheme: ThemeMode =
      themeMode === "light" ? "dark" : themeMode === "dark" ? "auto" : "light";

    changeThemeMode(nextTheme);
  }
  useEffect(() => {
    try {
      const savedClosedInfobarIds = window.localStorage.getItem(
        "ideasol_closed_infobars"
      );

      setClosedInfobarIds(
        savedClosedInfobarIds ? JSON.parse(savedClosedInfobarIds) : []
      );
    } catch (error) {
      console.error("Błąd odczytu zamkniętych infobarów:", error);
      setClosedInfobarIds([]);
    }
  }, []);

  useEffect(() => {
    const profileId = profile?.id;

    if (!profileId) {
      setInfobars([]);
      return;
    }

    let active = true;

    async function loadInfobars() {
      const { data: infobarData, error: infobarError } = await supabase
        .from("admin_infobars")
        .select("id, message, color, starts_at, ends_at, is_active, dismissible, priority, link_url")
        .eq("is_active", true)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(5);

      if (infobarError) {
        console.error("Błąd ładowania infobarów:", infobarError);
        return;
      }

      const { data: dismissalsData, error: dismissalsError } = await supabase
        .from("admin_infobar_dismissals")
        .select("infobar_id")
        .eq("user_id", profileId);

      if (dismissalsError) {
        console.error("Błąd ładowania zamkniętych infobarów:", dismissalsError);
      }

      if (!active) return;

      const dismissedIds = (dismissalsData || [])
        .map((dismissal: { infobar_id: string | null }) => dismissal.infobar_id)
        .filter(Boolean) as string[];

      setClosedInfobarIds((current) => {
        const nextClosedInfobarIds = Array.from(new Set([...current, ...dismissedIds]));
        window.localStorage.setItem(
          "ideasol_closed_infobars",
          JSON.stringify(nextClosedInfobarIds)
        );

        return nextClosedInfobarIds;
      });

      const normalizedInfobars = ((infobarData || []) as InfobarRow[])
        .filter(isInfobarActiveNow)
        .map(normalizeInfobar)
        .sort((first, second) => first.priority - second.priority);

      setInfobars(normalizedInfobars);
    }

    loadInfobars();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  async function closeInfobar(infobarId: string) {
    setClosedInfobarIds((current) => {
      const nextClosedInfobarIds = Array.from(new Set([...current, infobarId]));
      window.localStorage.setItem(
        "ideasol_closed_infobars",
        JSON.stringify(nextClosedInfobarIds)
      );

      return nextClosedInfobarIds;
    });

    if (!profile?.id) return;

    const { error } = await supabase.from("admin_infobar_dismissals").upsert(
      {
        infobar_id: infobarId,
        user_id: profile.id,
      },
      {
        onConflict: "infobar_id,user_id",
      }
    );

    if (error) {
      console.error("Błąd zapisu zamknięcia infobara:", error);
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ideasol_theme");
    const initialTheme: ThemeMode =
      savedTheme === "light" || savedTheme === "dark" || savedTheme === "auto"
        ? savedTheme
        : "auto";

    setThemeMode(initialTheme);
    applyThemeMode(initialTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const currentTheme = window.localStorage.getItem("ideasol_theme") || "auto";

      if (currentTheme === "auto") {
        applyThemeMode("auto");
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    function updateInstalledState() {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

      setIsInstalledPwa(isStandalone);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalledPwa(true);
      setInstallPromptEvent(null);
    }

    updateInstalledState();

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsSafariBrowser(
      userAgent.includes("safari") &&
        !userAgent.includes("chrome") &&
        !userAgent.includes("chromium") &&
        !userAgent.includes("crios") &&
        !userAgent.includes("edg") &&
        !userAgent.includes("android")
    );

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installOfflineCalculator() {
    if (!installPromptEvent) {
      router.push("/calculator-app?install=1");
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice.catch(() => null);

    if (choice?.outcome === "accepted") {
      setIsInstalledPwa(true);
    }

    setInstallPromptEvent(null);
  }

  function playNotificationSound() {
    try {
      const now = Date.now();

      if (now - lastNotificationSoundRef.current < 1500) return;
      lastNotificationSoundRef.current = now;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        660,
        audioContext.currentTime + 0.12
      );

      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);

      window.setTimeout(() => {
        audioContext.close().catch(() => undefined);
      }, 350);
    } catch (error) {
      console.warn("Nie udało się odtworzyć dźwięku powiadomienia:", error);
    }
  }

  function showToast(notification: HeaderNotification) {
    setToastNotification(notification);
    playNotificationSound();

    window.setTimeout(() => {
      setToastNotification((current) =>
        current?.id === notification.id ? null : current
      );
    }, 8000);
  }


  useEffect(() => {
    const profileId = profile?.id;

    if (!profileId) return;

    let active = true;

    async function loadNotifications() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, client_id, is_read, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Błąd ładowania powiadomień w headerze:", error);
        return;
      }

      if (!active) return;

      const loadedNotifications = (data || []) as HeaderNotification[];
      const newestUnseenUnreadNotification = loadedNotifications.find(
        (notification) =>
          !notification.is_read &&
          notificationsLoadedRef.current &&
          !knownNotificationIdsRef.current.has(notification.id)
      );

      knownNotificationIdsRef.current = new Set(
        loadedNotifications.map((notification) => notification.id)
      );
      notificationsLoadedRef.current = true;

      setNotifications(loadedNotifications);

      if (newestUnseenUnreadNotification) {
        showToast(newestUnseenUnreadNotification);
      }
    }

    loadNotifications();

    const notificationsRefreshInterval = window.setInterval(() => {
      loadNotifications();
    }, 60000);

    async function handleNotificationsRefresh() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, client_id, is_read, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (
        !error &&
        data?.[0] &&
        !data[0].is_read &&
        !knownNotificationIdsRef.current.has(data[0].id)
      ) {
        showToast(data[0] as HeaderNotification);
      }

      loadNotifications();
    }

    window.addEventListener("ideasol-notifications-refresh", handleNotificationsRefresh);


    return () => {
      active = false;
      window.clearInterval(notificationsRefreshInterval);
      window.removeEventListener("ideasol-notifications-refresh", handleNotificationsRefresh);
    };
  }, [profile?.id]);

  useEffect(() => {
    async function searchCRM() {
      if (trimmedSearch.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      if (!profile?.id) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      setSearching(true);
      setSearchError(null);

      const searchValue = normalizeSearchValue(trimmedSearch);
      const searchDigits = trimmedSearch.replace(/\D/g, "");
      const normalizedRole = String(profile.role || "seller").toLowerCase();
      const canViewAllClients = ["owner", "admin", "cc"].includes(normalizedRole);
      let allowedAssignedUserIds: string[] | null = null;

      if (!canViewAllClients) {
        if (normalizedRole === "manager") {
          const { data: teamMembers, error: teamError } = await supabase
            .from("profiles")
            .select("id")
            .eq("manager_id", profile.id);

          if (teamError) {
            console.error("Błąd ładowania zespołu managera w wyszukiwarce:", teamError);
          }

          allowedAssignedUserIds = [
            profile.id,
            ...((teamMembers || []).map((member: { id: string }) => member.id)),
          ];
        } else {
          allowedAssignedUserIds = [profile.id];
        }
      }

      const clientsSelectColumns =
        "id, full_name, company_name, email, phone, city, postal_code, address, assigned_user_id";

      let clientsQuery = supabase
        .from("clients")
        .select(clientsSelectColumns)
        .limit(2000);

      if (!canViewAllClients) {
        if (!allowedAssignedUserIds || allowedAssignedUserIds.length === 0) {
          clientsQuery = clientsQuery.eq("assigned_user_id", "__no_user__");
        } else {
          clientsQuery = clientsQuery.in("assigned_user_id", allowedAssignedUserIds);
        }
      }

      const clientsResponse = await clientsQuery;

      if (clientsResponse.error) {
        console.error("Błąd wyszukiwania CRM:", {
          message: clientsResponse.error.message,
          details: clientsResponse.error.details,
          hint: clientsResponse.error.hint,
          code: clientsResponse.error.code,
        });

        setSearchError("Nie udało się wykonać wyszukiwania.");
        setSearchResults([]);
        setSearching(false);
        return;
      }

      const rawClients = (clientsResponse.data || []) as SearchableClient[];
      const scopedClients = canViewAllClients
        ? rawClients
        : rawClients.filter(
            (client) =>
              !!client.assigned_user_id &&
              !!allowedAssignedUserIds?.includes(client.assigned_user_id)
          );

      const accessibleClientIds = scopedClients.map((client) => client.id);
      let salesData: SearchableSale[] = [];

      if (canViewAllClients || accessibleClientIds.length > 0) {
        const salesSelectVariants = [
          "id, public_id, sale_id, sale_number, contract_number, client_id, event_id",
          "id, public_id, sale_id, sale_number, client_id, event_id",
          "id, public_id, client_id, event_id",
          "id, client_id, event_id",
          "id, client_id",
        ];

          for (const salesSelectColumns of salesSelectVariants) {
            let salesQuery = supabase
              .from("sales")
              .select(salesSelectColumns)
              .limit(1000);

            if (!canViewAllClients) {
              salesQuery = salesQuery.in("client_id", accessibleClientIds.slice(0, 2000));
            }

            const salesResponse = await salesQuery;

            if (!salesResponse.error) {
              salesData = (salesResponse.data || []) as unknown as SearchableSale[];
              break;
            }
          }
      }

      const clientResults: SearchResult[] = scopedClients
        .filter((client) => {
          const searchableText = getRecordSearchText(client);
          const searchableDigits = getRecordSearchDigits(client);

          return (
            searchableText.includes(searchValue) ||
            (searchDigits.length >= 3 && searchableDigits.includes(searchDigits))
          );
        })
        .slice(0, 8)
        .map((client) => ({
          id: client.id,
          type: "client",
          public_id: pickFirstString(client.public_id) || null,
          title: client.company_name || client.full_name || "Klient",
          subtitle:
            [
              client.email,
              client.phone,
              [client.postal_code, client.city].filter(Boolean).join(" "),
            ]
              .filter(Boolean)
              .join(" • ") ||
            pickFirstString(client.public_id) ||
            null,
        }));

      const saleResults: SearchResult[] = salesData
        .filter((sale) => {
          const searchableText = getRecordSearchText(sale);
          const searchableDigits = getRecordSearchDigits(sale);

          return (
            searchableText.includes(searchValue) ||
            (searchDigits.length >= 3 && searchableDigits.includes(searchDigits))
          );
        })
        .slice(0, 8)
        .map((sale) => {
          const salePublicId = pickFirstString(
            sale.public_id,
            sale.sale_id,
            sale.sale_number,
            sale.contract_number
          );

          return {
            id: sale.id,
            type: "sale",
            public_id: salePublicId,
            title: salePublicId || "Sprzedaż",
            subtitle: "Karta sprzedaży",
          };
        });

      setSearchResults([...clientResults, ...saleResults]);
      setSearching(false);
    }

    const timeout = setTimeout(() => {
      searchCRM();
    }, 250);

    return () => clearTimeout(timeout);
  }, [trimmedSearch, profile?.id, profile?.role]);

  function openSearchResult(result: SearchResult) {
    setSearchQuery("");
    setShowResults(false);
    setMobileMenuOpen(false);

    if (result.type === "sale") {
      router.push(`/sales/${result.id}`);
      return;
    }

    router.push(`/clients/${result.id}`);
  }

  async function markNotificationAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (error) {
      console.error("Błąd oznaczania powiadomienia jako przeczytane:", error);
    }
  }

  async function markAllNotificationsAsRead() {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, is_read: true }))
    );

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .in("id", unreadIds);

    if (error) {
      console.error("Błąd oznaczania wszystkich powiadomień:", error);
    }
  }

  async function clearNotifications() {
    const notificationIds = notifications.map((notification) => notification.id);

    if (notificationIds.length === 0) return;

    const previousNotifications = notifications;

    setNotifications([]);
    setToastNotification(null);
    setNotificationsOpen(false);
    setMobileNotificationsOpen(false);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", notificationIds);

    if (error) {
      console.error("Błąd czyszczenia powiadomień:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      setNotifications(previousNotifications);
      alert("Nie udało się wyczyścić powiadomień. Sprawdź uprawnienia RLS dla tabeli notifications.");
    }
  }

  function openNotification(notification: HeaderNotification) {
    markNotificationAsRead(notification.id);
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
    setMobileNotificationsOpen(false);
    setToastNotification(null);

    if (notification.client_id) {
      router.push(`/clients/${notification.client_id}`);
    }
  }

  async function logout() {
    setMobileMenuOpen(false);
    await supabase.auth.signOut({ scope: "global" });

    try {
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("sb-") ||
          key.includes("supabase") ||
          key.includes("ideasol-crm-auth")
        ) {
          localStorage.removeItem(key);
        }
      });

      Object.keys(sessionStorage).forEach((key) => {
        if (
          key.startsWith("sb-") ||
          key.includes("supabase") ||
          key.includes("ideasol-crm-auth")
        ) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Błąd czyszczenia danych sesji:", error);
    }

    setProfile(null);
    setAuthChecked(true);
    window.location.replace("/");
  }


  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Błąd sprawdzania sesji w headerze:", sessionError);
          setProfile(null);
          return;
        }

        if (!session?.user) {
          setProfile(null);

          if (window.location.pathname !== "/") {
            window.location.replace("/");
          }

          return;
        }


        let { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, user_number, display_name, role, email")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!profileData && session.user.email) {
          const fallbackResponse = await supabase
            .from("profiles")
            .select("id, user_number, display_name, role, email")
            .eq("email", session.user.email)
            .maybeSingle();

          profileData = fallbackResponse.data;
          profileError = fallbackResponse.error;
        }

        if (profileError) {
          console.error("Błąd ładowania profilu w headerze:", profileError);
        }

        setProfile(
          profileData
            ? {
                ...(profileData as Omit<HeaderProfile, "email">),
                email: session.user.email || null,
              }
            : {
                id: session.user.id,
                user_number: null,
                email: session.user.email || null,
                display_name:
                  session.user.user_metadata?.display_name ||
                  session.user.email ||
                  null,
                role:
                  session.user.user_metadata?.role || null,
              }
        );
      } catch (error) {
        console.error("Nieoczekiwany błąd ładowania profilu w headerze:", error);
        setProfile(null);

        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }
      } finally {
        setAuthChecked(true);
      }
    }

    loadProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setAuthChecked(true);

        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }

        return;
      }

      loadProfile();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

const canManageUsers = profile?.role === "admin";

  return (
    <>
      {visibleInfobars.length > 0 && (
        <div className="fixed left-0 right-0 top-0 z-[10000] shadow-lg">
          {visibleInfobars.map((infobar) => (
            <div
              key={infobar.id}
              className="border-b border-black/10 px-4 py-3"
              style={{
                backgroundColor: infobar.backgroundColor,
                color: infobar.textColor,
              }}
            >
              <div className="mx-auto flex max-w-7xl items-start justify-between gap-3">
                {infobar.linkUrl ? (
                  <a
                    href={infobar.linkUrl}
                    target={infobar.linkUrl.startsWith("http") ? "_blank" : undefined}
                    rel={infobar.linkUrl.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-sm font-bold leading-snug underline-offset-4 transition hover:underline sm:text-base"
                  >
                    {infobar.message}
                  </a>
                ) : (
                  <p className="text-sm font-bold leading-snug sm:text-base">
                    {infobar.message}
                  </p>
                )}

                {infobar.dismissible && (
                  <button
                    type="button"
                    onClick={() => closeInfobar(infobar.id)}
                    className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 transition hover:bg-black/35"
                    aria-label="Zamknij komunikat"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <header className={`mb-8 text-slate-900 lg:mb-10 ${visibleInfobars.length > 0 ? "pt-24 sm:pt-16" : ""}`}>
      <div className="flex items-start justify-between gap-4 lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="IdeaSol CRM"
              className="h-14 w-auto sm:h-[72px]"
            />

            <span className="text-base font-bold text-slate-900 sm:text-lg">CRM</span>
          </div>

          {authChecked && profile && (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                <span className="truncate max-w-[220px] sm:max-w-none">
                  Witaj, {profile.display_name || profile.email}
                </span>

                {profile.role && (
                  <span className="text-slate-400">
                    • {roleLabels[profile.role] || profile.role}
                  </span>
                )}

                {profile.user_number && (
                  <span className="text-slate-400">
                    • UID #{profile.user_number}
                  </span>
                )}
              </p>

              {installPromptEvent && !isInstalledPwa && (
                <button
                  type="button"
                  onClick={installOfflineCalculator}
                  className="mt-1 inline-block text-left text-[10px] font-semibold text-emerald-700 transition hover:text-emerald-600 hover:underline sm:text-[11px]"
                >
                  Zainstaluj kalkulator offline na swój pulpit ⬇
                </button>
              )}

              {!installPromptEvent && !isInstalledPwa && isSafariBrowser && (
                <Link
                  href="/calculator-app?install=1"
                  className="mt-1 inline-block text-[10px] font-semibold text-slate-500 transition hover:text-slate-700 hover:underline sm:text-[11px]"
                >
                  Jak zainstalować kalkulator offline w Safari? ⬇
                </Link>
              )}
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-start justify-end gap-2 lg:items-center">
          <div
            className="group relative hidden h-12 w-12 shrink-0 sm:block"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setShowResults(false);
                setSearchQuery("");
              }
            }}
          >
            <div className="absolute right-0 top-0 h-12 w-12 overflow-visible transition-all duration-300 ease-out group-hover:-right-3 group-hover:w-[min(320px,calc(100vw-2rem))] group-focus-within:-right-3 group-focus-within:w-[min(320px,calc(100vw-2rem))]">
              <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center text-slate-500 transition-colors group-hover:text-emerald-500 group-focus-within:text-emerald-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Szukaj klienta, SaleID, LeadID, telefonu..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 shadow-sm transition-all duration-300 ease-out placeholder:text-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 group-hover:placeholder:text-slate-400 group-focus-within:placeholder:text-slate-400"
              />

              {showResults && trimmedSearch.length >= 2 && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
                  {searching ? (
                    <div className="px-4 py-4 text-sm text-slate-500">
                      Wyszukiwanie...
                    </div>
                  ) : searchError ? (
                    <div className="px-4 py-4 text-sm text-red-600">
                      {searchError}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-500">
                      Brak wyników.
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            openSearchResult(result);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {result.title}
                              </p>

                              {result.subtitle && (
                                <p className="text-xs text-slate-500 truncate mt-1">
                                  {result.subtitle}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <span
                                className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                                  result.type === "sale"
                                    ? "bg-emerald-100 text-emerald-900"
                                    : "bg-sky-100 text-sky-900"
                                }`}
                              >
                                {result.type === "sale" ? "Sprzedaż" : "Klient"}
                              </span>

                              {result.public_id && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {result.public_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-expanded={mobileMenuOpen}
            aria-label="Menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>


          <nav className="ml-3 hidden h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm lg:flex">
            {navItems.map((item) => {
              const isExternal = "external" in item && item.external;

              const isActive =
                !isExternal &&
                (item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href));

              return isExternal ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-500 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={cycleThemeMode}
              title={`Motyw: ${activeThemeLabel}. Kliknij, aby zmienić.`}
              aria-label={`Motyw: ${activeThemeLabel}. Kliknij, aby zmienić.`}
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="text-base leading-none">
                {themeMode === "light" ? "☀️" : themeMode === "dark" ? "🌙" : "◐"}
              </span>
            </button>

            <a
              href="https://outlook.cloud.microsoft/mail/"
              target="_blank"
              rel="noopener noreferrer"
              title="Poczta"
              aria-label="Poczta"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </a>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                title="Powiadomienia"
                aria-label="Powiadomienia"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>

                {unreadNotificationsCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Powiadomienia</p>
                      <p className="text-xs text-slate-500">
                        {unreadNotificationsCount} nieprzeczytane
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsAsRead}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                        >
                          Oznacz wszystkie
                        </button>
                      )}

                      {notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={clearNotifications}
                          className="text-xs font-semibold text-red-600 hover:text-red-500"
                        >
                          Wyczyść
                        </button>
                      )}
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-slate-500">
                      Brak powiadomień.
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => openNotification(notification)}
                          className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                            notification.is_read ? "bg-white" : "bg-emerald-50/70"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                notification.is_read ? "bg-slate-200" : "bg-emerald-500"
                              }`}
                            />

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900">
                                {notification.title}
                              </p>
                              {notification.body && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {notification.body}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                onMouseEnter={() => setProfileMenuOpen(true)}
                title="Profil"
                aria-label="Profil"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {profileMenuOpen && (
                <div
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900"
                  onMouseEnter={() => setProfileMenuOpen(true)}
                  onMouseLeave={() => setProfileMenuOpen(false)}
                >
                  <Link
                    href="/settings"
                    className="block px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Ustawienia
                  </Link>
                  {canManageUsers && (
                    <Link
                      href="/admin/users"
                      className="block px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Panel administratora
                    </Link>
                  )}

                </div>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              title="Wyloguj"
              aria-label="Wyloguj"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-red-50 hover:text-red-600"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </nav>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
          <div className="relative mb-3">
            <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center text-slate-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Szukaj klienta, SaleID, LeadID, telefonu..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {showResults && trimmedSearch.length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-900">
                {searching ? (
                  <div className="px-4 py-4 text-sm text-slate-500">
                    Wyszukiwanie...
                  </div>
                ) : searchError ? (
                  <div className="px-4 py-4 text-sm text-red-600">
                    {searchError}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-500">
                    Brak wyników.
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={`mobile-${result.type}-${result.id}`}
                        type="button"
                        onClick={() => openSearchResult(result)}
                        className="w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {result.title}
                            </p>

                            {result.subtitle && (
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {result.subtitle}
                              </p>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                              result.type === "sale"
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-sky-100 text-sky-900"
                            }`}
                          >
                            {result.type === "sale" ? "Sprzedaż" : "Klient"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="grid gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                    isActive
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}



            <a
              href="https://outlook.cloud.microsoft/mail/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Poczta
            </a>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Motyw
              </p>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => {
                  const isSelected = themeMode === option.value;

                  return (
                    <button
                      key={`mobile-theme-${option.value}`}
                      type="button"
                      onClick={() => changeThemeMode(option.value)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                        isSelected
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => setMobileNotificationsOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-sm font-bold text-slate-700">
                  Powiadomienia
                </span>

                <span className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      {unreadNotificationsCount}
                    </span>
                  )}

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 text-slate-500 transition ${mobileNotificationsOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>

              {mobileNotificationsOpen && (
                notifications.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">Brak powiadomień.</p>
                ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 3).map((notification) => (
                    <button
                      key={`mobile-notification-${notification.id}`}
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                        notification.is_read
                          ? "bg-white text-slate-600"
                          : "bg-emerald-50 text-slate-800"
                      }`}
                    >
                      <span className="font-bold">{notification.title}</span>
                      {notification.body && (
                        <span className="mt-1 block text-slate-500">
                          {notification.body}
                        </span>
                      )}
                    </button>
                  ))}

                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsAsRead}
                      className="w-full rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700"
                    >
                      Oznacz wszystkie jako przeczytane
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="w-full rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                    >
                      Wyczyść powiadomienia
                    </button>
                  )}
                </div>
                )
              )}
            </div>
            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Ustawienia
            </Link>
            {canManageUsers && (
              <Link
                href="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Panel administratora
              </Link>
            )}

            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-100"
            >
              Wyloguj
            </button>
          </nav>
        </div>
      )}
      {toastNotification && (
        <button
          type="button"
          onClick={() => openNotification(toastNotification)}
          className="fixed bottom-4 right-4 z-[9999] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-sky-400/70 bg-slate-950/90 p-4 text-left shadow-2xl shadow-sky-900/30 backdrop-blur transition hover:scale-[1.01] hover:bg-slate-950 sm:right-6"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">
                {toastNotification.title}
              </p>
              {toastNotification.body && (
                <p className="mt-1 text-sm text-slate-300">
                  {toastNotification.body}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold text-sky-300">
                Kliknij, aby otworzyć kontakt
              </p>
            </div>
          </div>
        </button>
      )}
      </header>
    </>
  );
}