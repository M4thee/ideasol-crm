"use client";

import { useEffect, useState } from "react";
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

function getSaleStatusClass(status: string) {
  switch (status) {
    case "Oczekiwanie na zaksięgowanie zaliczki":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "Umówione do montażu":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "Zamontowany":
      return "bg-indigo-100 text-indigo-900 border-indigo-200";
    case "Oczekiwanie na pełną wpłatę":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "Zakończona":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "Anulowana":
      return "bg-red-100 text-red-900 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "owner" | "manager" | "seller" | "cc">("seller");
  const [salesOwners, setSalesOwners] = useState<SalesOwner[]>([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [isSellerFilterOpen, setIsSellerFilterOpen] = useState(false);

  useEffect(() => {
    initializeSalesPage();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    loadSales();
  }, [currentUserId, currentUserRole, selectedSellerIds]);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId(null);
      setSales([]);
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

    if (["seller", "cc"].includes(role)) {
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

    if (currentUserRole !== "admin") {
      const { data: hiddenUsersData, error: hiddenUsersError } = await supabase
        .from("profiles")
        .select("id, display_name, hidden_from_assignment");

      if (hiddenUsersError) {
        console.error("Błąd ładowania ukrytych użytkowników:", hiddenUsersError);
      }

      const hiddenUserIds = new Set(
        (hiddenUsersData || [])
          .filter((userProfile) => isHiddenAssignmentUser(userProfile))
          .map((userProfile) => userProfile.id)
      );

      visibleSalesData = salesData.filter(
        (sale) => !sale.seller_id || !hiddenUserIds.has(sale.seller_id)
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

      if (currentUserRole !== "admin") {
        sellersData = sellersData.filter(
          (seller) => !isHiddenAssignmentUser(seller)
        );
      }
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

  return (
    <main className="text-slate-900">
      <div className="space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-slate-500 mb-1">Moduł sprzedażowy</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Sprzedaże</h1>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm text-slate-500">
              {currentUserRole === "seller" ? "Moje sprzedaże" : "Liczba sprzedaży"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{sales.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm text-slate-500">
              {currentUserRole === "seller" ? "Moje zakończone" : "Zakończone"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              {sales.filter((sale) => sale.status === "Zakończona").length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm text-slate-500">
              {currentUserRole === "seller" ? "Wartość moich umów" : "Wartość umów"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              {sales
                .reduce((sum, sale) => sum + (sale.contract_value || 0), 0)
                .toLocaleString("pl-PL")} zł
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lista sprzedaży</h2>
              <p className="text-sm text-slate-500">
                Najnowsze sprzedaże są na górze listy.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:ml-auto lg:w-auto">
              <div className="relative w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsSellerFilterOpen((value) => !value)}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 sm:w-auto"
                >
                  {getSellerFilterLabel()}
                </button>

                {isSellerFilterOpen && !["seller", "cc"].includes(currentUserRole) && (
                  <div className="absolute left-0 right-0 top-12 z-30 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:left-auto sm:w-72">
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllSellers}
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
                      {salesOwners.map((owner) => (
                        <label
                          key={owner.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSellerIds.includes(owner.id)}
                            onChange={() => toggleSellerFilter(owner.id)}
                            className="h-4 w-4 accent-emerald-500"
                          />

                          <span className="font-medium text-slate-700">
                            {owner.display_name || "Użytkownik"}
                          </span>

                          <span className="ml-auto text-xs text-slate-400">
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
                className="w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 sm:w-auto"
              >
                Odśwież
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-4 text-slate-500 sm:p-6">Ładowanie sprzedaży...</div>
          ) : sales.length === 0 ? (
            <div className="p-4 text-slate-500 sm:p-6">
              Brak sprzedaży. Wejdź w kartę wydarzenia i kliknij „Dodaj sprzedaż”.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
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

                <tbody className="divide-y divide-slate-100">
                  {sales.map((sale) => {
                    const visibleSaleId = sale.public_id
                      ? `SID${String(sale.public_id).padStart(6, "0")}`
                      : `SID-${sale.id.slice(0, 8).toUpperCase()}`;
                    const clientName =
                      sale.client?.full_name ||
                      sale.client?.company_name ||
                      "Brak klienta";

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-4 sm:px-6 font-bold text-slate-900 whitespace-nowrap">
                          {visibleSaleId}
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-slate-700 whitespace-nowrap">
                          {new Date(sale.sale_date).toLocaleString("pl-PL")}
                        </td>

                        <td className="px-4 py-4 sm:px-6">
                          <div>
                            <p className="font-semibold text-slate-900">{clientName}</p>
                            <p className="text-xs text-slate-500">
                              {sale.client?.city || "Brak miasta"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-slate-700 whitespace-nowrap">
                          {sale.seller?.display_name ||
                            sale.seller?.email ||
                            (sale.seller_id
                              ? `Seller: ${sale.seller_id.slice(0, 8)}`
                              : "Brak sprzedawcy")}
                        </td>

                        <td className="px-4 py-4 sm:px-6 text-slate-700 whitespace-nowrap">
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
          )}
        </section>
      </div>
    </main>
  );
}