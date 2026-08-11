"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfitBalance = {
  available_points: number | string | null;
  pending_points: number | string | null;
  reserved_points: number | string | null;
};

type ProfitUser = {
  id: string;
  idea_id: string;
  first_name: string;
  last_name: string;
  phone_e164: string;
  email: string | null;
  account_status: "active" | "blocked" | "closed";
  rewards_locked: boolean;
  joined_at: string;
  crm_link_status: string;
  is_ideasol_customer: boolean;
  points_expire_at: string | null;
  current_seller_id: string | null;
  balance: ProfitBalance;
};

type ProfitSeller = {
  id: string;
  crm_user_id: string;
  crm_numeric_id: number | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  crm_role: string | null;
  referral_code: string;
};

type CrmClientCandidate = {
  id: string;
  public_id: number | null;
  display_name: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  status: string | null;
  assigned_user_id: string | null;
  profit_user: { id: string; idea_id: string } | null;
};

type ProfitReferral = {
  id: string;
  registered_at: string;
  status: "registered" | "points_awarded" | "rejected" | "expired";
  qualification_expires_at: string;
  product: "pv" | "me" | "pv_me";
  referred_first_name: string;
  referred_last_name: string;
  crm_lead_id: string | null;
  crm_sale_id: string | null;
  referrer_idea_id: string;
  referrer_first_name: string;
  referrer_last_name: string;
  source_seller_first_name: string | null;
  source_seller_last_name: string | null;
};

type RewardCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  sort_order: number;
  is_visible: boolean;
};

type Reward = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  price_points: number;
  delivery_type: "digital" | "physical";
  is_available: boolean;
  sort_order: number;
  reward_categories: { name: string; slug: string } | null;
};

type RewardOrder = {
  id: string;
  status: "new" | "approved" | "processing" | "shipped" | "completed" | "cancelled";
  total_points: number;
  delivery_type: "digital" | "physical";
  recipient_first_name: string | null;
  recipient_last_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  profit_users: { idea_id: string; first_name: string; last_name: string } | null;
  reward_order_items: Array<{
    reward_name_snapshot: string;
    quantity: number;
    line_points: number;
  }>;
};

type ProfitDashboardData = {
  users: ProfitUser[];
  sellers: ProfitSeller[];
  referrals: ProfitReferral[];
  rewards: Reward[];
  categories: RewardCategory[];
  orders: RewardOrder[];
  crmClients: CrmClientCandidate[];
  generatedAt: string;
};

type ActiveTab = "overview" | "users" | "referrals" | "rewards" | "orders";

type RewardFormState = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  pricePoints: string;
  deliveryType: "digital" | "physical";
  isAvailable: boolean;
  sortOrder: string;
};

type CategoryFormState = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isVisible: boolean;
};

const emptyReward: RewardFormState = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  pricePoints: "",
  deliveryType: "physical",
  isAvailable: true,
  sortOrder: "100",
};

const emptyCategory: CategoryFormState = {
  id: "",
  name: "",
  slug: "",
  description: "",
  sortOrder: "100",
  isVisible: true,
};

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "overview", label: "Podsumowanie" },
  { id: "users", label: "Uczestnicy i punkty" },
  { id: "referrals", label: "Polecenia" },
  { id: "rewards", label: "Katalog nagród" },
  { id: "orders", label: "Zamówienia" },
];

const referralStatusLabel: Record<ProfitReferral["status"], string> = {
  registered: "W toku",
  points_awarded: "Punkty przyznane",
  rejected: "Odrzucone",
  expired: "Wygasło",
};

const orderStatusLabel: Record<RewardOrder["status"], string> = {
  new: "Nowe",
  approved: "Zatwierdzone",
  processing: "W realizacji",
  shipped: "Wysłane",
  completed: "Zakończone",
  cancelled: "Anulowane",
};

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("pl-PL");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (["active", "points_awarded", "completed"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800";
  }
  if (["blocked", "rejected", "cancelled", "expired"].includes(status)) {
    return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800";
  }
  if (["approved", "processing", "shipped"].includes(status)) {
    return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800";
}

async function profitRequest<T>(init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");
  }

  const response = await fetch("/api/admin/profit", {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Nie udało się wykonać operacji.");
  }

  return payload;
}

export default function ProfitAdmin() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [data, setData] = useState<ProfitDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ProfitUser | null>(null);
  const [pointsValue, setPointsValue] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [crmClientSearch, setCrmClientSearch] = useState("");
  const [selectedCrmClientId, setSelectedCrmClientId] = useState("");
  const [manualUser, setManualUser] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [rewardForm, setRewardForm] = useState<RewardFormState>(emptyReward);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategory);
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [rewardImage, setRewardImage] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const payload = await profitRequest<ProfitDashboardData & { ok: true }>();
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać danych Profit.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.users || [];
    return (data?.users || []).filter((user) =>
      [user.idea_id, user.first_name, user.last_name, user.phone_e164, user.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [data?.users, search]);

  const filteredCrmClients = useMemo(() => {
    const query = crmClientSearch.trim().toLowerCase();
    const clients = data?.crmClients || [];
    if (!query) return clients;
    return clients.filter((client) =>
      [
        client.display_name,
        client.company_name,
        client.phone,
        client.email,
        client.public_id,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [crmClientSearch, data?.crmClients]);

  const stats = useMemo(() => {
    const users = data?.users || [];
    const referrals = data?.referrals || [];
    const orders = data?.orders || [];
    return {
      activeUsers: users.filter((user) => user.account_status === "active").length,
      availablePoints: users.reduce(
        (sum, user) => sum + Number(user.balance.available_points || 0),
        0
      ),
      openReferrals: referrals.filter((referral) => referral.status === "registered").length,
      openOrders: orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length,
    };
  }, [data]);

  async function runAction<T = { ok: true }>(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload = await profitRequest<T & { ok: true }>({ method: "PATCH", body: JSON.stringify(body) });
      setSuccess(message);
      await loadData();
      return payload;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nie udało się wykonać operacji.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function uploadMedia(entityType: "category" | "reward", entityId: string, file: File) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sesja CRM wygasła. Zaloguj się ponownie.");

    const body = new FormData();
    body.set("entityType", entityType);
    body.set("entityId", entityId);
    body.set("file", file);
    const response = await fetch("/api/admin/profit/media", {
      method: "POST",
      headers: { authorization: `Bearer ${session.access_token}` },
      body,
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Nie udało się wgrać grafiki.");
  }

  async function updateUser(user: ProfitUser, changes: Record<string, unknown>) {
    const actionLabel = changes.accountStatus === "blocked" ? "zablokować konto" : "zmienić ustawienia konta";
    if (!window.confirm(`Czy na pewno chcesz ${actionLabel} ${user.idea_id}?`)) return;
    await runAction(
      { action: "update_user", userId: user.id, ...changes },
      `Zapisano ustawienia uczestnika ${user.idea_id}.`
    );
  }

  async function assignSeller(user: ProfitUser, sellerId: string | null) {
    const seller = data?.sellers.find((item) => item.id === sellerId);
    const sellerName = seller ? `${seller.first_name} ${seller.last_name}` : "brak doradcy";
    if (!window.confirm(`Przypisać ${sellerName} do konta ${user.idea_id}?`)) return false;
    const result = await runAction(
      { action: "assign_seller", userId: user.id, sellerId },
      `Zmieniono doradcę uczestnika ${user.idea_id}.`
    );
    return Boolean(result);
  }

  async function adjustPoints() {
    if (!selectedUser) return;
    const points = Number(pointsValue.replace(/\s/g, ""));
    if (!Number.isInteger(points) || points === 0) {
      setError("Podaj pełną liczbę kWpkt różną od zera.");
      return;
    }
    const direction = points > 0 ? "dodać" : "odjąć";
    if (!window.confirm(`Czy ${direction} ${formatNumber(Math.abs(points))} kWpkt na koncie ${selectedUser.idea_id}?`)) return;
    const saved = await runAction(
      {
        action: "adjust_points",
        userId: selectedUser.id,
        points,
        reason: pointsReason,
      },
      `Saldo ${selectedUser.idea_id} zostało skorygowane.`
    );
    if (saved) {
      setSelectedUser(null);
      setPointsValue("");
      setPointsReason("");
    }
  }

  function selectCrmClient(clientId: string) {
    setSelectedCrmClientId(clientId);
    const client = data?.crmClients.find((item) => item.id === clientId);
    setManualUser({
      firstName: client?.first_name || "",
      lastName: client?.last_name || "",
      phone: client?.phone || "",
      email: client?.email || "",
    });
  }

  function closeCreateUser() {
    setShowCreateUser(false);
    setCrmClientSearch("");
    setSelectedCrmClientId("");
    setManualUser({ firstName: "", lastName: "", phone: "", email: "" });
  }

  async function createUserFromCrm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCrmClientId) {
      setError("Wybierz klienta z CRM.");
      return;
    }

    const result = await runAction<{
      ok: true;
      user: { idea_id: string; first_name: string; last_name: string };
    }>(
      {
        action: "create_user_from_crm",
        crmClientId: selectedCrmClientId,
        firstName: manualUser.firstName,
        lastName: manualUser.lastName,
        phone: manualUser.phone,
        email: manualUser.email,
      },
      "Konto klienta zostało utworzone."
    );

    if (result) {
      closeCreateUser();
      setSuccess(
        `Utworzono konto ${result.user.idea_id} dla ${result.user.first_name} ${result.user.last_name}.`
      );
    }
  }

  function editReward(reward: Reward) {
    setRewardForm({
      id: reward.id,
      categoryId: reward.category_id,
      name: reward.name,
      description: reward.description || "",
      pricePoints: String(reward.price_points),
      deliveryType: reward.delivery_type,
      isAvailable: reward.is_available,
      sortOrder: String(reward.sort_order),
    });
    setRewardImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editCategory(category: RewardCategory) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      sortOrder: String(category.sort_order),
      isVisible: category.is_visible,
    });
    setCategoryImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await runAction<{ ok: true; category: { id: string } }>(
      {
        action: "save_category",
        categoryId: categoryForm.id || undefined,
        categorySlug: categoryForm.slug || categoryForm.name,
        name: categoryForm.name,
        description: categoryForm.description,
        sortOrder: Number(categoryForm.sortOrder),
        isVisible: categoryForm.isVisible,
      },
      categoryForm.id ? "Kategoria została zaktualizowana." : "Kategoria została dodana.",
    );
    if (!result) return;
    try {
      if (categoryImage) await uploadMedia("category", result.category.id, categoryImage);
      setCategoryForm(emptyCategory);
      setCategoryImage(null);
      await loadData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kategoria została zapisana, ale grafika nie została wgrana.");
    }
  }

  async function saveReward(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await runAction<{ ok: true; reward: { id: string } }>(
      {
        action: "save_reward",
        rewardId: rewardForm.id || undefined,
        categoryId: rewardForm.categoryId,
        name: rewardForm.name,
        description: rewardForm.description,
        pricePoints: Number(rewardForm.pricePoints),
        deliveryType: rewardForm.deliveryType,
        isAvailable: rewardForm.isAvailable,
        sortOrder: Number(rewardForm.sortOrder),
      },
      rewardForm.id ? "Nagroda została zaktualizowana." : "Nagroda została dodana do katalogu."
    );
    if (!saved) return;
    try {
      if (rewardImage) await uploadMedia("reward", saved.reward.id, rewardImage);
      setRewardForm({ ...emptyReward, categoryId: data?.categories[0]?.id || "" });
      setRewardImage(null);
      await loadData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nagroda została zapisana, ale grafika nie została wgrana.");
    }
  }

  async function transitionOrder(order: RewardOrder, status: RewardOrder["status"]) {
    const body: Record<string, unknown> = {
      action: "transition_order",
      orderId: order.id,
      orderStatus: status,
    };

    if (status === "cancelled") {
      const reason = window.prompt("Podaj powód anulowania i zwrotu kWpkt:");
      if (!reason) return;
      body.reason = reason;
    }

    if (status === "shipped") {
      body.trackingNumber = window.prompt("Numer przesyłki (opcjonalnie):") || "";
      body.trackingUrl = window.prompt("Link do śledzenia (opcjonalnie):") || "";
    }

    if (!window.confirm(`Zmienić status zamówienia na „${orderStatusLabel[status]}”?`)) return;
    await runAction(body, `Status zamówienia został zmieniony na „${orderStatusLabel[status]}”.`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl animate-pulse rounded-3xl bg-white p-10 text-slate-500 dark:bg-slate-900">
          Ładowanie panelu IdeaSol Profit…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#075f70] via-[#0e7f89] to-[#21a995] p-6 text-white shadow-xl shadow-cyan-950/10 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-sm font-black tracking-tight ring-1 ring-white/25">kW</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">CRM · Administracja</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight">IdeaSol <span className="text-[#ff9a24]">Profit</span></h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-cyan-50/85">
                Uczestnicy, polecenia, kilowatopunkty, katalog nagród i realizacja zamówień w jednym miejscu.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#075f70] transition hover:bg-cyan-50"
              >
                Odśwież dane
              </button>
              <Link
                href="/admin/users"
                className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Panel CRM
              </Link>
            </div>
          </div>
        </section>

        {(error || success) && (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
              error
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            {error || success}
          </div>
        )}

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition ${
                activeTab === tab.id
                  ? "bg-[#0e6b7b] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Aktywni uczestnicy", stats.activeUsers, "konta programu"],
              ["Dostępne kWpkt", formatNumber(stats.availablePoints), "łączne saldo"],
              ["Polecenia w toku", stats.openReferrals, "wymagają realizacji"],
              ["Otwarte zamówienia", stats.openOrders, "do obsługi"],
            ].map(([label, value, note]) => (
              <article key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
                <p className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
                <p className="mt-2 text-sm text-slate-500">{note}</p>
              </article>
            ))}
            <article className="sm:col-span-2 xl:col-span-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Najpilniejsze działania</h2>
                  <p className="mt-1 text-sm text-slate-500">Pozycje, które wymagają obsługi administratora.</p>
                </div>
                <p className="text-xs text-slate-400">Stan na {formatDate(data?.generatedAt)}</p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button onClick={() => setActiveTab("orders")} className="rounded-2xl bg-amber-50 p-5 text-left text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <span className="text-2xl font-black">{data?.orders.filter((order) => order.status === "new").length || 0}</span>
                  <span className="mt-1 block text-sm font-bold">nowych zamówień</span>
                </button>
                <button onClick={() => setActiveTab("referrals")} className="rounded-2xl bg-sky-50 p-5 text-left text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                  <span className="text-2xl font-black">{stats.openReferrals}</span>
                  <span className="mt-1 block text-sm font-bold">poleceń w toku</span>
                </button>
                <button onClick={() => setActiveTab("users")} className="rounded-2xl bg-red-50 p-5 text-left text-red-900 dark:bg-red-950/30 dark:text-red-200">
                  <span className="text-2xl font-black">{data?.users.filter((user) => user.account_status === "blocked").length || 0}</span>
                  <span className="mt-1 block text-sm font-bold">zablokowanych kont</span>
                </button>
              </div>
            </article>
          </div>
        )}

        {activeTab === "users" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Uczestnicy i kilowatopunkty</h2>
                <p className="mt-1 text-sm text-slate-500">Tworzenie kont klientów, przypisanie doradców, blokady i audytowane korekty salda.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-2xl">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Szukaj po IdeaID, nazwisku lub telefonie"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none ring-[#0e6b7b] focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateUser(true)}
                  className="h-11 shrink-0 rounded-xl bg-[#0e6b7b] px-4 text-sm font-black text-white"
                >
                  Utwórz konto klienta
                </button>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1160px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <tr><th className="px-3 py-3">Uczestnik</th><th className="px-3 py-3">Doradca</th><th className="px-3 py-3">Saldo</th><th className="px-3 py-3">Oczekujące</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Nagrody</th><th className="px-3 py-3 text-right">Działania</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-4"><p className="font-black text-slate-900 dark:text-white">{user.first_name} {user.last_name}</p><p className="mt-1 text-xs text-slate-500">{user.idea_id} · {user.phone_e164}</p></td>
                      <td className="px-3 py-4">
                        <select
                          aria-label={`Doradca uczestnika ${user.idea_id}`}
                          value={user.current_seller_id || ""}
                          disabled={busy}
                          onChange={(event) => {
                            const select = event.currentTarget;
                            const sellerId = select.value || null;
                            void assignSeller(user, sellerId).then((saved) => {
                              if (!saved) select.value = user.current_seller_id || "";
                            });
                          }}
                          className="h-10 min-w-48 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#0e6b7b] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Nieprzypisany</option>
                          {(data?.sellers || []).map((seller) => (
                            <option key={seller.id} value={seller.id}>
                              {seller.first_name} {seller.last_name} · {seller.referral_code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-4 font-black text-[#0e6b7b]">{formatNumber(user.balance.available_points)} kWpkt</td>
                      <td className="px-3 py-4 text-slate-600 dark:text-slate-300">{formatNumber(user.balance.pending_points)} kWpkt</td>
                      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusTone(user.account_status)}`}>{user.account_status === "active" ? "Aktywne" : user.account_status === "blocked" ? "Zablokowane" : "Zamknięte"}</span></td>
                      <td className="px-3 py-4"><span className={user.rewards_locked ? "font-bold text-red-600" : "text-emerald-600"}>{user.rewards_locked ? "Zablokowane" : "Dostępne"}</span></td>
                      <td className="px-3 py-4"><div className="flex justify-end gap-2">
                        <button disabled={busy} onClick={() => setSelectedUser(user)} className="rounded-lg bg-[#0e6b7b] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Korekta kWpkt</button>
                        <button disabled={busy || user.account_status === "closed"} onClick={() => void updateUser(user, { accountStatus: user.account_status === "blocked" ? "active" : "blocked" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{user.account_status === "blocked" ? "Odblokuj" : "Zablokuj"}</button>
                        <button disabled={busy} onClick={() => void updateUser(user, { rewardsLocked: !user.rewards_locked })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{user.rewards_locked ? "Odblokuj nagrody" : "Zablokuj nagrody"}</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {showCreateUser && (
          <div className="fixed inset-0 z-[10020] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
            <form
              onSubmit={createUserFromCrm}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-profit-user-title"
              className="my-4 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-7"
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0e6b7b]">IdeaSol Profit</p>
              <h2 id="create-profit-user-title" className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                Utwórz konto dla klienta CRM
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Konto będzie aktywne od razu, połączone z kartą klienta i otrzyma bonus startowy programu.
              </p>

              <label className="mt-5 block text-sm font-bold" htmlFor="crm-client-search">Znajdź klienta</label>
              <input
                id="crm-client-search"
                value={crmClientSearch}
                onChange={(event) => setCrmClientSearch(event.target.value)}
                placeholder="Nazwisko, firma, telefon lub numer klienta"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#0e6b7b] dark:border-slate-700 dark:bg-slate-950"
              />
              <label className="mt-4 block text-sm font-bold" htmlFor="crm-client-select">Klient z CRM</label>
              <select
                id="crm-client-select"
                required
                size={Math.min(Math.max(filteredCrmClients.length, 3), 6)}
                value={selectedCrmClientId}
                onChange={(event) => selectCrmClient(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-[#0e6b7b] dark:border-slate-700 dark:bg-slate-950"
              >
                {filteredCrmClients.map((client) => (
                  <option key={client.id} value={client.id} disabled={Boolean(client.profit_user)}>
                    {client.display_name}
                    {client.company_name ? ` · ${client.company_name}` : ""}
                    {client.phone ? ` · ${client.phone}` : ""}
                    {client.profit_user ? ` · konto ${client.profit_user.idea_id} już istnieje` : ""}
                  </option>
                ))}
              </select>
              {filteredCrmClients.length === 0 && (
                <p className="mt-2 text-sm text-amber-600">Nie znaleziono klienta spełniającego kryteria.</p>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold" htmlFor="profit-first-name">Imię</label>
                  <input id="profit-first-name" required value={manualUser.firstName} onChange={(event) => setManualUser((current) => ({ ...current, firstName: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div>
                  <label className="block text-sm font-bold" htmlFor="profit-last-name">Nazwisko</label>
                  <input id="profit-last-name" required value={manualUser.lastName} onChange={(event) => setManualUser((current) => ({ ...current, lastName: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div>
                  <label className="block text-sm font-bold" htmlFor="profit-phone">Telefon do logowania</label>
                  <input id="profit-phone" required inputMode="tel" value={manualUser.phone} onChange={(event) => setManualUser((current) => ({ ...current, phone: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div>
                  <label className="block text-sm font-bold" htmlFor="profit-email">E-mail (opcjonalnie)</label>
                  <input id="profit-email" type="email" value={manualUser.email} onChange={(event) => setManualUser((current) => ({ ...current, email: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 dark:border-slate-700 dark:bg-slate-950" />
                </div>
              </div>

              <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500 dark:bg-slate-800/60">
                Klient zaloguje się numerem telefonu i kodem SMS. Zgody marketingowe pozostaną wyłączone.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={closeCreateUser} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Anuluj</button>
                <button type="submit" disabled={busy || !selectedCrmClientId} className="rounded-xl bg-[#0e6b7b] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
                  {busy ? "Tworzenie…" : "Utwórz konto"}
                </button>
              </div>
            </form>
          </div>
        )}

        {selectedUser && (
          <div className="fixed inset-0 z-[10020] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0e6b7b]">Korekta salda</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{selectedUser.first_name} {selectedUser.last_name}</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedUser.idea_id} · dostępne {formatNumber(selectedUser.balance.available_points)} kWpkt</p>
              <label className="mt-5 block text-sm font-bold">Zmiana kWpkt</label>
              <input value={pointsValue} onChange={(event) => setPointsValue(event.target.value)} placeholder="np. 5000 lub -2000" inputMode="numeric" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-lg font-black outline-none focus:ring-2 focus:ring-[#0e6b7b] dark:border-slate-700 dark:bg-slate-950" />
              <label className="mt-4 block text-sm font-bold">Powód korekty</label>
              <textarea value={pointsReason} onChange={(event) => setPointsReason(event.target.value)} rows={3} placeholder="Powód zostanie zapisany w logu audytowym" className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-[#0e6b7b] dark:border-slate-700 dark:bg-slate-950" />
              <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelectedUser(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">Anuluj</button><button type="button" disabled={busy} onClick={() => void adjustPoints()} className="rounded-xl bg-[#0e6b7b] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">Zapisz korektę</button></div>
            </div>
          </div>
        )}

        {activeTab === "referrals" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">Polecenia Profit</h2>
            <p className="mt-1 text-sm text-slate-500">Status klienta w CRM oraz naliczenia wynikające z realizacji.</p>
            <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800"><tr><th className="px-3 py-3">Polecający</th><th className="px-3 py-3">Polecony klient</th><th className="px-3 py-3">Produkt</th><th className="px-3 py-3">CRM</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Data</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{(data?.referrals || []).map((referral) => <tr key={referral.id}><td className="px-3 py-4"><p className="font-black">{referral.referrer_first_name} {referral.referrer_last_name}</p><p className="mt-1 text-xs text-slate-500">{referral.referrer_idea_id}</p></td><td className="px-3 py-4 font-bold">{referral.referred_first_name} {referral.referred_last_name}</td><td className="px-3 py-4">{referral.product === "pv" ? "Fotowoltaika" : referral.product === "me" ? "Magazyn energii" : "PV + magazyn"}</td><td className="px-3 py-4">{referral.crm_lead_id ? <a href={`/clients/${referral.crm_lead_id}`} className="font-bold text-blue-600 hover:underline">Otwórz klienta</a> : <span className="text-amber-600">Oczekuje na CRM</span>}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusTone(referral.status)}`}>{referralStatusLabel[referral.status]}</span></td><td className="px-3 py-4 text-slate-500">{formatDate(referral.registered_at)}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {activeTab === "rewards" && (
          <div className="space-y-5">
            <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <form onSubmit={saveCategory} className="h-fit rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">{categoryForm.id ? "Edytuj kategorię" : "Nowa kategoria"}</h2>
                  {categoryForm.id && <button type="button" onClick={() => { setCategoryForm(emptyCategory); setCategoryImage(null); }} className="text-xs font-bold text-slate-500">Wyczyść</button>}
                </div>
                <label className="mt-5 block text-sm font-bold">Nazwa</label>
                <input required value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" />
                <label className="mt-4 block text-sm font-bold">Opis</label>
                <textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-bold">Adres</label><input value={categoryForm.slug} onChange={(event) => setCategoryForm((current) => ({ ...current, slug: event.target.value }))} placeholder="tworzy się z nazwy" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></div>
                  <div><label className="block text-sm font-bold">Kolejność</label><input required type="number" min="0" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></div>
                </div>
                <label className="mt-4 block text-sm font-bold">Grafika kategorii</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setCategoryImage(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:font-bold file:text-[#0e6b7b]" />
                <p className="mt-2 text-xs text-slate-400">JPG, PNG, WebP lub GIF, maksymalnie 5 MB.</p>
                <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={categoryForm.isVisible} onChange={(event) => setCategoryForm((current) => ({ ...current, isVisible: event.target.checked }))} className="h-4 w-4" />Widoczna w katalogu</label>
                <button disabled={busy} className="mt-6 w-full rounded-xl bg-[#0e6b7b] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{categoryForm.id ? "Zapisz kategorię" : "Dodaj kategorię"}</button>
              </form>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-2xl font-black">Kategorie nagród</h2>
                <p className="mt-1 text-sm text-slate-500">Grafika kategorii jest wyświetlana jako baner nad jej nagrodami.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data?.categories.map((category) => (
                    <article key={category.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="relative h-28 bg-gradient-to-br from-cyan-100 to-emerald-50 dark:from-cyan-950 dark:to-slate-900">
                        {category.image_url ? <Image src={category.image_url} alt={category.name} fill sizes="320px" className="object-cover" /> : null}
                      </div>
                      <div className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-black">{category.name}</h3><span className={`h-2.5 w-2.5 rounded-full ${category.is_visible ? "bg-emerald-500" : "bg-slate-300"}`} /></div><p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">{category.description || "Brak opisu"}</p><button type="button" onClick={() => editCategory(category)} className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">Edytuj</button></div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <form onSubmit={saveReward} className="h-fit rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between"><h2 className="text-xl font-black">{rewardForm.id ? "Edytuj nagrodę" : "Nowa nagroda"}</h2>{rewardForm.id && <button type="button" onClick={() => { setRewardForm({ ...emptyReward, categoryId: data?.categories[0]?.id || "" }); setRewardImage(null); }} className="text-xs font-bold text-slate-500">Wyczyść</button>}</div>
                <label className="mt-5 block text-sm font-bold">Kategoria</label><select required value={rewardForm.categoryId} onChange={(event) => setRewardForm((current) => ({ ...current, categoryId: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"><option value="">Wybierz kategorię</option>{data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                <label className="mt-4 block text-sm font-bold">Nazwa</label><input required value={rewardForm.name} onChange={(event) => setRewardForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" />
                <label className="mt-4 block text-sm font-bold">Opis</label><textarea value={rewardForm.description} onChange={(event) => setRewardForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950" />
                <div className="mt-4 grid grid-cols-2 gap-3"><div><label className="block text-sm font-bold">Cena kWpkt</label><input required type="number" min="1" value={rewardForm.pricePoints} onChange={(event) => setRewardForm((current) => ({ ...current, pricePoints: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></div><div><label className="block text-sm font-bold">Kolejność</label><input required type="number" min="0" value={rewardForm.sortOrder} onChange={(event) => setRewardForm((current) => ({ ...current, sortOrder: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" /></div></div>
                <label className="mt-4 block text-sm font-bold">Dostawa</label><select value={rewardForm.deliveryType} onChange={(event) => setRewardForm((current) => ({ ...current, deliveryType: event.target.value as "digital" | "physical" }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"><option value="physical">Wysyłka fizyczna</option><option value="digital">Nagroda cyfrowa</option></select>
                <label className="mt-4 block text-sm font-bold">Zdjęcie nagrody</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setRewardImage(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:font-bold file:text-[#0e6b7b]" />
                <p className="mt-2 text-xs text-slate-400">JPG, PNG, WebP lub GIF, maksymalnie 5 MB.</p>
                <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={rewardForm.isAvailable} onChange={(event) => setRewardForm((current) => ({ ...current, isAvailable: event.target.checked }))} className="h-4 w-4" />Widoczna i dostępna</label>
                <button disabled={busy} className="mt-6 w-full rounded-xl bg-[#0e6b7b] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{rewardForm.id ? "Zapisz zmiany" : "Dodaj nagrodę"}</button>
              </form>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-2xl font-black">Katalog nagród</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data?.rewards.map((reward) => <article key={reward.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"><div className="relative h-32 bg-gradient-to-br from-cyan-100 to-emerald-50 dark:from-cyan-950 dark:to-slate-900">{reward.image_url ? <Image src={reward.image_url} alt={reward.name} fill sizes="320px" className="object-cover" /> : null}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#0e6b7b]">{reward.reward_categories?.name || "Bez kategorii"}</p><h3 className="mt-2 text-lg font-black">{reward.name}</h3></div><span className={`h-2.5 w-2.5 rounded-full ${reward.is_available ? "bg-emerald-500" : "bg-slate-300"}`} /></div><p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-500">{reward.description || "Brak opisu"}</p><p className="mt-4 text-xl font-black text-[#0e6b7b]">{formatNumber(reward.price_points)} kWpkt</p><button type="button" onClick={() => editReward(reward)} className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">Edytuj</button></div></article>)}</div></div>
            </section>
          </div>
        )}

        {activeTab === "orders" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-black">Zamówienia nagród</h2>
            <div className="mt-5 space-y-3">{data?.orders.length ? data.orders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{order.profit_users?.first_name} {order.profit_users?.last_name}</h3><span className="text-xs text-slate-500">{order.profit_users?.idea_id}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusTone(order.status)}`}>{orderStatusLabel[order.status]}</span></div><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{order.reward_order_items.map((item) => `${item.reward_name_snapshot} × ${item.quantity}`).join(", ") || "Nagroda"}</p><p className="mt-2 text-sm font-black text-[#0e6b7b]">{formatNumber(order.total_points)} kWpkt · {formatDate(order.created_at)}</p></div><div className="flex flex-wrap gap-2">{order.status === "new" && <button disabled={busy} onClick={() => void transitionOrder(order, "approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Zatwierdź</button>}{order.status === "approved" && <button disabled={busy} onClick={() => void transitionOrder(order, "processing")} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white">Rozpocznij realizację</button>}{order.status === "processing" && <button disabled={busy} onClick={() => void transitionOrder(order, "shipped")} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white">Oznacz jako wysłane</button>}{["approved", "processing", "shipped"].includes(order.status) && <button disabled={busy} onClick={() => void transitionOrder(order, "completed")} className="rounded-lg bg-[#0e6b7b] px-3 py-2 text-xs font-black text-white">Zakończ</button>}{!["completed", "cancelled"].includes(order.status) && <button disabled={busy} onClick={() => void transitionOrder(order, "cancelled")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600">Anuluj</button>}</div></div></article>) : <p className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500 dark:bg-slate-800/50">Brak zamówień nagród.</p>}</div>
          </section>
        )}
      </div>
    </main>
  );
}
