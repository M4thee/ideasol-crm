import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getProfitAdminClient } from "@/lib/profit/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerLinkPayload = {
  profitUserId?: string;
};

function cleanText(value: unknown, maxLength = 100) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isUuid(value: unknown): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    cleanText(value, 36)
  );
}

function isAuthorized(request: Request) {
  const configuredToken = process.env.PROFIT_API_TOKEN?.trim();
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!configuredToken || !suppliedToken) return false;

  const configured = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

async function attachProfitTag(clientId: string) {
  const { data: tag, error: tagError } = await supabaseAdmin
    .from("client_tags")
    .upsert(
      {
        name: "PROFIT",
        color: "#0e6b7b",
        is_active: true,
        is_system: true,
      },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (tagError) throw tagError;

  const { error: linkError } = await supabaseAdmin.from("client_tag_links").upsert(
    { client_id: clientId, tag_id: tag.id },
    { onConflict: "client_id,tag_id" }
  );
  if (linkError) throw linkError;
}

async function recordAudit(
  profitUserId: string,
  action: string,
  data: Record<string, unknown>
) {
  const profit = getProfitAdminClient();
  const { error } = await profit.from("audit_log").insert({
    actor_type: "system",
    action,
    entity_type: "profit_user",
    entity_id: profitUserId,
    after_data: data,
    reason: "Automatyczna synchronizacja samodzielnej rejestracji Profit z CRM",
  });
  if (error) console.error("Nie udało się zapisać audytu połączenia Profit z CRM", error);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as CustomerLinkPayload;
  if (!isUuid(payload.profitUserId)) {
    return NextResponse.json({ ok: false, error: "Invalid Profit user ID" }, { status: 400 });
  }

  try {
    const profit = getProfitAdminClient();
    const { data: profitUser, error: profitUserError } = await profit
      .from("profit_users")
      .select("id,phone_e164,crm_client_id,crm_link_status")
      .eq("id", payload.profitUserId)
      .maybeSingle();

    if (profitUserError) throw profitUserError;
    if (!profitUser) {
      return NextResponse.json({ ok: false, error: "Profit user not found" }, { status: 404 });
    }

    if (profitUser.crm_client_id) {
      if (profitUser.crm_link_status !== "linked") {
        const { error } = await profit
          .from("profit_users")
          .update({ crm_link_status: "linked", is_ideasol_customer: true })
          .eq("id", profitUser.id)
          .eq("crm_client_id", profitUser.crm_client_id);
        if (error) throw error;
      }
      await attachProfitTag(profitUser.crm_client_id);
      return NextResponse.json({
        ok: true,
        match: "linked",
        crmClientId: profitUser.crm_client_id,
        idempotentReplay: true,
      });
    }

    const { data: matches, error: matchError } = await supabaseAdmin.rpc(
      "find_crm_client_ids_by_phone",
      { p_phone: profitUser.phone_e164 }
    );
    if (matchError) throw matchError;

    const clientIds: string[] = [];
    for (const match of matches ?? []) {
      const clientId = cleanText((match as { client_id?: unknown }).client_id, 36);
      if (isUuid(clientId) && !clientIds.includes(clientId)) clientIds.push(clientId);
    }

    if (clientIds.length === 0) {
      if (profitUser.crm_link_status !== "unlinked") {
        const { error } = await profit
          .from("profit_users")
          .update({ crm_link_status: "unlinked" })
          .eq("id", profitUser.id)
          .is("crm_client_id", null);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true, match: "not_found" });
    }

    if (clientIds.length > 1) {
      const { error } = await profit
        .from("profit_users")
        .update({ crm_link_status: "verification_required" })
        .eq("id", profitUser.id)
        .is("crm_client_id", null);
      if (error) throw error;

      if (profitUser.crm_link_status !== "verification_required") {
        await recordAudit(profitUser.id, "profit_user_crm_link_requires_verification", {
          match_count: clientIds.length,
        });
      }
      return NextResponse.json({ ok: true, match: "verification_required" });
    }

    const crmClientId = clientIds[0];
    const { error: updateError } = await profit
      .from("profit_users")
      .update({
        crm_client_id: crmClientId,
        crm_link_status: "linked",
        is_ideasol_customer: true,
      })
      .eq("id", profitUser.id)
      .is("crm_client_id", null);

    if (updateError?.code === "23505") {
      const { error: conflictStatusError } = await profit
        .from("profit_users")
        .update({ crm_link_status: "verification_required" })
        .eq("id", profitUser.id)
        .is("crm_client_id", null);
      if (conflictStatusError) throw conflictStatusError;
      await recordAudit(profitUser.id, "profit_user_crm_link_conflict", {
        match_count: 1,
      });
      return NextResponse.json({ ok: true, match: "verification_required" });
    }
    if (updateError) throw updateError;

    await attachProfitTag(crmClientId);
    await recordAudit(profitUser.id, "profit_user_linked_to_crm_after_self_registration", {
      crm_client_id: crmClientId,
    });

    return NextResponse.json({ ok: true, match: "linked", crmClientId });
  } catch (error) {
    console.error("Automatyczne łączenie konta Profit z CRM nie powiodło się", error);
    return NextResponse.json(
      { ok: false, error: "Profit customer link failed" },
      { status: 500 }
    );
  }
}
