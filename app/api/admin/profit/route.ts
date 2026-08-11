import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  getProfitAdminClient,
  ProfitConfigurationError,
} from "@/lib/profit/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfitActionInput = {
  action?: string;
  userId?: string;
  accountStatus?: "active" | "blocked";
  rewardsLocked?: boolean;
  points?: number;
  reason?: string;
  rewardId?: string;
  categoryId?: string;
  categorySlug?: string;
  name?: string;
  description?: string;
  pricePoints?: number;
  deliveryType?: "digital" | "physical";
  isAvailable?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
  orderId?: string;
  orderStatus?: "approved" | "processing" | "shipped" | "completed" | "cancelled";
  trackingNumber?: string;
  trackingUrl?: string;
  crmClientId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
};

function errorMessage(error: unknown) {
  if (error instanceof ProfitConfigurationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Nieznany błąd połączenia z IdeaSol Profit.";
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    cleanText(value)
  );
}

function normalizePhone(value: unknown) {
  const raw = cleanText(value);
  const digits = raw.replace(/\D/g, "");

  if (/^[0-9]{9}$/.test(digits)) return `+48${digits}`;
  if (/^48[0-9]{9}$/.test(digits)) return `+${digits}`;
  if (/^00[1-9][0-9]{7,14}$/.test(digits)) return `+${digits.slice(2)}`;
  if (raw.startsWith("+") && /^[1-9][0-9]{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}

function splitCustomerName(value: unknown) {
  const parts = cleanText(value).split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}

async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
}) {
  const profit = getProfitAdminClient();
  const { error } = await profit.from("audit_log").insert({
    actor_type: "crm_admin",
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    reason: input.reason || null,
  });

  if (error) throw error;
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const profit = getProfitAdminClient();
    const [
      usersResult,
      balancesResult,
      referralsResult,
      ordersResult,
      rewardsResult,
      categoriesResult,
      crmClientsResult,
    ] = await Promise.all([
      profit
        .from("profit_users")
        .select(
          "id,idea_id,first_name,last_name,phone_e164,email,account_status,rewards_locked,joined_at,crm_client_id,crm_link_status,is_ideasol_customer,last_points_earned_at,points_expire_at"
        )
        .order("joined_at", { ascending: false })
        .limit(300),
      profit
        .from("user_points_balances")
        .select("user_id,available_points,pending_points,reserved_points"),
      profit
        .from("referral_admin_overview")
        .select(
          "id,registered_at,status,qualification_expires_at,product,referred_first_name,referred_last_name,crm_lead_id,crm_sale_id,referrer_idea_id,referrer_first_name,referrer_last_name,source_seller_first_name,source_seller_last_name,sale_signed_at,installation_completed_at,fully_paid_at,withdrawal_period_ends_at,final_pv_kwp"
        )
        .order("registered_at", { ascending: false })
        .limit(300),
      profit
        .from("reward_orders")
        .select(
          "id,user_id,status,total_points,delivery_type,recipient_first_name,recipient_last_name,tracking_number,tracking_url,admin_note,created_at,updated_at,profit_users!reward_orders_user_id_fkey(idea_id,first_name,last_name),reward_order_items(reward_name_snapshot,quantity,line_points)"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      profit
        .from("rewards")
        .select(
          "id,category_id,name,description,image_path,price_points,delivery_type,is_available,sort_order,archived_at,created_at,updated_at,reward_categories!rewards_category_id_fkey(name,slug)"
        )
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      profit
        .from("reward_categories")
        .select("id,name,slug,description,image_path,sort_order,is_visible")
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("clients")
        .select(
          "id,public_id,full_name,company_name,contact_person,phone,contact_phone,email,status,is_lead"
        )
        .order("full_name", { ascending: true })
        .limit(1000),
    ]);

    const firstError = [
      usersResult.error,
      balancesResult.error,
      referralsResult.error,
      ordersResult.error,
      rewardsResult.error,
      categoriesResult.error,
      crmClientsResult.error,
    ].find(Boolean);

    if (firstError) throw firstError;

    const balances = new Map(
      (balancesResult.data || []).map((balance) => [balance.user_id, balance])
    );
    const users = (usersResult.data || []).map((user) => ({
      ...user,
      balance: balances.get(user.id) || {
        user_id: user.id,
        available_points: 0,
        pending_points: 0,
        reserved_points: 0,
      },
    }));
    const profitUserByCrmClient = new Map(
      users
        .filter((user) => user.crm_client_id)
        .map((user) => [user.crm_client_id as string, user])
    );
    const crmClients = (crmClientsResult.data || [])
      .filter((client) => client.is_lead === false || client.status === "Klient aktywny")
      .map((client) => {
        const customerName = cleanText(client.full_name) || cleanText(client.contact_person);
        const parsedName = splitCustomerName(customerName);
        const linkedUser = profitUserByCrmClient.get(client.id);
        return {
          id: client.id,
          public_id: client.public_id,
          display_name: customerName || cleanText(client.company_name) || "Klient bez nazwy",
          company_name: cleanText(client.company_name) || null,
          first_name: parsedName.firstName,
          last_name: parsedName.lastName,
          phone: cleanText(client.phone) || cleanText(client.contact_phone),
          email: cleanText(client.email) || null,
          status: client.status,
          profit_user: linkedUser
            ? { id: linkedUser.id, idea_id: linkedUser.idea_id }
            : null,
        };
      });

    const mediaBaseUrl = `${process.env.PROFIT_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/profit-reward-media/`;
    const withMediaUrl = <T extends { image_path?: string | null }>(item: T) => ({
      ...item,
      image_url: item.image_path ? `${mediaBaseUrl}${item.image_path.split("/").map(encodeURIComponent).join("/")}` : null,
    });

    return NextResponse.json({
      ok: true,
      users,
      referrals: referralsResult.data || [],
      orders: ordersResult.data || [],
      rewards: (rewardsResult.data || []).map(withMediaUrl),
      categories: (categoriesResult.data || []).map(withMediaUrl),
      crmClients,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Błąd pobierania panelu IdeaSol Profit", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: error instanceof ProfitConfigurationError ? 503 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRequest(request);

  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const input = (await request.json()) as ProfitActionInput;
    const profit = getProfitAdminClient();

    if (input.action === "create_user_from_crm") {
      if (!isUuid(input.crmClientId)) {
        return NextResponse.json({ ok: false, error: "Wybierz klienta z CRM." }, { status: 400 });
      }

      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id,full_name,contact_person,phone,contact_phone,email,status,is_lead")
        .eq("id", input.crmClientId)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client) {
        return NextResponse.json(
          { ok: false, error: "Nie znaleziono tego klienta w CRM." },
          { status: 404 }
        );
      }

      const parsedName = splitCustomerName(client.full_name || client.contact_person);
      const firstName = cleanText(input.firstName) || parsedName.firstName;
      const lastName = cleanText(input.lastName) || parsedName.lastName;
      const phone = normalizePhone(input.phone || client.phone || client.contact_phone);
      const email = cleanText(input.email ?? client.email).toLowerCase();

      if (firstName.length < 2 || firstName.length > 80 || lastName.length < 2 || lastName.length > 120) {
        return NextResponse.json(
          { ok: false, error: "Podaj poprawne imię i nazwisko uczestnika." },
          { status: 400 }
        );
      }
      if (!phone) {
        return NextResponse.json(
          { ok: false, error: "Podaj poprawny numer telefonu klienta." },
          { status: 400 }
        );
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { ok: false, error: "Podaj poprawny adres e-mail albo pozostaw pole puste." },
          { status: 400 }
        );
      }

      const { data: userId, error } = await profit.rpc("admin_create_profit_user_from_crm", {
        p_crm_client_id: client.id,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone_e164: phone,
        p_email: email || null,
        p_actor: admin.id,
      });

      if (error?.message.includes("CRM_CLIENT_ALREADY_REGISTERED")) {
        return NextResponse.json(
          { ok: false, error: "Ten klient ma już konto w IdeaSol Profit." },
          { status: 409 }
        );
      }
      if (error?.message.includes("PHONE_ALREADY_REGISTERED")) {
        return NextResponse.json(
          { ok: false, error: "Konto z tym numerem telefonu już istnieje." },
          { status: 409 }
        );
      }
      if (error?.message.includes("EMAIL_ALREADY_REGISTERED")) {
        return NextResponse.json(
          { ok: false, error: "Konto z tym adresem e-mail już istnieje." },
          { status: 409 }
        );
      }
      if (error) throw error;

      const { data: user, error: userError } = await profit
        .from("profit_users")
        .select("id,idea_id,first_name,last_name,phone_e164,email")
        .eq("id", userId)
        .single();
      if (userError) throw userError;

      return NextResponse.json({ ok: true, user });
    }

    if (input.action === "update_user") {
      if (!isUuid(input.userId)) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowy użytkownik." }, { status: 400 });
      }

      if (input.accountStatus && !["active", "blocked"].includes(input.accountStatus)) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowy status konta." }, { status: 400 });
      }

      const { data: before, error: beforeError } = await profit
        .from("profit_users")
        .select("id,account_status,rewards_locked")
        .eq("id", input.userId)
        .maybeSingle();

      if (beforeError) throw beforeError;
      if (!before) {
        return NextResponse.json({ ok: false, error: "Nie znaleziono użytkownika." }, { status: 404 });
      }

      const changes: Record<string, unknown> = {};
      if (input.accountStatus) changes.account_status = input.accountStatus;
      if (typeof input.rewardsLocked === "boolean") changes.rewards_locked = input.rewardsLocked;

      if (Object.keys(changes).length === 0) {
        return NextResponse.json({ ok: false, error: "Brak zmian do zapisania." }, { status: 400 });
      }

      const { data: after, error } = await profit
        .from("profit_users")
        .update(changes)
        .eq("id", input.userId)
        .select("id,account_status,rewards_locked")
        .single();

      if (error) throw error;
      await writeAuditLog({
        actorId: admin.id,
        action: "profit_user_updated",
        entityType: "profit_user",
        entityId: input.userId,
        beforeData: before,
        afterData: after,
      });

      return NextResponse.json({ ok: true });
    }

    if (input.action === "adjust_points") {
      if (!isUuid(input.userId)) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowy użytkownik." }, { status: 400 });
      }

      const points = Number(input.points);
      const reason = cleanText(input.reason);

      if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1_000_000) {
        return NextResponse.json(
          { ok: false, error: "Korekta musi być pełną liczbą od -1 000 000 do 1 000 000 kWpkt." },
          { status: 400 }
        );
      }
      if (reason.length < 5 || reason.length > 500) {
        return NextResponse.json(
          { ok: false, error: "Podaj powód korekty (od 5 do 500 znaków)." },
          { status: 400 }
        );
      }

      const { error } = await profit.rpc("admin_adjust_points", {
        p_user_id: input.userId,
        p_points: points,
        p_reason: reason,
        p_actor: admin.id,
      });

      if (error?.message.includes("INSUFFICIENT_AVAILABLE_POINTS")) {
        return NextResponse.json(
          { ok: false, error: "Nie można obniżyć dostępnego salda poniżej zera." },
          { status: 400 }
        );
      }
      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    if (input.action === "save_reward") {
      const name = cleanText(input.name);
      const description = cleanText(input.description);
      const pricePoints = Number(input.pricePoints);
      const sortOrder = Number(input.sortOrder || 0);

      if (!isUuid(input.categoryId) || (input.rewardId && !isUuid(input.rewardId))) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowa nagroda lub kategoria." }, { status: 400 });
      }
      if (name.length < 2 || name.length > 160) {
        return NextResponse.json({ ok: false, error: "Nazwa nagrody musi mieć od 2 do 160 znaków." }, { status: 400 });
      }
      if (!Number.isInteger(pricePoints) || pricePoints <= 0 || pricePoints > 10_000_000) {
        return NextResponse.json({ ok: false, error: "Podaj prawidłową cenę w kWpkt." }, { status: 400 });
      }
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowa kolejność nagrody." }, { status: 400 });
      }
      if (!input.deliveryType || !["digital", "physical"].includes(input.deliveryType)) {
        return NextResponse.json({ ok: false, error: "Wybierz sposób dostawy." }, { status: 400 });
      }

      const rewardData = {
        category_id: input.categoryId,
        name,
        description: description || null,
        price_points: pricePoints,
        delivery_type: input.deliveryType,
        is_available: input.isAvailable !== false,
        sort_order: sortOrder,
      };

      let before: unknown = null;
      let reward;

      if (input.rewardId) {
        const beforeResult = await profit.from("rewards").select("*").eq("id", input.rewardId).maybeSingle();
        if (beforeResult.error) throw beforeResult.error;
        if (!beforeResult.data) {
          return NextResponse.json({ ok: false, error: "Nie znaleziono nagrody." }, { status: 404 });
        }
        before = beforeResult.data;
        const updateResult = await profit
          .from("rewards")
          .update(rewardData)
          .eq("id", input.rewardId)
          .select("*")
          .single();
        if (updateResult.error) throw updateResult.error;
        reward = updateResult.data;
      } else {
        const insertResult = await profit.from("rewards").insert(rewardData).select("*").single();
        if (insertResult.error) throw insertResult.error;
        reward = insertResult.data;
      }

      await writeAuditLog({
        actorId: admin.id,
        action: input.rewardId ? "reward_updated" : "reward_created",
        entityType: "reward",
        entityId: reward.id,
        beforeData: before,
        afterData: reward,
      });

      return NextResponse.json({ ok: true, reward });
    }

    if (input.action === "save_category") {
      const name = cleanText(input.name);
      const description = cleanText(input.description);
      const sortOrder = Number(input.sortOrder || 0);
      const requestedSlug = cleanText(input.categorySlug)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);

      if (input.categoryId && !isUuid(input.categoryId)) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowa kategoria." }, { status: 400 });
      }
      if (name.length < 2 || name.length > 120) {
        return NextResponse.json({ ok: false, error: "Nazwa kategorii musi mieć od 2 do 120 znaków." }, { status: 400 });
      }
      if (!requestedSlug) {
        return NextResponse.json({ ok: false, error: "Nie udało się utworzyć adresu kategorii z tej nazwy." }, { status: 400 });
      }
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowa kolejność kategorii." }, { status: 400 });
      }

      const categoryData = {
        name,
        slug: requestedSlug,
        description: description || null,
        sort_order: sortOrder,
        is_visible: input.isVisible !== false,
      };
      let before: unknown = null;
      let category;

      if (input.categoryId) {
        const beforeResult = await profit.from("reward_categories").select("*").eq("id", input.categoryId).maybeSingle();
        if (beforeResult.error) throw beforeResult.error;
        if (!beforeResult.data) {
          return NextResponse.json({ ok: false, error: "Nie znaleziono kategorii." }, { status: 404 });
        }
        before = beforeResult.data;
        const updateResult = await profit
          .from("reward_categories")
          .update(categoryData)
          .eq("id", input.categoryId)
          .select("*")
          .single();
        if (updateResult.error) throw updateResult.error;
        category = updateResult.data;
      } else {
        const insertResult = await profit.from("reward_categories").insert(categoryData).select("*").single();
        if (insertResult.error?.code === "23505") {
          return NextResponse.json({ ok: false, error: "Kategoria o takim adresie już istnieje." }, { status: 409 });
        }
        if (insertResult.error) throw insertResult.error;
        category = insertResult.data;
      }

      await writeAuditLog({
        actorId: admin.id,
        action: input.categoryId ? "reward_category_updated" : "reward_category_created",
        entityType: "reward_category",
        entityId: category.id,
        beforeData: before,
        afterData: category,
      });

      return NextResponse.json({ ok: true, category });
    }

    if (input.action === "transition_order") {
      if (!isUuid(input.orderId) || !input.orderStatus) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowe zamówienie." }, { status: 400 });
      }

      const { data: order, error: orderError } = await profit
        .from("reward_orders")
        .select("id,status,tracking_number,tracking_url")
        .eq("id", input.orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        return NextResponse.json({ ok: false, error: "Nie znaleziono zamówienia." }, { status: 404 });
      }

      if (input.orderStatus === "approved") {
        const { error } = await profit.rpc("approve_reward_order", {
          p_order_id: input.orderId,
          p_actor: admin.id,
        });
        if (error) throw error;
      } else if (input.orderStatus === "completed") {
        const { error } = await profit.rpc("complete_reward_order", {
          p_order_id: input.orderId,
          p_actor: admin.id,
        });
        if (error) throw error;
      } else if (input.orderStatus === "cancelled") {
        const reason = cleanText(input.reason);
        if (reason.length < 5) {
          return NextResponse.json({ ok: false, error: "Podaj powód anulowania." }, { status: 400 });
        }
        const { error } = await profit.rpc("cancel_reward_order_and_release_points", {
          p_order_id: input.orderId,
          p_reason: reason,
          p_actor: admin.id,
        });
        if (error) throw error;
      } else {
        const allowedTransition =
          (input.orderStatus === "processing" && order.status === "approved") ||
          (input.orderStatus === "shipped" && order.status === "processing");

        if (!allowedTransition) {
          return NextResponse.json(
            { ok: false, error: "Ta zmiana statusu zamówienia nie jest dozwolona." },
            { status: 400 }
          );
        }

        const now = new Date().toISOString();
        const changes =
          input.orderStatus === "processing"
            ? { status: "processing", processing_at: now }
            : {
                status: "shipped",
                shipped_at: now,
                tracking_number: cleanText(input.trackingNumber) || null,
                tracking_url: cleanText(input.trackingUrl) || null,
              };
        const { data: after, error } = await profit
          .from("reward_orders")
          .update(changes)
          .eq("id", input.orderId)
          .select("id,status,tracking_number,tracking_url")
          .single();
        if (error) throw error;

        await writeAuditLog({
          actorId: admin.id,
          action: `reward_order_${input.orderStatus}`,
          entityType: "reward_order",
          entityId: input.orderId,
          beforeData: order,
          afterData: after,
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Nieznana operacja." }, { status: 400 });
  } catch (error) {
    console.error("Błąd operacji administratora IdeaSol Profit", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: error instanceof ProfitConfigurationError ? 503 : 500 }
    );
  }
}
