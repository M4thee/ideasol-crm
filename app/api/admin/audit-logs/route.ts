import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  AUDIT_PAGE_SIZE,
  getAuditFilterOptions,
  getAuditLogs,
  readAuditLogFilters,
} from "@/lib/auditLogQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const filters = readAuditLogFilters(url.searchParams);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("pageSize")) || AUDIT_PAGE_SIZE)
    );
    const [result, options] = await Promise.all([
      getAuditLogs(filters, { page, pageSize }),
      getAuditFilterOptions(),
    ]);

    return NextResponse.json({ ok: true, ...result, options });
  } catch (error) {
    console.error("Błąd pobierania logów CRM", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się pobrać logów CRM." },
      { status: 500 }
    );
  }
}
