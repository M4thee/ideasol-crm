import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createSaleOfferSnapshot,
  getOfferInstallationCount,
} from "@/lib/installationCount";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Brak aktywnej sesji." }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });
  }

  const body = await request.json();
  const requestedSale = record(body.sale);
  const sourceOfferId = String(requestedSale.source_offer_id || "");

  const [{ data: profile }, { data: permission }, { data: offer, error: offerError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id, role, manager_id").eq("id", user.id).maybeSingle(),
      supabaseAdmin
        .from("user_permissions")
        .select("incognito_sales, custom_mode")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseAdmin.from("client_offers").select("*").eq("id", sourceOfferId).maybeSingle(),
    ]);

  const canUseIncognito = profile?.role === "admin" || permission?.incognito_sales === true;
  if (!profile || !canUseIncognito) {
    return NextResponse.json({ error: "Brak uprawnienia do sprzedaży incognito." }, { status: 403 });
  }
  if (offerError || !offer) {
    return NextResponse.json({ error: "Nie znaleziono oferty źródłowej." }, { status: 404 });
  }

  let canAccessOffer = ["admin", "owner", "cc"].includes(String(profile.role));
  canAccessOffer ||= offer.created_by === user.id;
  if (!canAccessOffer && profile.role === "manager") {
    const { data: creator } = await supabaseAdmin
      .from("profiles")
      .select("manager_id")
      .eq("id", offer.created_by)
      .maybeSingle();
    canAccessOffer = creator?.manager_id === user.id;
  }
  if (!canAccessOffer) {
    return NextResponse.json({ error: "Nie znaleziono oferty źródłowej." }, { status: 404 });
  }

  const sellerId = String(requestedSale.seller_id || offer.created_by || "");
  if (sellerId !== offer.created_by && permission?.custom_mode !== true && profile.role !== "admin") {
    return NextResponse.json({ error: "Brak uprawnienia do zmiany sprzedawcy." }, { status: 403 });
  }

  const offerData = record(offer.offer_data);
  const calculationResponse = await fetch(new URL("/api/calculate", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      ...record(offerData.form),
      customEquipment: offerData.customEquipment || record(offerData.form).customEquipment,
      customMode: offerData.customMode === true || record(offerData.form).customMode === true,
      advisor: { ...record(offerData.advisor), id: sellerId },
      createdBy: sellerId,
      incognito: true,
    }),
  });
  const calculation = await calculationResponse.json().catch(() => null);
  if (!calculationResponse.ok || !calculation || calculation.pricingMode !== "incognito") {
    return NextResponse.json(
      { error: calculation?.error || "Nie udało się obliczyć ceny incognito." },
      { status: 422 }
    );
  }

  const pricedOffer = {
    ...offer,
    sale_price_net: Number(calculation.finalNet || 0),
    sale_price_gross: Number(calculation.finalGross || 0),
    seller_margin: Number(calculation.sellerMarkupNet || 0),
    company_margin: Number(calculation.companyMargin || 0),
    offer_data: {
      ...offerData,
      result: calculation,
      contractBreakdown: calculation.contractBreakdown || null,
      incognitoPricingApplied: true,
    },
  };
  const snapshot = createSaleOfferSnapshot(
    pricedOffer,
    getOfferInstallationCount(offer)
  );
  const customerData = record(requestedSale.customer_data);

  const safeSale = {
    client_id: requestedSale.client_id,
    seller_id: sellerId,
    source_offer_id: offer.id,
    contract_number: requestedSale.contract_number,
    sale_date: requestedSale.sale_date || new Date().toISOString(),
    contract_value: Number(snapshot.sale_price_gross || 0),
    margin_value: Number(snapshot.seller_margin || 0),
    sold_items: requestedSale.sold_items,
    status: requestedSale.status || "Oczekuje na sprawdzenie dokumentów",
    customer_type: requestedSale.customer_type,
    customer_data: {
      ...customerData,
      contract_total_gross: Number(snapshot.sale_price_gross || 0),
      incognito_pricing_applied: true,
    },
    offer_snapshot: snapshot,
    source_event_id: requestedSale.source_event_id || null,
    payment_method: requestedSale.payment_method,
    deposit_amount: requestedSale.deposit_amount,
    is_incognito: true,
  };

  const { data: createdSale, error: insertError } = await supabaseAdmin
    .from("sales")
    .insert(safeSale)
    .select("id")
    .single();

  if (insertError || !createdSale) {
    console.error("Nie udało się utworzyć sprzedaży incognito", insertError);
    return NextResponse.json({ error: "Nie udało się utworzyć sprzedaży." }, { status: 500 });
  }

  return NextResponse.json({ id: createdSale.id }, { status: 201 });
}
