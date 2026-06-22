"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Sale = {
  id: string;
  public_id: number | null;
  client_id: string | null;
  seller_id: string | null;
  sale_date: string;
  contract_value: number | null;
  status: string;
  created_at: string;
};

type Client = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
};

type SellerProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
  manager_id?: string | null;
  hidden_from_assignment?: boolean | null;
};

type SaleWithClient = Sale & {
  client: Client | null;
  seller: SellerProfile | null;
};

type SalesOwner = {
  id: string;
  display_name: string | null;
  role: string | null;
  manager_id?: string | null;
  hidden_from_assignment?: boolean | null;
};

type OfferPickerItem = {
  id: string;
  offer_public_id: string | null;
  client_name: string | null;
  client_email: string | null;
  final_gross: number | null;
  created_at: string;
  created_by?: string | null;
};

function isHiddenAssignmentUser(profile: {
  display_name?: string | null;
  hidden_from_assignment?: boolean | null;
}) {
  const displayName = (profile.display_name || "").toLowerCase().trim();

  return (
    profile.hidden_from_assignment === true ||
    displayName === "own1" ||
    displayName.includes("own1")
  );
}

function getSaleStatusClass(status: string) {
  switch (status) {
    case "Oczekuje na sprawdzenie dokumentów":
      return "bg-[#95FCFC] !text-slate-950 border-[#95FCFC]";
    case "Oczekiwanie na zaliczkę":
      return "bg-[#FCE795] !text-slate-950 border-[#FCE795]";
    case "Oczekuje na umówienie montażu":
      return "bg-[#F3D357] !text-slate-950 border-[#F3D357]";
    case "Montaż umówiony":
      return "bg-[#D578FA] !text-slate-950 border-[#D578FA]";
    case "W trakcie montażu":
      return "bg-[#C039F3] text-white border-[#C039F3]";
    case "Montaż zakończony - oczekiwanie na pełną wpłatę":
      return "bg-[#8B11B9] text-white border-[#8B11B9]";
    case "Zakończony - procesowanie ZM":
      return "bg-[#0AA906] text-white border-[#0AA906]";
    case "Zakończony - ZM wysłane":
      return "bg-[#0AA906] text-white border-[#0AA906]";
    case "Zakończony - procesowanie dotacji":
      return "bg-[#0BF3F5] !text-slate-950 border-[#0BF3F5]";
    case "Zakończony":
      return "bg-[#0AA906] text-white border-[#0AA906]";
    case "Anulowana":
      return "bg-[#F20E1C] text-white border-[#F20E1C]";
    case "Odstępienie - utrzymanie":
      return "bg-[#7C7374] text-white border-[#7C7374]";
    case "Utrzymanie - nieuratowana":
      return "bg-[#3D0309] text-white border-[#3D0309]";
    case "Utrzymanie - uratowana":
      return "bg-[#B9DAD9] !text-slate-950 border-[#B9DAD9]";
    default:
      return "bg-slate-100 !text-slate-700 border-slate-200 dark:bg-slate-800 dark:!text-slate-100 dark:border-slate-700";
  }
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [visibilityScopeReady, setVisibilityScopeReady] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "owner" | "manager" | "seller" | "cc">("seller");
  const [salesOwners, setSalesOwners] = useState<SalesOwner[]>([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [isSellerFilterOpen, setIsSellerFilterOpen] = useState(false);

  const [isOfferPickerOpen, setIsOfferPickerOpen] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offers, setOffers] = useState<OfferPickerItem[]>([]);
  const [offerSearch, setOfferSearch] = useState("");

  useEffect(() => {
    initializeSalesPage();
  }, []);

  useEffect(() => {
    if (!currentUserId || !visibilityScopeReady) return;

    loadSales();
  }, [currentUserId, currentUserRole, selectedSellerIds, visibleUserIds, visibilityScopeReady]);

  async function loadVisibleUserIds(
    userId: string,
    role: string
  ) {
    if (["admin", "owner"].includes(role)) {
      setVisibleUserIds(null);
      return null;
    }

    if (role === "seller") {
      const ids = [userId];
      setVisibleUserIds(ids);
      return ids;
    }

    if (role === "cc") {
      setVisibleUserIds(null);
      return null;
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
        ...(data || []).map((item: { id: string }) => item.id),
      ];

      setVisibleUserIds(ids);
      return ids;
    }

    const fallbackIds = [userId];
    setVisibleUserIds(fallbackIds);
    return fallbackIds;
  }

  async function initializeSalesPage() {
    setVisibilityScopeReady(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId(null);
      setSales([]);
      setVisibilityScopeReady(true);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profileData?.role || "seller") as "admin" | "owner" | "manager" | "seller" | "cc";

    setCurrentUserRole(role);
    const ids = await loadVisibleUserIds(user.id, role);
    setVisibilityScopeReady(true);

    if (role === "seller") {
      setSalesOwners([
        {
          id: user.id,
          display_name: profileData?.display_name || "Moje sprzedaże",
          role,
        },
      ]);
      setSelectedSellerIds([user.id]);
      return;
    }

    if (role === "cc") {
      setSelectedSellerIds([]);
    }

    let ownersQuery = supabase
      .from("profiles")
      .select("id, display_name, role, manager_id, hidden_from_assignment")
      .order("display_name", { ascending: true });

    if (role !== "admin") {
      ownersQuery = ownersQuery.eq("hidden_from_assignment", false);
    }

    const { data: ownersData, error: ownersError } = await ownersQuery;

    if (ownersError) {
      console.error("Błąd ładowania użytkowników do filtra sprzedaży:", ownersError);
      setSalesOwners([]);
      return;
    }

    const scopedOwners =
      role === "manager" && ids?.length
        ? ((ownersData || []) as SalesOwner[]).filter((owner) =>
            ids.includes(owner.id)
          )
        : ((ownersData || []) as SalesOwner[]);

    const visibleOwners = scopedOwners.filter((owner) => {
      if (role === "admin") return true;
      return !isHiddenAssignmentUser(owner);
    });

    setSalesOwners(visibleOwners);
  }

  async function loadSales() {
    setLoading(true);

    let query = supabase
      .from("sales")
      .select("id, public_id, client_id, seller_id, sale_date, contract_value, status, created_at")
      .order("created_at", { ascending: false });

    if (selectedSellerIds.length > 0) {
      query = query.in("seller_id", selectedSellerIds);
    } else if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("seller_id", visibleUserIds);
    }

    const { data: salesData, error: salesError } = await query;

    if (salesError || !salesData) {
      console.error("Błąd ładowania sprzedaży:", salesError);
      setLoading(false);
      return;
    }

    let visibleSalesData = salesData;

    if (currentUserRole === "seller" && currentUserId) {
      visibleSalesData = salesData.filter(
        (sale) => sale.seller_id === currentUserId
      );
    }

    if (currentUserRole === "manager") {
      const allowedIds = visibleUserIds ||
        (currentUserId ? [currentUserId] : []);

      visibleSalesData = salesData.filter(
        (sale) =>
          !!sale.seller_id &&
          allowedIds.includes(sale.seller_id)
      );
    }

    const clientIds = visibleSalesData
      .map((sale) => sale.client_id)
      .filter((clientId): clientId is string => Boolean(clientId));

    let clientsData: Client[] = [];

    if (clientIds.length > 0) {
      const { data: loadedClients, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, company_name, phone, email, city")
        .in("id", clientIds);

      if (clientsError) {
        console.error("Błąd ładowania klientów sprzedaży:", clientsError);
      }

      clientsData = (loadedClients as Client[]) || [];
    }

    const sellerIds = visibleSalesData
      .map((sale) => sale.seller_id)
      .filter((sellerId): sellerId is string => Boolean(sellerId));

    let sellersData: SellerProfile[] = [];

    if (sellerIds.length > 0) {
      const { data: loadedSellers, error: sellersError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role, hidden_from_assignment")
        .in("id", sellerIds);

      if (sellersError) {
        console.error("Błąd ładowania sprzedawców sprzedaży:", sellersError);
      }

      sellersData = (loadedSellers as unknown as SellerProfile[]) || [];

    }

    const salesWithClients = visibleSalesData.map((sale) => {
      const client = clientsData.find((item) => item.id === sale.client_id) || null;
      const seller = sellersData.find((item) => item.id === sale.seller_id) || null;

      return {
        ...(sale as Sale),
        client,
        seller,
      };
    });

    setSales(salesWithClients);
    setLoading(false);
  }

  async function openOfferPicker() {
    setIsOfferPickerOpen(true);

    if (offers.length > 0) return;

    setOffersLoading(true);

    let offersQuery = supabase
      .from("client_offers")
      .select(
        "id, offer_public_id, client_name, client_email, final_gross, created_at, created_by"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (currentUserRole === "seller" && currentUserId) {
      offersQuery = offersQuery.eq("created_by", currentUserId);
    }

    if (currentUserRole === "manager") {
      const allowedIds = visibleUserIds ||
        (currentUserId ? [currentUserId] : []);

      if (allowedIds.length > 0) {
        offersQuery = offersQuery.in("created_by", allowedIds);
      }
    }

    if (currentUserRole === "cc") {
      // CC ma widzieć wszystkie oferty
    }

    const { data, error } = await offersQuery;

    if (error) {
      console.error("Błąd ładowania ofert:", error);
      setOffersLoading(false);
      return;
    }

    console.log("ROLE:", currentUserRole);
    console.log("CURRENT USER:", currentUserId);
    console.log("VISIBLE IDS:", visibleUserIds);
    console.log("OFFERS COUNT:", data?.length);
    setOffers((data as OfferPickerItem[]) || []);
    setOffersLoading(false);
  }

  function toggleSellerFilter(sellerId: string) {
    setSelectedSellerIds((current) =>
      current.includes(sellerId)
        ? current.filter((id) => id !== sellerId)
        : [...current, sellerId]
    );
  }

  function selectAllSellers() {
    setSelectedSellerIds([]);
  }

  function selectOnlyMe() {
    if (!currentUserId) return;
    setSelectedSellerIds([currentUserId]);
  }

  function getSellerFilterLabel() {
    if (currentUserRole === "seller") return "Moje sprzedaże";
    if (selectedSellerIds.length === 0) return "Wszyscy sprzedawcy";
    if (selectedSellerIds.length === 1) {
      const owner = salesOwners.find((item) => item.id === selectedSellerIds[0]);
      return owner?.display_name || "Wybrany sprzedawca";
    }
    return `${selectedSellerIds.length} sprzedawców`;
  }

  const filteredOffers = useMemo(() => {
    const search = offerSearch.toLowerCase().trim();

    if (!search) return offers;

    return offers.filter((offer) => {
      return (
        (offer.offer_public_id || "")
          .toLowerCase()
          .includes(search) ||
        (offer.client_name || "")
          .toLowerCase()
          .includes(search) ||
        (offer.client_email || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [offers, offerSearch]);

  return (
    <main className="text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">Moduł sprzedażowy</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">Sprzedaże</h1>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={openOfferPicker}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
            >
              Dodaj sprzedaż
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {currentUserRole === "seller" ? "Moje sprzedaże" : "Liczba sprzedaży"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">{sales.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {currentUserRole === "seller" ? "Moje zakończone" : "Zakończone"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
              {sales.filter((sale) => sale.status.startsWith("Zakończony")).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {currentUserRole === "seller" ? "Wartość moich umów" : "Wartość umów"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
              {sales
                .filter((sale) => sale.status !== "Anulowana")
                .reduce((sum, sale) => sum + (sale.contract_value || 0), 0)
                .toLocaleString("pl-PL")} zł
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lista sprzedaży</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Najnowsze sprzedaże są na górze listy.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:ml-auto lg:w-auto">
              <div className="relative w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsSellerFilterOpen((value) => !value)}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60 sm:w-auto"
                >
                  {getSellerFilterLabel()}
                </button>

                {isSellerFilterOpen && !["seller", "cc"].includes(currentUserRole) && (
                  <div className="absolute left-0 right-0 top-12 z-30 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:left-auto sm:w-72">
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllSellers}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Wszyscy
                      </button>

                      <button
                        type="button"
                        onClick={selectOnlyMe}
                        className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                      >
                        Moje
                      </button>
                    </div>

                    <div className="max-h-72 space-y-1 overflow-auto">
                      {salesOwners.map((owner) => (
                        <label
                          key={owner.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSellerIds.includes(owner.id)}
                            onChange={() => toggleSellerFilter(owner.id)}
                            className="h-4 w-4 accent-emerald-500"
                          />

                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {owner.display_name || "Użytkownik"}
                          </span>

                          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                            {owner.role === "owner"
                              ? "Członek Zarządu"
                              : owner.role === "admin"
                              ? "Administrator"
                              : owner.role === "manager"
                              ? "Manager"
                              : owner.role === "cc"
                              ? "Konsultant CC"
                              : "Doradca Techniczny"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={loadSales}
                className="w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto"
              >
                Odśwież
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-4 text-slate-500 dark:text-slate-400 sm:p-6">Ładowanie sprzedaży...</div>
          ) : sales.length === 0 ? (
            <div className="space-y-4 p-4 text-slate-500 dark:text-slate-400 sm:p-6">
              <p>
                Brak sprzedaży. Sprzedaże są teraz tworzone wyłącznie na podstawie istniejących ofert.
              </p>
              <Link
                href="/offers?createSale=1"
                className="inline-flex rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-white transition hover:bg-emerald-400"
              >
                Przejdź do ofert
              </Link>
            </div>
          ) : (
            <>
              <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 sm:px-6">
                <span className="font-semibold">Nowy workflow sprzedaży:</span> sprzedaże powinny być tworzone wyłącznie z istniejących ofert kalkulatora.
              </div>
              <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="text-left px-4 py-3 sm:px-6 font-semibold">SaleID</th>
                    <th className="text-left px-4 py-3 sm:px-6 font-semibold">Data sprzedaży</th>
                    <th className="text-left px-4 py-3 sm:px-6 font-semibold">Klient</th>
                    <th className="text-left px-4 py-3 sm:px-6 font-semibold">Sprzedawca</th>
                    <th className="text-left px-4 py-3 sm:px-6 font-semibold">Wartość umowy</th>
                    <th className="text-left px-4 py-3 sm:px-6 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 sm:px-6 font-semibold">Akcje</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.map((sale) => {
                    const visibleSaleId = sale.public_id
                      ? `SID${String(sale.public_id).padStart(6, "0")}`
                      : `SID-${sale.id.slice(0, 8).toUpperCase()}`;
                    const clientName =
                      sale.client?.full_name ||
                      sale.client?.company_name ||
                      "Brak klienta";

                    return (
                      <tr key={sale.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/70">
                        <td className="px-4 py-4 sm:px-6 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {visibleSaleId}
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {new Date(sale.sale_date).toLocaleString("pl-PL")}
                        </td>

                        <td className="px-4 py-4 sm:px-6">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{clientName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {sale.client?.city || "Brak miasta"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {sale.seller?.display_name ||
                            sale.seller?.email ||
                            (sale.seller_id
                              ? `Seller: ${sale.seller_id.slice(0, 8)}`
                              : "Brak sprzedawcy")}
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {sale.contract_value
                            ? `${sale.contract_value.toLocaleString("pl-PL")} zł`
                            : "Brak danych"}
                        </td>

                        <td className="px-4 py-4 sm:px-6">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full border text-xs font-bold ${getSaleStatusClass(
                              sale.status
                            )}`}
                          >
                            {sale.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-right">
                          <a
                            href={`/sales/${sale.id}`}
                            className="inline-flex rounded-xl bg-emerald-500 px-4 py-2 font-bold text-white hover:bg-emerald-400"
                          >
                            Otwórz
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </section>
      </div>
      {isOfferPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Nowa sprzedaż</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Wybierz ofertę
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsOfferPickerOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Zamknij
              </button>
            </div>

            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <input
                type="text"
                value={offerSearch}
                onChange={(e) => setOfferSearch(e.target.value)}
                placeholder="Szukaj po OfferID, nazwisku, emailu..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="overflow-auto px-6 py-4">
              {offersLoading ? (
                <div className="py-12 text-center text-slate-500">
                  Ładowanie ofert...
                </div>
              ) : filteredOffers.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  Nie znaleziono ofert.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-slate-700 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20 lg:flex-row lg:items-center"
                    >
                      <div className="min-w-[140px]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          OfferID
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {offer.offer_public_id || "—"}
                        </p>
                      </div>

                      <div className="flex-1">
                        <p className="text-lg font-semibold text-slate-900">
                          {offer.client_name || "Brak klienta"}
                        </p>

                        <p className="text-sm text-slate-500">
                          {offer.client_email || "Brak emaila"}
                        </p>
                      </div>

                      <div className="min-w-[160px]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Wartość oferty
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                          {offer.final_gross
                            ? `${offer.final_gross.toLocaleString("pl-PL")} zł`
                            : "—"}
                        </p>
                      </div>

                      <div className="min-w-[140px] text-sm text-slate-500">
                        {new Date(offer.created_at).toLocaleDateString("pl-PL")}
                      </div>

                      <div>
                        <Link
                          href={`/offers/${offer.id}?createSale=1`}
                          className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
                        >
                          Utwórz sprzedaż
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}