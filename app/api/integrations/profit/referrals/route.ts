import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfitReferralPayload = {
  referralId?: string;
  referrerIdeaId?: string;
  referrerName?: string;
  sellerCrmUserId?: string;
  source?: string;
  tag?: string;
  prospect?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    product?: "PV" | "ME" | "PV_ME";
    phoneContactConsent?: boolean;
    marketingSmsConsent?: boolean;
    marketingEmailConsent?: boolean;
    marketingConsentVersion?: string;
  };
};

function cleanText(value: unknown, maxLength = 500) {
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

function normalizePhone(value: unknown) {
  const digits = cleanText(value, 40).replace(/\D/g, "");
  if (digits.length === 9) return `+48${digits}`;
  if (digits.length === 11 && digits.startsWith("48")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function phoneVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length >= 9 ? digits.slice(-9) : digits;
  return [...new Set([phone, digits, local, local ? `0${local}` : "", local ? `48${local}` : "", local ? `+48${local}` : ""].filter(Boolean))];
}

function productLabel(product: "PV" | "ME" | "PV_ME" | undefined) {
  if (product === "PV") return "Fotowoltaika";
  if (product === "ME") return "Magazyn energii";
  return "Fotowoltaika + magazyn energii";
}

async function findDuplicate(phone: string, email: string) {
  const phoneResult = await supabaseAdmin
    .from("clients")
    .select("id,assigned_user_id")
    .in("phone", phoneVariants(phone))
    .limit(1)
    .maybeSingle();

  if (phoneResult.error) throw phoneResult.error;
  if (phoneResult.data) return phoneResult.data;
  if (!email) return null;

  const emailResult = await supabaseAdmin
    .from("clients")
    .select("id,assigned_user_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (emailResult.error) throw emailResult.error;
  return emailResult.data || null;
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

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as ProfitReferralPayload;
  const referralId = cleanText(payload.referralId, 36);
  const firstName = cleanText(payload.prospect?.firstName, 100);
  const lastName = cleanText(payload.prospect?.lastName, 100);
  const phone = normalizePhone(payload.prospect?.phone);
  const email = cleanText(payload.prospect?.email, 320).toLowerCase();
  const product = payload.prospect?.product;
  const sellerCrmUserId = isUuid(payload.sellerCrmUserId) ? payload.sellerCrmUserId : null;
  const marketingConsentVersion = cleanText(payload.prospect?.marketingConsentVersion, 32);

  if (
    !isUuid(referralId) ||
    !cleanText(payload.referrerIdeaId, 20) ||
    !firstName ||
    !lastName ||
    !phone ||
    !["PV", "ME", "PV_ME"].includes(product || "")
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid Profit referral payload" },
      { status: 400 }
    );
  }

  const { data: existingLink, error: existingLinkError } = await supabaseAdmin
    .from("profit_referral_links")
    .select("profit_referral_id,client_id,current_owner_id,status,is_duplicate,updated_at")
    .eq("profit_referral_id", referralId)
    .maybeSingle();

  if (existingLinkError) {
    return NextResponse.json({ ok: false, error: existingLinkError.message }, { status: 500 });
  }

  if (existingLink?.client_id && ["created", "duplicate"].includes(existingLink.status)) {
    return NextResponse.json({
      ok: true,
      crmLeadId: existingLink.client_id,
      ownerCrmUserId: existingLink.current_owner_id || undefined,
      duplicate: existingLink.is_duplicate,
      idempotentReplay: true,
    });
  }

  if (existingLink?.status === "processing") {
    const age = Date.now() - new Date(existingLink.updated_at).getTime();
    if (age < 30_000) {
      return NextResponse.json({ ok: false, error: "Referral is already processing" }, { status: 409 });
    }
  }

  if (existingLink) {
    const { error } = await supabaseAdmin
      .from("profit_referral_links")
      .update({ status: "processing", last_error: null, updated_at: new Date().toISOString() })
      .eq("profit_referral_id", referralId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("profit_referral_links").insert({
      profit_referral_id: referralId,
      profit_referrer_idea_id: cleanText(payload.referrerIdeaId, 20),
      profit_referrer_name: cleanText(payload.referrerName, 220) || null,
      source_seller_id: sellerCrmUserId,
      status: "processing",
      payload,
    });
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }
  }

  try {
    let assignedUserId: string | null = null;
    if (sellerCrmUserId) {
      const { data: seller, error: sellerError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", sellerCrmUserId)
        .eq("is_active", true)
        .maybeSingle();
      if (sellerError) throw sellerError;
      assignedUserId = seller?.id || null;
    }

    const duplicate = await findDuplicate(phone, email);
    let clientId = duplicate?.id || null;
    const ownerUserId = duplicate?.assigned_user_id || assignedUserId;

    if (!clientId) {
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .insert({
          full_name: `${firstName} ${lastName}`,
          phone,
          email: email || null,
          client_type: "B2C",
          status: ownerUserId ? "assigned" : "Nowy lead",
          lead_source: "Profit",
          created_by: ownerUserId,
          assigned_to: ownerUserId,
          assigned_user_id: ownerUserId,
        })
        .select("id")
        .single();
      if (clientError) throw clientError;
      clientId = client.id;

    }

    const note = [
      "Kontakt z linku IdeaSol.",
      `Referral ID: ${referralId}`,
      `Polecający: ${cleanText(payload.referrerName, 220)} (${cleanText(payload.referrerIdeaId, 20)})`,
      `Produkt: ${productLabel(product)}`,
      ...(marketingConsentVersion
        ? [
            `Zgoda na kontakt telefoniczny: ${payload.prospect?.phoneContactConsent === true ? "TAK" : "NIE"}`,
            `Zgoda marketingowa SMS: ${payload.prospect?.marketingSmsConsent === true ? "TAK" : "NIE"}`,
            `Zgoda marketingowa e-mail: ${payload.prospect?.marketingEmailConsent === true ? "TAK" : "NIE"}`,
            `Wersja zgód: ${marketingConsentVersion}`,
          ]
        : []),
    ].join("\n");
    const { error: noteError } = await supabaseAdmin.from("client_notes").insert({
      client_id: clientId,
      content: note,
      created_by: ownerUserId,
    });
    if (noteError) throw noteError;

    await attachProfitTag(clientId);

    const isDuplicate = Boolean(duplicate);
    const { error: finalizeError } = await supabaseAdmin
      .from("profit_referral_links")
      .update({
        client_id: clientId,
        current_owner_id: ownerUserId,
        status: isDuplicate ? "duplicate" : "created",
        is_duplicate: isDuplicate,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("profit_referral_id", referralId);
    if (finalizeError) throw finalizeError;

    return NextResponse.json(
      {
        ok: true,
        crmLeadId: clientId,
        ownerCrmUserId: ownerUserId || undefined,
        duplicate: isDuplicate,
      },
      { status: isDuplicate ? 200 : 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected integration error";
    await supabaseAdmin
      .from("profit_referral_links")
      .update({ status: "failed", last_error: message.slice(0, 1000), updated_at: new Date().toISOString() })
      .eq("profit_referral_id", referralId);
    console.error("Profit referral integration failed", error);
    return NextResponse.json({ ok: false, error: "Profit referral integration failed" }, { status: 500 });
  }
}
