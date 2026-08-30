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
type InvoiceType = "advance" | "final" | "correction";

const INVOICE_TYPES = new Set<InvoiceType>(["advance", "final", "correction"]);

async function loadAccessibleSale(request: Request, saleId: string, requireRealization = false) {
  const profile = await requireSaleAccountingRequest(request, { requireRealization });
  if (!profile) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          error: requireRealization
            ? "Brak uprawnienia Realizacja."
            : "Sesja wygasła lub użytkownik nie istnieje.",
        },
        { status: requireRealization ? 403 : 401 }
      ),
    };
  }

  const { data: sale, error: saleError } = await supabaseAdmin
    .from("sales")
    .select("id, seller_id, contract_value, deposit_amount, contract_number, public_id, sale_public_id")
    .eq("id", saleId)
    .maybeSingle();

  if (saleError || !sale) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Nie znaleziono sprzedaży." },
        { status: 404 }
      ),
    };
  }

  const canAccess = await canAccessSaleForAccounting({
    userId: profile.id,
    role: profile.role,
    sellerId: sale.seller_id,
  });

  if (!canAccess) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Nie masz dostępu do tej sprzedaży." },
        { status: 403 }
      ),
    };
  }

  return { profile, sale };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: saleId } = await context.params;
    const access = await loadAccessibleSale(request, saleId);
    if ("response" in access) return access.response;

    const [paymentsResponse, invoicesResponse] = await Promise.all([
      supabaseAdmin
        .from("customer_payments")
        .select("id, amount, paid_at, note, created_at")
        .eq("sale_id", saleId)
        .order("paid_at", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("sale_invoices")
        .select(
          "id, invoice_type, invoice_number, gross_amount, issued_at, status, ksef_status, correction_of_invoice_id, note, created_at"
        )
        .eq("sale_id", saleId)
        .order("issued_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (paymentsResponse.error) {
      throw new Error(`Nie udało się pobrać wpłat: ${paymentsResponse.error.message}`);
    }

    if (invoicesResponse.error) {
      throw new Error(`Nie udało się pobrać faktur: ${invoicesResponse.error.message}`);
    }

    const payments = paymentsResponse.data || [];
    const invoices = invoicesResponse.data || [];
    const paidTotal = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
    const contractValue =
      access.sale.contract_value === null ? null : Number(access.sale.contract_value);

    return NextResponse.json({
      ok: true,
      data: {
        contractValue,
        depositAmount:
          access.sale.deposit_amount === null ? null : Number(access.sale.deposit_amount),
        paidTotal,
        outstandingAmount:
          contractValue === null ? null : Math.max(contractValue - paidTotal, 0),
        invoiceIssued: invoices.some((invoice) => invoice.status === "issued_local"),
        canManage: access.profile.hasRealizationAccess,
        payments,
        invoices,
      },
    });
  } catch (error) {
    console.error("Błąd odczytu księgowości sprzedaży", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać danych księgowych.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: saleId } = await context.params;
    const access = await loadAccessibleSale(request, saleId, true);
    if ("response" in access) return access.response;

    const body = (await request.json()) as {
      invoiceType?: InvoiceType;
      invoiceNumber?: string;
      grossAmount?: number | string;
      issuedAt?: string;
      correctionOfInvoiceId?: string | null;
      note?: string;
    };

    const invoiceType = body.invoiceType;
    const invoiceNumber = String(body.invoiceNumber || "").trim();
    const grossAmount = Number(
      String(body.grossAmount ?? "").replace(/\s/g, "").replace(",", ".")
    );
    const issuedAt = String(body.issuedAt || "").trim();
    const correctionOfInvoiceId = String(body.correctionOfInvoiceId || "").trim() || null;
    const note = String(body.note || "").trim();

    if (!invoiceType || !INVOICE_TYPES.has(invoiceType)) {
      return NextResponse.json(
        { ok: false, error: "Wybierz poprawny rodzaj faktury." },
        { status: 400 }
      );
    }

    if (!invoiceNumber || invoiceNumber.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Podaj numer faktury (maksymalnie 100 znaków)." },
        { status: 400 }
      );
    }

    const amountIsValid =
      Number.isFinite(grossAmount) &&
      grossAmount !== 0 &&
      Math.abs(grossAmount) <= 10_000_000 &&
      (invoiceType === "correction" || grossAmount > 0);

    if (!amountIsValid) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawną kwotę brutto faktury." },
        { status: 400 }
      );
    }

    if (!isValidDateOnly(issuedAt)) {
      return NextResponse.json(
        { ok: false, error: "Podaj poprawną datę wystawienia." },
        { status: 400 }
      );
    }

    if (note.length > 1000) {
      return NextResponse.json(
        { ok: false, error: "Notatka może mieć maksymalnie 1000 znaków." },
        { status: 400 }
      );
    }

    if (invoiceType === "correction") {
      if (!correctionOfInvoiceId) {
        return NextResponse.json(
          { ok: false, error: "Wybierz fakturę korygowaną." },
          { status: 400 }
        );
      }

      const { data: correctedInvoice, error: correctedInvoiceError } = await supabaseAdmin
        .from("sale_invoices")
        .select("id")
        .eq("id", correctionOfInvoiceId)
        .eq("sale_id", saleId)
        .maybeSingle();

      if (correctedInvoiceError || !correctedInvoice) {
        return NextResponse.json(
          { ok: false, error: "Nie znaleziono faktury korygowanej w tej sprzedaży." },
          { status: 400 }
        );
      }
    } else if (correctionOfInvoiceId) {
      return NextResponse.json(
        { ok: false, error: "Powiązanie z fakturą źródłową dotyczy wyłącznie korekty." },
        { status: 400 }
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("sale_invoices")
      .insert({
        sale_id: saleId,
        invoice_type: invoiceType,
        invoice_number: invoiceNumber,
        gross_amount: grossAmount,
        issued_at: issuedAt,
        status: "issued_local",
        ksef_status: "not_integrated",
        correction_of_invoice_id: correctionOfInvoiceId,
        note: note || null,
        created_by: access.profile.id,
      })
      .select(
        "id, invoice_type, invoice_number, gross_amount, issued_at, status, ksef_status, correction_of_invoice_id, note, created_at"
      )
      .single();

    if (invoiceError) {
      if (invoiceError.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "Faktura o tym numerze jest już zapisana." },
          { status: 409 }
        );
      }
      throw new Error(`Nie udało się zapisać faktury: ${invoiceError.message}`);
    }

    return NextResponse.json({ ok: true, invoice }, { status: 201 });
  } catch (error) {
    console.error("Błąd zapisu faktury sprzedaży", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Nie udało się zapisać faktury.",
      },
      { status: 500 }
    );
  }
}
