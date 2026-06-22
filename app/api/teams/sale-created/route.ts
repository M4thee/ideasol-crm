

import { NextResponse } from "next/server";
import {
  buildTeamsSaleChannelMessage,
  sendTeamsSaleChannelNotification,
} from "@/lib/microsoftTeams";

export const runtime = "nodejs";

type SaleCreatedNotificationBody = {
  saleId?: string;
  productsSummary?: string;
  sellerName?: string;
  saleUrl?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaleCreatedNotificationBody;
    const productsSummary = String(body.productsSummary || "").trim();
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

    const message = buildTeamsSaleChannelMessage({
      productsSummary,
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