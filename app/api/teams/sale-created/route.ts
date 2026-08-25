

import { NextResponse } from "next/server";
import {
  buildTeamsSaleChannelMessage,
  sendTeamsSaleChannelNotification,
} from "@/lib/microsoftTeams";

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
