

import { NextResponse } from "next/server";
import {
  buildTeamsSaleChannelMessage,
  sendTeamsSaleChannelNotification,
} from "@/lib/microsoftTeams";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { shouldSendTeamsForSale } from "@/lib/incognitoSales";

export const runtime = "nodejs";

type SaleCreatedNotificationBody = {
  saleId?: string;
  productsSummary?: string;
  totalSummary?: string | null;
  sellerName?: string;
  saleUrl?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaleCreatedNotificationBody;
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    const { data: authData } = await supabaseAdmin.auth.getUser(accessToken);
    if (!authData.user) {
      return NextResponse.json({ error: "Brak aktywnej sesji." }, { status: 401 });
    }

    const saleId = String(body.saleId || "");
    const { data: sale } = await supabaseAdmin
      .from("sales")
      .select("id, seller_id, is_incognito")
      .eq("id", saleId)
      .maybeSingle();
    if (!sale) {
      return NextResponse.json({ error: "Nie znaleziono sprzedaży." }, { status: 404 });
    }
    if (!shouldSendTeamsForSale(Boolean(sale.is_incognito))) {
      return NextResponse.json({ ok: true, skipped: true, reason: "incognito" });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (sale.seller_id !== authData.user.id && !["admin", "owner"].includes(actorProfile?.role || "")) {
      return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
    }

    const productsSummary = String(body.productsSummary || "").trim();
    const totalSummary = String(body.totalSummary || "").trim();
    const sellerName = String(body.sellerName || "").trim();
    const saleUrl = body.saleUrl ? String(body.saleUrl).trim() : null;

    if (!productsSummary) {
      return NextResponse.json(
        { error: "Brak opisu produktów sprzedaży" },
        { status: 400 }
      );
    }

    if (!sellerName) {
      return NextResponse.json(
        { error: "Brak nazwy sprzedawcy" },
        { status: 400 }
      );
    }

    const isProductionEnvironment = process.env.VERCEL_ENV
      ? process.env.VERCEL_ENV === "production"
      : process.env.NODE_ENV === "production";

    if (!isProductionEnvironment) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Powiadomienia Teams są wyłączone poza produkcją",
      });
    }

    const message = buildTeamsSaleChannelMessage({
      productsSummary,
      totalSummary,
      sellerName,
      saleUrl,
    });

    const result = await sendTeamsSaleChannelNotification({ message });

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Błąd wysyłki powiadomienia Teams o nowej sprzedaży", error);

    return NextResponse.json(
      { error: "Nie udało się wysłać powiadomienia Teams o nowej sprzedaży" },
      { status: 500 }
    );
  }
}
