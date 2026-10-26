import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSaleOfferSnapshot, getOfferInstallationCount } from "@/lib/installationCount";

type RouteContext = { params: Promise<{ id: string }> };

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function PATCH(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  const { data: authData } = await supabaseAdmin.auth.getUser(token);
  if (!authData.user) {
    return NextResponse.json({ error: "Brak aktywnej sesji." }, { status: 401 });
  }
  const { id: saleId } = await context.params;
  const body = await request.json();
  const targetIncognito = body.isIncognito === true;

  const [{ data: actor }, { data: permission }, { data: sale }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle(),
    supabaseAdmin
      .from("user_permissions")
      .select("incognito_sales, custom_mode")
      .eq("user_id", authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("sales")
      .select("id, seller_id, source_offer_id, is_incognito, customer_data")
      .eq("id", saleId)
      .maybeSingle(),
  ]);
  if (!actor || !sale) {
    return NextResponse.json({ error: "Nie znaleziono sprzedaży." }, { status: 404 });
  }
  const canUseIncognito = actor.role === "admin" || permission?.incognito_sales === true;
  if (!canUseIncognito) {
    return NextResponse.json({ error: "Nie znaleziono sprzedaży." }, { status: 404 });
  }

  let baseAccess = ["admin", "owner", "cc"].includes(actor.role) || sale.seller_id === actor.id;
  if (!baseAccess && actor.role === "manager" && sale.seller_id) {
    const { data: seller } = await supabaseAdmin
      .from("profiles")
      .select("manager_id")
      .eq("id", sale.seller_id)
      .maybeSingle();
    baseAccess = seller?.manager_id === actor.id;
  }
  if (!baseAccess) {
    return NextResponse.json({ error: "Nie znaleziono sprzedaży." }, { status: 404 });
  }
  if (sale.is_incognito === targetIncognito) {
    return NextResponse.json({ ok: true, isIncognito: targetIncognito });
  }
  if (!sale.source_offer_id) {
    return NextResponse.json(
      { error: "Nie można zmienić trybu sprzedaży bez oferty źródłowej." },
      { status: 409 }
    );
  }

  const [
    { count: ideaSignCount },
    { count: documentCount },
    { count: profitOutboxCount },
    { count: profitLinkCount },
    { count: metaEventCount },
  ] = await Promise.all([
    supabaseAdmin
      .from("contract_signature_sessions")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", sale.id),
    supabaseAdmin
      .from("sale_documents")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", sale.id),
    supabaseAdmin
      .from("profit_integration_outbox")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", sale.id),
    supabaseAdmin
      .from("profit_referral_links")
      .select("profit_referral_id", { count: "exact", head: true })
      .eq("sale_id", sale.id),
    supabaseAdmin
      .from("meta_capi_events")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "sale")
      .eq("source_id", sale.id),
  ]);
  if (
    (ideaSignCount || 0) > 0 ||
    (documentCount || 0) > 0 ||
    (profitOutboxCount || 0) > 0 ||
    (profitLinkCount || 0) > 0 ||
    (metaEventCount || 0) > 0
  ) {
    return NextResponse.json(
      {
        error:
          "Nie można zmienić trybu po utworzeniu dokumentów, procesu IdeaSign lub przekazaniu sprzedaży do integracji zewnętrznej.",
      },
      { status: 409 }
    );
  }

  const { data: offer } = await supabaseAdmin
    .from("client_offers")
    .select("*")
    .eq("id", sale.source_offer_id)
    .maybeSingle();
  if (!offer) {
    return NextResponse.json({ error: "Nie znaleziono oferty źródłowej." }, { status: 409 });
  }

  let pricedOffer: Record<string, unknown> = offer;
  if (targetIncognito) {
    const offerData = asRecord(offer.offer_data);
    const calculationResponse = await fetch(new URL("/api/calculate", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...asRecord(offerData.form),
        customEquipment: offerData.customEquipment || asRecord(offerData.form).customEquipment,
        customMode: offerData.customMode === true || asRecord(offerData.form).customMode === true,
        advisor: { ...asRecord(offerData.advisor), id: sale.seller_id },
        createdBy: sale.seller_id,
        incognito: true,
      }),
    });
    const result = await calculationResponse.json().catch(() => null);
    if (!calculationResponse.ok || !result || result.pricingMode !== "incognito") {
      return NextResponse.json(
        { error: result?.error || "Nie udało się przeliczyć ceny incognito." },
        { status: 422 }
      );
    }
    pricedOffer = {
      ...offer,
      sale_price_net: Number(result.finalNet || 0),
      sale_price_gross: Number(result.finalGross || 0),
      seller_margin: Number(result.sellerMarkupNet || 0),
      company_margin: Number(result.companyMargin || 0),
      offer_data: {
        ...offerData,
        result,
        contractBreakdown: result.contractBreakdown || null,
        incognitoPricingApplied: true,
      },
    };
  }

  const snapshot = createSaleOfferSnapshot(pricedOffer, getOfferInstallationCount(offer));
  const customerData = asRecord(sale.customer_data);
  const { error: updateError } = await supabaseAdmin
    .from("sales")
    .update({
      is_incognito: targetIncognito,
      contract_value: Number(snapshot.sale_price_gross || 0),
      margin_value: Number(snapshot.seller_margin || 0),
      offer_snapshot: snapshot,
      customer_data: {
        ...customerData,
        contract_total_gross: Number(snapshot.sale_price_gross || 0),
        incognito_pricing_applied: targetIncognito,
      },
    })
    .eq("id", sale.id);
  if (updateError) {
    return NextResponse.json({ error: "Nie udało się zmienić trybu sprzedaży." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    isIncognito: targetIncognito,
    contractValue: Number(snapshot.sale_price_gross || 0),
  });
}
