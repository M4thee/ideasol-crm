import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  AUDIT_EXPORT_LIMIT,
  type AuditLogRow,
  getAuditLogs,
  readAuditLogFilters,
} from "@/lib/auditLogQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  data_change: "Zmiana danych",
  session_started: "Wejście do CRM",
  session_resumed: "Powrót do CRM",
  session_ended: "Wyjście z CRM",
  page_view: "Otwarcie widoku",
  calculation_completed: "Kalkulacja",
  offer_saved: "Zapis oferty",
  offer_sent: "Wysłanie oferty",
  offer_send_failed: "Błąd wysyłki oferty",
  offer_queued: "Oferta w kolejce",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Utworzenie",
  update: "Edycja",
  delete: "Usunięcie",
  view: "Podgląd",
  login: "Logowanie",
  logout: "Wylogowanie",
  resume: "Wznowienie sesji",
  calculate: "Przeliczenie",
  save: "Zapis",
  send: "Wysłanie",
  error: "Błąd",
  queue: "Kolejka",
};

function actorName(log: AuditLogRow) {
  return log.actor?.display_name || log.actor?.email || log.actor_user_id || "System";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function compactJson(value: unknown) {
  return value ? JSON.stringify(value) : "";
}

function filterDescription(url: URL) {
  const values = [
    url.searchParams.get("from") ? `od ${dateTime(url.searchParams.get("from")!)}` : null,
    url.searchParams.get("to") ? `do ${dateTime(url.searchParams.get("to")!)}` : null,
    url.searchParams.get("userId") ? `użytkownik ${url.searchParams.get("userId")}` : null,
    url.searchParams.get("eventType") ? `zdarzenie ${url.searchParams.get("eventType")}` : null,
    url.searchParams.get("module") ? `moduł ${url.searchParams.get("module")}` : null,
    url.searchParams.get("search") ? `wyszukiwanie „${url.searchParams.get("search")}”` : null,
  ].filter(Boolean);

  return values.length > 0 ? values.join("; ") : "bez ograniczenia zakresu";
}

function excelBuffer(logs: AuditLogRow[], description: string) {
  const rows = logs.map((log) => ({
    Data: new Date(log.created_at),
    Użytkownik: actorName(log),
    Email: log.actor?.email || "",
    Rola: log.actor?.role || "",
    Zdarzenie: EVENT_LABELS[log.event_type] || log.event_type,
    Działanie: ACTION_LABELS[log.action] || log.action,
    Moduł: log.module,
    Podsumowanie: log.summary,
    "Kalkulacja wysłana":
      log.event_type === "calculation_completed"
        ? log.calculation_sent
          ? "Tak"
          : "Nie"
        : "",
    "Typ obiektu": log.entity_type || "",
    "ID obiektu": log.entity_id || "",
    "ID klienta": log.client_id || "",
    "ID sprzedaży": log.sale_id || "",
    "ID oferty": log.offer_id || "",
    Widok: log.path || "",
    "Zmienione pola": (log.changed_fields || []).join(", "),
    "Wartości przed": compactJson(log.old_values),
    "Wartości po": compactJson(log.new_values),
    Metadane: compactJson(log.metadata),
    IP: log.ip_address || "",
    "Przeglądarka / urządzenie": log.user_agent || "",
    "ID sesji": log.session_id || "",
    "ID powiązania": log.correlation_id || "",
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 28 },
    { wch: 14 },
    { wch: 22 },
    { wch: 15 },
    { wch: 22 },
    { wch: 55 },
    { wch: 18 },
    { wch: 22 },
    { wch: 38 },
    { wch: 38 },
    { wch: 38 },
    { wch: 38 },
    { wch: 35 },
    { wch: 35 },
    { wch: 70 },
    { wch: 70 },
    { wch: 60 },
    { wch: 20 },
    { wch: 55 },
    { wch: 38 },
    { wch: 38 },
  ];

  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Dziennik aktywności IdeaSol CRM"],
    ["Zakres", description],
    ["Wygenerowano", new Date()],
    ["Liczba rekordów", logs.length],
    ["Uwaga", `Eksport ograniczony do ${AUDIT_EXPORT_LIMIT.toLocaleString("pl-PL")} najnowszych rekordów.`],
  ]);
  infoSheet["!cols"] = [{ wch: 22 }, { wch: 90 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Informacje");
  XLSX.utils.book_append_sheet(workbook, worksheet, "Logi CRM");

  return XLSX.write(workbook, { type: "buffer", bookType: "biff8", cellDates: true });
}

function wrapText(text: string, maxCharacters: number) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return ["—"];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxCharacters) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxCharacters ? `${word.slice(0, maxCharacters - 1)}…` : word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

async function pdfBuffer(logs: AuditLogRow[], description: string) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public/fonts/DejaVuSans.ttf"));
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const pageSize: [number, number] = [841.89, 595.28];
  const margin = 28;
  const lineHeight = 10;
  const columns = [
    { key: "date", label: "Data", width: 92, chars: 17 },
    { key: "actor", label: "Użytkownik", width: 108, chars: 20 },
    { key: "event", label: "Zdarzenie", width: 104, chars: 19 },
    { key: "module", label: "Moduł", width: 83, chars: 15 },
    { key: "summary", label: "Szczegóły", width: 270, chars: 50 },
    { key: "entity", label: "Obiekt / ID", width: 129, chars: 23 },
  ];
  let pageNumber = 0;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  function drawHeader() {
    pageNumber += 1;
    page.drawText("Dziennik aktywności IdeaSol CRM", {
      x: margin,
      y,
      size: 15,
      font,
      color: rgb(0.05, 0.13, 0.24),
    });
    page.drawText(`Wygenerowano: ${dateTime(new Date().toISOString())}  |  rekordów: ${logs.length}`, {
      x: margin,
      y: y - 17,
      size: 7.5,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
    const descriptionLines = wrapText(`Filtry: ${description}`, 150).slice(0, 2);
    descriptionLines.forEach((line, index) => {
      page.drawText(line, {
        x: margin,
        y: y - 29 - index * 9,
        size: 7.5,
        font,
        color: rgb(0.35, 0.4, 0.48),
      });
    });
    y -= 52;

    page.drawRectangle({
      x: margin,
      y: y - 17,
      width: pageSize[0] - margin * 2,
      height: 18,
      color: rgb(0.08, 0.22, 0.42),
    });
    let x = margin;
    for (const column of columns) {
      page.drawText(column.label, {
        x: x + 4,
        y: y - 12,
        size: 7,
        font,
        color: rgb(1, 1, 1),
      });
      x += column.width;
    }
    y -= 18;
  }

  function addPage() {
    page.drawText(`Strona ${pageNumber}`, {
      x: pageSize[0] - margin - 45,
      y: 14,
      size: 7,
      font,
      color: rgb(0.45, 0.48, 0.55),
    });
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
    drawHeader();
  }

  drawHeader();

  logs.forEach((log, rowIndex) => {
    const sentLabel =
      log.event_type === "calculation_completed"
        ? log.calculation_sent
          ? " [wysłana]"
          : " [niewysłana]"
        : "";
    const values: Record<string, string> = {
      date: dateTime(log.created_at),
      actor: actorName(log),
      event: `${EVENT_LABELS[log.event_type] || log.event_type}${sentLabel}`,
      module: log.module,
      summary: `${log.summary}${
        log.changed_fields?.length ? ` | Pola: ${log.changed_fields.join(", ")}` : ""
      }`,
      entity: [log.entity_type, log.entity_id].filter(Boolean).join(" / ") || "—",
    };
    const lineGroups = columns.map((column) =>
      wrapText(values[column.key], column.chars).slice(0, 5)
    );
    const rowHeight = Math.max(24, Math.max(...lineGroups.map((lines) => lines.length)) * lineHeight + 8);

    if (y - rowHeight < 32) addPage();

    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: pageSize[0] - margin * 2,
      height: rowHeight,
      color: rowIndex % 2 === 0 ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.9, 0.93),
      borderWidth: 0.35,
    });

    let x = margin;
    columns.forEach((column, columnIndex) => {
      lineGroups[columnIndex].forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + 4,
          y: y - 10 - lineIndex * lineHeight,
          size: 6.6,
          font,
          color: rgb(0.12, 0.17, 0.24),
        });
      });
      x += column.width;
    });

    y -= rowHeight;
  });

  page.drawText(`Strona ${pageNumber}`, {
    x: pageSize[0] - margin - 45,
    y: 14,
    size: 7,
    font,
    color: rgb(0.45, 0.48, 0.55),
  });

  return Buffer.from(await pdf.save());
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    if (format !== "xls" && format !== "pdf") {
      return NextResponse.json({ ok: false, error: "Nieprawidłowy format." }, { status: 400 });
    }

    const filters = readAuditLogFilters(url.searchParams);
    const { logs } = await getAuditLogs(filters, { exportLimit: AUDIT_EXPORT_LIMIT });
    const description = filterDescription(url);
    const dateStamp = new Date().toISOString().slice(0, 10);

    if (format === "xls") {
      const output = excelBuffer(logs, description);
      return new NextResponse(output, {
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="logi-crm-${dateStamp}.xls"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const output = await pdfBuffer(logs, description);
    return new NextResponse(output, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="logi-crm-${dateStamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Błąd eksportu logów CRM", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się przygotować eksportu logów." },
      { status: 500 }
    );
  }
}
