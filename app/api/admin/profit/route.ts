import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  getProfitAdminClient,
  ProfitConfigurationError,
} from "@/lib/profit/admin";

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
  name?: string;
  description?: string;
  pricePoints?: number;
  deliveryType?: "digital" | "physical";
  isAvailable?: boolean;
  sortOrder?: number;
  orderId?: string;
  orderStatus?: "approved" | "processing" | "shipped" | "completed" | "cancelled";
  trackingNumber?: string;
  trackingUrl?: string;
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
    ] = await Promise.all([
      profit
        .from("profit_users")
        .select(
          "id,idea_id,first_name,last_name,phone_e164,email,account_status,rewards_locked,joined_at,crm_link_status,is_ideasol_customer,last_points_earned_at,points_expire_at"
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
        .select("id,name,slug,description,sort_order,is_visible")
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
    ]);

    const firstError = [
      usersResult.error,
      balancesResult.error,
      referralsResult.error,
      ordersResult.error,
      rewardsResult.error,
      categoriesResult.error,
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

    return NextResponse.json({
      ok: true,
      users,
      referrals: referralsResult.data || [],
      orders: ordersResult.data || [],
      rewards: rewardsResult.data || [],
      categories: categoriesResult.data || [],
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
