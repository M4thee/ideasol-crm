"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";



import { supabase } from "@/lib/supabase";

type Offer = {
  id: string;
  offer_public_id: string | null;
  created_at: string;
  final_gross: number | null;
  client_name: string | null;
  client_email: string | null;
  created_by: string | null;
};

type SellerOption = {
  id: string;
  label: string;
  role: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  owner: "Członek Zarządu",
  manager: "Manager",
  seller: "Doradca Techniczny",
  cc: "Konsultant CC",
};

function OffersPageContent() {
  const searchParams = useSearchParams();

  const clientId = searchParams.get("clientId");
  const createSaleMode = searchParams.get("createSale") === "1";
  const eventId = searchParams.get("eventId");

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("seller");
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [sellerOptions, setSellerOptions] = useState<SellerOption[]>([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [sellerFilterOpen, setSellerFilterOpen] = useState(false);

  useEffect(() => {
    initializeOffersPage();
  }, [clientId]);

  async function initializeOffersPage() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;


    if (!user) {
      setOffers([]);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role || "seller";

    setCurrentUserRole(role);

    if (["admin", "owner", "cc"].includes(role)) {
      setVisibleUserIds(null);
      await loadSellerOptions(null, role);
      await loadOffers(null, role);
      return;
    }

    if (role === "seller") {
      const ids = [user.id];
      setVisibleUserIds(ids);
      await loadSellerOptions(ids, role);
      await loadOffers(ids, role);
      return;
    }

    if (role === "manager") {
      const { data: teamMembers, error: teamError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("manager_id", user.id);



      const ids = [
        user.id,
        ...((teamMembers || []).map((item: { id: string }) => item.id)),
      ];



      setVisibleUserIds(ids);
      await loadSellerOptions(ids, role);
      await loadOffers(ids, role);
      return;
    }

    await loadSellerOptions([user.id], role);
    await loadOffers([user.id], role);
  }

  async function loadSellerOptions(userIds: string[] | null, role?: string) {
    let query = supabase
      .from("profiles")
      .select("id, display_name, email, role, hidden_from_assignment, is_active")
      .order("display_name", { ascending: true });

    if (userIds?.length) {
      query = query.in("id", userIds);
    } else if (!["admin", "owner", "cc"].includes(role || "")) {
      setSellerOptions([]);
      return;
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd pobierania handlowców do filtra ofert:", error);
      setSellerOptions([]);
      return;
    }

    const options = ((data || []) as Array<{
  id: string;
  display_name?: string | null;
  email?: string | null;
  role?: string | null;
  hidden_from_assignment?: boolean | null;
  is_active?: boolean | null;
}>)
      .filter((profile) => {
  if (profile.hidden_from_assignment === true) return false;
  if (profile.is_active === false) return false;

  const normalizedRole = String(profile.role || "").toLowerCase();
  return ["seller", "manager", "owner", "admin"].includes(normalizedRole) || !!userIds?.includes(profile.id);
})
      .map((profile) => ({
        id: profile.id,
        label:
          profile.display_name ||
          profile.email ||
          "Użytkownik",
        role: profile.role || null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl"));

    setSellerOptions(options);
  }

  async function loadOffers(userIds: string[] | null, role?: string) {
    try {
      setLoading(true);

      let query = supabase
        .from("client_offers")
        .select("id, offer_public_id, created_at, final_gross, client_name, client_email, created_by")
        .order("created_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      if (role === "seller" && userIds?.length) {
        query = query.eq("created_by", userIds[0]);
      }

      if (role === "manager" && userIds?.length) {
        query = query.in("created_by", userIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Błąd pobierania ofert:", error);
        return;
      }

      let visibleOffers = (data as Offer[]) || [];

      if (role === "seller" && userIds?.length) {
        visibleOffers = visibleOffers.filter(
          (offer) => offer.created_by === userIds[0]
        );
      }

      if (role === "manager" && userIds?.length) {
        visibleOffers = visibleOffers.filter(
          (offer) =>
            !!offer.created_by &&
            userIds.includes(offer.created_by)
        );
      }


      setOffers(visibleOffers);
    } finally {
      setLoading(false);
    }
  }

  const filteredOffers = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    const sellerFilteredOffers =
      selectedSellerIds.length === 0
        ? offers
        : offers.filter(
            (offer) => !!offer.created_by && selectedSellerIds.includes(offer.created_by)
          );

    if (!search) return sellerFilteredOffers;

    return sellerFilteredOffers.filter((offer) => {
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
  }, [offers, searchTerm, selectedSellerIds]);


  const selectedSellerNames = sellerOptions
    .filter((seller) => selectedSellerIds.includes(seller.id))
    .map((seller) => seller.label);

  const sellerFilterLabel =
    selectedSellerIds.length === 0
      ? "Wszyscy handlowcy"
      : selectedSellerNames.length === 1
        ? selectedSellerNames[0]
        : `${selectedSellerNames.length} handlowców`;

  function toggleSellerFilter(sellerId: string) {
    setSelectedSellerIds((current) =>
      current.includes(sellerId)
        ? current.filter((id) => id !== sellerId)
        : [...current, sellerId]
    );
  }

  function selectMyOffers() {
    if (!currentUserId) return;
    setSelectedSellerIds([currentUserId]);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-slate-500">Oferty kalkulatora</p>
          <h1 className="text-3xl font-bold text-slate-900">Oferty</h1>
        </div>

        {createSaleMode && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            Wybierz ofertę, z której chcesz utworzyć sprzedaż.
          </div>
        )}
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-3xl">
            <input
              type="text"
              placeholder="Szukaj po ID oferty, nazwisku, emailu, telefonie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setSellerFilterOpen((open) => !open)}
                disabled={currentUserRole === "seller" || sellerOptions.length <= 1}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-300 focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <span className="truncate">{sellerFilterLabel}</span>
                <span className="ml-3 text-slate-400">▾</span>
              </button>

              {sellerFilterOpen && currentUserRole !== "seller" && sellerOptions.length > 1 && (
                <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[420px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSellerIds([])}
                      className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                        selectedSellerIds.length === 0
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      Wszyscy
                    </button>
                    <button
                      type="button"
                      onClick={selectMyOffers}
                      disabled={!currentUserId}
                      className={`rounded-2xl px-5 py-3 text-sm font-black transition disabled:opacity-50 ${
                        currentUserId && selectedSellerIds.length === 1 && selectedSellerIds[0] === currentUserId
                          ? "bg-emerald-900 text-white dark:bg-emerald-700"
                          : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950"
                      }`}
                    >
                      Moje
                    </button>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {sellerOptions.map((seller) => {
                      const checked = selectedSellerIds.includes(seller.id);
                      const roleKey = String(seller.role || "").toLowerCase();
                      const roleLabel = ROLE_LABELS[roleKey] || seller.role || "Użytkownik";

                      return (
                        <label
                          key={seller.id}
                          className="grid cursor-pointer grid-cols-[32px_1fr_auto] items-center gap-4 rounded-2xl px-2 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSellerFilter(seller.id)}
                            className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {seller.label}
                          </span>
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {roleLabel}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-slate-500">
            Wyniki: {filteredOffers.length}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Ładowanie ofert...
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            Nie znaleziono ofert.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-4 py-3">OfferID</th>
                  <th className="px-4 py-3">Klient</th>
                  <th className="px-4 py-3">Kontakt</th>
                  <th className="px-4 py-3">Wartość</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>

              <tbody>
                {filteredOffers.map((offer) => (
                  <tr
                    key={offer.id}
                    className="border-b border-slate-100"
                  >
                    <td className="px-4 py-4 font-bold text-slate-900">
                      {offer.offer_public_id || "—"}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {offer.client_name || "—"}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      <div>{offer.client_email || "—"}</div>
                    </td>

                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {offer.final_gross
                        ? `${offer.final_gross.toLocaleString("pl-PL")} zł`
                        : "—"}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {new Date(offer.created_at).toLocaleDateString("pl-PL")}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/offers/${offer.id}`}
                          className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Otwórz ofertę
                        </Link>

                        {createSaleMode && (
                          <Link
                            href={`/offers/${offer.id}?createSale=1${eventId ? `&eventId=${eventId}` : ""}`}
                            className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500"
                          >
                            Utwórz sprzedaż
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OffersPage() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-center text-slate-500">
          Ładowanie ofert...
        </div>
      }
    >
      <OffersPageContent />
    </Suspense>
  );
}