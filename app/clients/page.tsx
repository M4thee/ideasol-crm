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
  assigned_user_id: string | null;
  assigned_user?: {
    id: string;
    display_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
  created_at: string;
};

type UserRole = "owner" | "admin" | "cc" | "seller" | string;

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
  hidden_from_assignment?: boolean | null;
};


type ClientRow = Omit<Client, "assigned_user"> & {
  assigned_user?: Client["assigned_user"] | Client["assigned_user"][] | null;
};

function isHiddenAssignmentUser(profile: {
  display_name?: string | null;
  hidden_from_assignment?: boolean | null;
}) {
  const displayName = (profile.display_name || "").toLowerCase().trim();

  return (
    profile.hidden_from_assignment === true ||
    displayName === "own1" ||
    displayName === "seller2" ||
    displayName.includes("own1") ||
    displayName.includes("seller2")
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
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("Wszystkie");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedAdvisorIds, setSelectedAdvisorIds] = useState<string[]>([]);
  const [selectedClientTypes, setSelectedClientTypes] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [visibleClientsLimit, setVisibleClientsLimit] = useState(15);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [assigningClient, setAssigningClient] = useState<Client | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState("");
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

  useEffect(() => {
    initializePage();
  }, []);

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
    selectedAdvisorIds,
    selectedClientTypes,
    selectedProvinces,
    selectedCities,
  ]);

  useEffect(() => {
    function handleWindowScroll() {
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;

      if (scrollPosition < pageHeight - 120) return;
      if (loadingMoreClientsRef.current) return;

      loadingMoreClientsRef.current = true;

      setVisibleClientsLimit((currentLimit) =>
        Math.min(currentLimit + 15, clients.length)
      );

      window.setTimeout(() => {
        loadingMoreClientsRef.current = false;
      }, 350);
    }

    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [clients.length]);

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
      .from("user_profiles")
      .select("id, display_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Błąd ładowania profilu:", profileError);
    }

    const role = (profileData?.role || "seller") as UserRole;
    setCurrentUserRole(role);

    await Promise.all([loadClients(user.id, role), loadSellers()]);
  }

  async function loadSellers() {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, display_name, role, hidden_from_assignment")
      .in("role", ["seller", "owner", "admin", "cc"])
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania użytkowników:", error);
      return;
    }

    setSellers(
      ((data || []) as Omit<Profile, "email">[])
        .filter((profile) => {
          if (currentUserRole === "admin") return true;
          return !isHiddenAssignmentUser(profile);
        })
        .map((profile) => ({
          ...profile,
          email: null,
        }))
    );
  }

  function canAssignClients() {
    return ["owner", "admin", "cc"].includes(currentUserRole || "");
  }

  function getAdvisorName(client: Client) {
    return client.assigned_user?.display_name || client.assigned_user?.email || "Brak";
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
    if (role === "cc") return "Konsultant CC";
    return "Doradca Techniczny";
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
  }

  async function loadClients(userId = currentUserId, role = currentUserRole) {
    setLoading(true);

    let query = supabase
      .from("clients")
      .select(
        "id, public_id, full_name, company_name, client_type, phone, email, city, province, status, assigned_user_id, created_at"
      )
      .order("created_at", { ascending: false });

    if (role === "seller" && userId) {
      query = query.eq("assigned_user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania klientów:", error);
    }

    const clientsWithoutAssignedUsers = (data || []) as ClientRow[];

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
        .from("user_profiles")
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

    const normalizedClients = clientsWithoutAssignedUsers.map((client) => ({
      ...client,
      assigned_user: client.assigned_user_id
        ? assignedUsersById[client.assigned_user_id] || null
        : null,
    }));

    setClients(normalizedClients);
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

    const shouldAskAssignment = ["owner", "admin", "cc"].includes(
      currentUserRole || ""
    );

    if (shouldAskAssignment && typeof assignToCurrentUser === "undefined") {
      setShowSelfAssignPrompt(true);
      return;
    }

    setSavingClient(true);

    const normalizedPhone = newClient.phone.trim();
    const normalizedContactPhone = newClient.contact_phone.trim();

    const shouldAssignToCurrentUser =
      currentUserRole === "seller" || assignToCurrentUser === true;

    const payload = {
      created_by: currentUserId,
      assigned_to: shouldAssignToCurrentUser ? currentUserId : null,
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

    const { error } = await supabase
      .from("clients")
      .insert(payload);

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

    const selectedSeller = sellers.find((seller) => seller.id === selectedSellerId) || null;

    setClients((currentClients) =>
      currentClients.map((client) =>
        client.id === assigningClient.id
          ? {
              ...client,
              assigned_user_id: selectedSellerId,
              assigned_user: selectedSeller,
              status: "Przypisany",
            }
          : client
      )
    );

    setSavingAssignment(false);
    closeAssignModal();
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
    selectedCities.length;

  const filteredClients = clients.filter((client) => {
    const matchesStatus =
      statusFilter === "Wszystkie" || client.status === statusFilter;

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

    return (
      matchesStatus &&
      matchesAdvisor &&
      matchesClientType &&
      matchesProvince &&
      matchesCity
    );
  });

  const visibleClients = filteredClients.slice(0, visibleClientsLimit);
  const hasMoreClients = visibleClients.length < filteredClients.length;

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

            <button
              type="button"
              onClick={openAddClientModal}
              className="inline-flex w-full justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400 sm:w-auto"
            >
              + Dodaj klienta
            </button>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                Status klienta
              </p>
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
            </div>

            <div ref={filtersPanelRef} className="relative w-full sm:w-[280px]">
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
                <div className="absolute right-0 top-full z-40 mt-2 max-h-[520px] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:w-[360px]">
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                    <th className="w-[26%] px-4 py-2.5 text-left font-semibold">Klient</th>
                    <th className="w-[13%] px-4 py-2.5 text-left font-semibold">Status</th>
                    <th className="w-[17%] px-4 py-2.5 text-left font-semibold">Doradca</th>
                    <th className="w-[16%] px-4 py-2.5 text-left font-semibold">Miasto</th>
                    <th className="w-[16%] px-4 py-2.5 text-left font-semibold">Województwo</th>
                    <th className="w-[12%] px-4 py-2.5 text-right font-semibold">Akcje</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleClients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${getClientTypeClass(client)}`}
                          >
                            {getClientTypeLabel(client)}
                          </span>

                          <div className="min-w-0 truncate font-semibold text-slate-900">
                            {client.full_name || client.company_name || "Brak nazwy"}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            statusStyles[client.status || ""] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {client.status || "Brak statusu"}
                        </span>
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

                          <Link
                            href={`/clients/${client.id}`}
                            className="inline-flex rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-400"
                          >
                            Otwórz
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
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