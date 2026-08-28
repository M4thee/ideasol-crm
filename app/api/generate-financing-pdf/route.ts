import { NextResponse } from "next/server";

import {
  createFinancingOfferPdf,
  type FinancingOfferPdfData,
} from "@/lib/financingOfferPdf";

export const runtime = "nodejs";

function numberValue(value: unknown) {
  return Number(value);
}

function textValue(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data: FinancingOfferPdfData = {
      installationPrice: numberValue(body.installationPrice),
      downPayment: numberValue(body.downPayment),
      creditAmount: numberValue(body.creditAmount),
      totalCreditCost: numberValue(body.totalCreditCost),
      totalRepayment: numberValue(body.totalRepayment),
      nominalAnnualRate: numberValue(body.nominalAnnualRate),
      rrso: numberValue(body.rrso),
      bankName: textValue(body.bankName, 120),
      bankLogoUrl: textValue(body.bankLogoUrl, 3_000_000),
      offerName: textValue(body.offerName, 140),
      termMonths: numberValue(body.termMonths),
      installment: numberValue(body.installment),
    };

    const numericValues = [
      data.installationPrice,
      data.downPayment,
      data.creditAmount,
      data.totalCreditCost,
      data.totalRepayment,
      data.nominalAnnualRate,
      data.rrso,
      data.installment,
    ];

    if (
      numericValues.some((value) => !Number.isFinite(value) || value < 0) ||
      data.creditAmount <= 0 ||
      data.installment <= 0 ||
      !Number.isInteger(data.termMonths) ||
      data.termMonths < 1 ||
      data.termMonths > 360 ||
      !data.bankName ||
      !data.offerName
    ) {
      return NextResponse.json({ error: "Nieprawidłowe dane kalkulacji finansowania." }, { status: 400 });
    }

    const pdfBytes = await createFinancingOfferPdf(data);
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=kalkulacja-finansowania-ideasol.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Błąd generowania oferty finansowania PDF", error);
    return NextResponse.json(
      { error: "Nie udało się wygenerować oferty finansowania PDF." },
      { status: 500 }
    );
  }
}
