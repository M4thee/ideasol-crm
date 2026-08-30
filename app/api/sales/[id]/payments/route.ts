import { NextResponse } from "next/server";
import {
  canAccessSaleForAccounting,
  requireSaleAccountingRequest,
} from "@/lib/auth/requireSaleAccountingRequest";
import { isValidDateOnly } from "@/lib/polishDateTime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const profile = await requireSaleAccountingRequest(request, {
      requireRealization: true,
    });
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnienia Realizacja." },
        { status: 403 }
      );
    }

    const { id: saleId } = await context.params;
    const { data: sale, error: saleError } = await supabaseAdmin
      .from("sales")
      .select("id, seller_id")
      .eq("id", saleId)
      .maybeSingle();

    if (saleError || !sale) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono sprzedaży." }, { status: 404 });
    }

    const canAccess = await canAccessSaleForAccounting({
      userId: profile.id,
      role: profile.role,
      sellerId: sale.seller_id,
    });

    if (!canAccess) {
      return NextResponse.json(
        { ok: false, error: "Nie masz dostępu do tej sprzedaży." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      amount?: number | string;
      paidAt?: string;
      note?: string;
    };
    const amount = Number(String(body.amount ?? "").replace(/\s/g, "").replace(",", "."));
    const paidAt = String(body.paidAt || "").trim();
    const note = String(body.note || "").trim();

    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawną dodatnią kwotę wpłaty." },
        { status: 400 }
      );
    }

    if (!isValidDateOnly(paidAt)) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawną datę wpłaty." },
        { status: 400 }
      );
    }

    if (note.length > 500) {
      return NextResponse.json(
        { ok: false, error: "Notatka może mieć maksymalnie 500 znaków." },
        { status: 400 }
      );
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("customer_payments")
      .insert({
        sale_id: saleId,
        amount,
        paid_at: paidAt,
        note: note || null,
        created_by: profile.id,
      })
      .select("id, amount, paid_at, note, created_by, created_at")
      .single();

    if (paymentError) {
      throw new Error(`Nie udało się zapisać wpłaty: ${paymentError.message}`);
    }

    return NextResponse.json({ ok: true, payment }, { status: 201 });
  } catch (error) {
    console.error("Błąd zapisu wpłaty klienta", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nie udało się zapisać wpłaty.",
      },
      { status: 500 }
    );
  }
}
