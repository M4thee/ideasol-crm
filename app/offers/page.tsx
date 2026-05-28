"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function OffersPage() {
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

  useEffect(() => {
    initializeOffersPage();
  }, [clientId]);

  async function initializeOffersPage() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    console.log("OFFERS SESSION:", session);
    console.log("OFFERS USER:", user);

    if (!user) {
      console.error("BRAK USERA AUTH W /offers");
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
      await loadOffers(null, role);
      return;
    }

    if (role === "seller") {
      const ids = [user.id];
      setVisibleUserIds(ids);
      await loadOffers(ids, role);
      return;
    }

    if (role === "manager") {
      const { data: teamMembers, error: teamError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("manager_id", user.id);

      console.log("MANAGER TEAM MEMBERS:", teamMembers);
      console.log("MANAGER TEAM ERROR:", teamError);

      const ids = [
        user.id,
        ...((teamMembers || []).map((item: { id: string }) => item.id)),
      ];

      console.log("MANAGER VISIBLE IDS:", ids);

      setVisibleUserIds(ids);
      await loadOffers(ids, role);
      return;
    }

    await loadOffers([user.id], role);
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

      console.log("OFFERS AFTER FILTER:", visibleOffers);

      setOffers(visibleOffers);
    } finally {
      setLoading(false);
    }
  }

  const filteredOffers = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

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
  }, [offers, searchTerm]);

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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Szukaj po ID oferty, nazwisku, emailu, telefonie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 sm:max-w-md"
          />

          <div className="text-sm text-slate-500 space-y-1 text-right">
            <div>Wyniki: {filteredOffers.length}</div>
            <div>Rola: {currentUserRole}</div>
            <div>UserID: {currentUserId || "BRAK SESSION"}</div>
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
                      <div className="text-xs text-slate-400 mt-1">
                        created_by: {offer.created_by}
                      </div>
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