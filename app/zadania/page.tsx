"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Reminder = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  event_at: string;
  status: string | null;
  client_name: string;
  event_type: string | null;
  created_by: string | null;
  owner_name?: string | null;
};

type TaskOwner = {
  id: string;
  display_name: string | null;
  role: string | null;
};

export default function TasksPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "owner" | "seller" | "cc">("seller");
  const [taskOwners, setTaskOwners] = useState<TaskOwner[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [isOwnerFilterOpen, setIsOwnerFilterOpen] = useState(false);

  useEffect(() => {
    initializeTasksPage();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    loadReminders();
  }, [currentUserId, currentUserRole, selectedOwnerIds]);

  async function initializeTasksPage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId(null);
      setReminders([]);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profileData?.role || "seller") as "admin" | "owner" | "seller" | "cc";

    setCurrentUserRole(role);

    if (role === "seller") {
      setTaskOwners([
        {
          id: user.id,
          display_name: profileData?.display_name || "Moje zadania",
          role,
        },
      ]);

      setSelectedOwnerIds([user.id]);
      return;
    }

    const { data: ownersData, error: ownersError } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .in("role", ["seller", "admin", "owner", "cc"])
      .order("display_name", { ascending: true });

    if (ownersError) {
      console.error("Błąd ładowania użytkowników do filtra zadań", ownersError);
      return;
    }

    setTaskOwners((ownersData || []) as TaskOwner[]);
  }

  async function loadReminders() {
    setLoading(true);

    let query = supabase
      .from("calendar_events")
      .select(
        "id, client_id, title, description, event_at, status, event_type, created_by"
      )
      .eq("event_type", "reminder")
      .order("event_at", { ascending: true });

    if (currentUserRole === "seller" && currentUserId) {
      query = query.eq("created_by", currentUserId);
    } else if (selectedOwnerIds.length > 0) {
      query = query.in("created_by", selectedOwnerIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Błąd ładowania przypomnień", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setReminders([]);
      setLoading(false);
      return;
    }

    const activeReminders = data.filter((item) => {
      const status = String(item.status || "").toLowerCase();

      return !(
        status === "done" ||
        status === "completed" ||
        status === "zakończone" ||
        status === "zakonczone" ||
        status.startsWith("zakończone") ||
        status.startsWith("zakonczone")
      );
    });

    if (activeReminders.length === 0) {
      setReminders([]);
      setLoading(false);
      return;
    }

    const clientIds = [
      ...new Set(activeReminders.map((item) => item.client_id).filter(Boolean)),
    ];

    const { data: clientsData, error: clientsError } = clientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, full_name, company_name")
          .in("id", clientIds)
      : { data: [], error: null };

    if (clientsError) {
      console.error("Błąd ładowania klientów", clientsError);
    }

    const clientsById = new Map(
      (clientsData || []).map((client) => [
        client.id,
        client.full_name || client.company_name || "Klient",
      ])
    );

    const ownerIds = [
      ...new Set(activeReminders.map((item) => item.created_by).filter(Boolean)),
    ];

    const { data: ownersData, error: ownersError } = ownerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ownerIds)
      : { data: [], error: null };

    if (ownersError) {
      console.error("Błąd ładowania właścicieli zadań", ownersError);
    }

    const ownersById = new Map(
      (ownersData || []).map((owner) => [
        owner.id,
        owner.display_name || "Użytkownik",
      ])
    );

    setReminders(
      activeReminders.map((item) => ({
        ...item,
        client_name: clientsById.get(item.client_id) || "Klient",
        owner_name: item.created_by
          ? ownersById.get(item.created_by) || "Użytkownik"
          : null,
      }))
    );

    setLoading(false);
  }

  function getReminderGroup(dateValue: string) {
    const now = new Date();
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Później";

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const dayAfterTomorrowStart = new Date(todayStart);
    dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 2);

    if (date < now) return "Zaległe";
    if (date >= todayStart && date < tomorrowStart) return "Dzisiaj";
    if (date >= tomorrowStart && date < dayAfterTomorrowStart)
      return "Jutro";

    return "Później";
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
    if (currentUserRole === "seller") return "Moje zadania";
    if (selectedOwnerIds.length === 0) return "Wszyscy użytkownicy";
    if (selectedOwnerIds.length === 1) {
      const owner = taskOwners.find((item) => item.id === selectedOwnerIds[0]);
      return owner?.display_name || "Wybrany użytkownik";
    }
    return `${selectedOwnerIds.length} użytkowników`;
  }

  return (
    <main className="text-slate-900">
      <div className="space-y-6">

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold">Zadania i przypomnienia</h1>

              <p className="text-slate-500 text-sm mt-1">
                Wszystkie aktywne zadania i przypomnienia CRM.
              </p>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsOwnerFilterOpen((value) => !value)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  {getOwnerFilterLabel()}
                </button>

                {isOwnerFilterOpen && currentUserRole !== "seller" && (
                  <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
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
                      {taskOwners.map((owner) => (
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
                            {owner.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            <button
              type="button"
              onClick={() => {
                if (currentUserId) {
                  loadReminders();
                }
              }}
              className="bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm"
            >
              Odśwież
            </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Ładowanie przypomnień...</p>
          ) : reminders.length === 0 ? (
            <p className="text-sm text-slate-400">Brak aktywnych przypomnień.</p>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {["Zaległe", "Dzisiaj", "Jutro", "Później"].map((group) => {
                const items = reminders.filter(
                  (item) => getReminderGroup(item.event_at) === group
                );

                return (
                  <div
                    key={group}
                    className="border border-slate-200 rounded-2xl bg-slate-50 p-4"
                  >
                    <h2 className="font-bold mb-4">
                      {group} ({items.length})
                    </h2>

                    {items.length === 0 ? (
                      <p className="text-sm text-slate-400">Brak zadań.</p>
                    ) : (
                      <div className="space-y-3">
                        {items.map((item) => (
                          <Link
                            key={item.id}
                            href={`/event/${item.id}`}
                            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-sm text-slate-900">
                                  {item.client_name}
                                </p>
                                {currentUserRole !== "seller" && item.owner_name && (
                                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                    Opiekun: {item.owner_name}
                                  </p>
                                )}

                                <p className="mt-1 text-xs text-slate-400">
                                  {new Date(item.event_at).toLocaleString("pl-PL")}
                                </p>
                              </div>

                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  group === "Zaległe"
                                    ? "bg-red-100 text-red-700"
                                    : group === "Dzisiaj"
                                    ? "bg-amber-100 text-amber-700"
                                    : group === "Jutro"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {group}
                              </span>
                            </div>

                            <p className="mt-4 text-sm font-semibold text-slate-800">
                              {item.title}
                            </p>

                            {item.description && (
                              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500 line-clamp-4">
                                {item.description}
                              </p>
                            )}

                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Reminder
                              </span>

                              <span className="text-xs font-semibold text-emerald-600">
                                Otwórz →
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}