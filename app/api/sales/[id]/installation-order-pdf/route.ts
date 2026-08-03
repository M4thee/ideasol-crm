import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import {
  createInstallationOrderCover,
  DEFAULT_INSTALLATION_ORDER_INCLUDED_ITEMS,
  DEFAULT_INSTALLATION_SUPPLY_SOURCES,
  type InstallationOrderIncludedItems,
  type InstallationSupplySources,
} from "@/lib/installationOrderPdf";
import { getInstallationOrderScope } from "@/lib/installationOrderScope";
import {
  isValidDateOnly,
  isValidTimeOnly,
  polishLocalDateTimeToIso,
} from "@/lib/polishDateTime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

type SaleDocument = {
  id: string;
  document_type: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
};

type Installer = {
  id: string;
  company_name: string;
  address: string | null;
  nip: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
};

type JsonRecord = Record<string, unknown>;
type SaleRecord = JsonRecord & {
  id: string;
  client_id?: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const TECHNICAL_AUDIT_TYPES = [
  "Audyt techniczny",
  "Dokumenty techniczne",
  "Protokół montażu",
];
const PHOTO_TYPES = ["Zdjęcia", "Zdjęcie", "Galeria zdjęć"];

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && cleanText(value)) return value;
  }
  return "";
}

function equipmentLabel(value: unknown): string {
  if (!value) return "Brak / nie dotyczy";

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return equipmentLabel(
      firstValue(record.displayName, record.display_name, record.name, record.model, record.code)
    );
  }

  const text = cleanText(value);
  if (!text || ["none", "brak", "null", "undefined"].includes(text.toLowerCase())) {
    return "Brak / nie dotyczy";
  }

  return text.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function formatPolishDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return "Brak danych";

  const [year, month, day] = text.split("-");
  return year && month && day ? `${day}.${month}.${year}` : text;
}

function joinAddress(parts: unknown[]) {
  return parts.map(cleanText).filter(Boolean).join(", ");
}

function getInstallationAddress(sale: SaleRecord, client: JsonRecord | null) {
  const customerData = (sale.customer_data || {}) as JsonRecord;
  const useContractAddress = sale.installation_same_as_contract !== false;
  const directAddress = useContractAddress
    ? joinAddress([
        [sale.contract_street, sale.contract_building_number].filter(Boolean).join(" "),
        [sale.contract_postal_code, sale.contract_city].filter(Boolean).join(" "),
      ])
    : joinAddress([
        [sale.installation_street, sale.installation_building_number].filter(Boolean).join(" "),
        [sale.installation_postal_code, sale.installation_city].filter(Boolean).join(" "),
      ]);

  return (
    directAddress ||
    cleanText(
      firstValue(
        customerData.installation_address,
        customerData.mounting_address,
        customerData.contract_address,
        client?.address
      )
    ) ||
    joinAddress([
      [client?.street, client?.building_number].filter(Boolean).join(" "),
      [client?.postal_code, client?.city].filter(Boolean).join(" "),
    ]) ||
    "Brak danych"
  );
}

function getEquipment(sale: SaleRecord) {
  const snapshot = (sale.offer_snapshot || {}) as JsonRecord;
  const offerData = (snapshot.offer_data || {}) as JsonRecord;
  const form = (offerData.form || {}) as JsonRecord;
  const result = (offerData.result || {}) as JsonRecord;

  return {
    panel: equipmentLabel(
      firstValue(
        snapshot.panel_model,
        snapshot.panel_name,
        form.panelModel,
        form.panelName,
        result.panelModel,
        result.panelName
      )
    ),
    inverter: equipmentLabel(
      firstValue(
        snapshot.inverter_name,
        snapshot.inverter,
        result.inverter,
        result.inverterName,
        form.selectedInverterName,
        form.inverter
      )
    ),
    storage: equipmentLabel(
      firstValue(
        snapshot.storage_name,
        snapshot.energy_storage,
        result.energyStorage,
        result.storage,
        form.energyStorage,
        form.storage
      )
    ),
  };
}

function normalizeTechnicalKey(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMountingType(value: unknown) {
  const normalized = normalizeTechnicalKey(value);
  if (!normalized) return "Brak / nie dotyczy";
  if (normalized.includes("wiata") || normalized.includes("carport")) return "Wiata";
  if (normalized.includes("grunt") || normalized.includes("ground")) return "Grunt";
  if (normalized.includes("dachowka") || normalized.includes("tile")) {
    return "Dach - dachówka ceramiczna";
  }
  if (normalized.includes("blacha") || normalized.includes("sheet")) {
    return "Dach - blacha";
  }
  if (
    normalized.includes("papa") ||
    normalized.includes("membrana") ||
    normalized.includes("felt") ||
    normalized.includes("plaski")
  ) {
    return "Dach płaski - papa / membrana";
  }
  if (normalized.includes("dach") || normalized.includes("roof")) return `Dach - ${cleanText(value)}`;
  return equipmentLabel(value);
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(cleanText(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function getPvDetails(sale: SaleRecord, panelModel: string, hasPv: boolean) {
  const snapshot = (sale.offer_snapshot || {}) as JsonRecord;
  const offerData = (snapshot.offer_data || {}) as JsonRecord;
  const form = (offerData.form || {}) as JsonRecord;
  const result = (offerData.result || {}) as JsonRecord;
  const panelPowerWp = numberValue(
    firstValue(
      snapshot.panel_power_wp,
      snapshot.panelPowerWp,
      form.panelPowerWp,
      result.panelPowerWp
    )
  );
  const panelCount = numberValue(
    firstValue(snapshot.panel_count, snapshot.panelCount, form.panelCount, result.panelCount)
  );
  const storedTotalPowerKw = numberValue(
    firstValue(
      snapshot.pv_power_kw,
      snapshot.pvPowerKw,
      form.pvPowerKw,
      result.pvPowerKw,
      result.pv_power_kw
    )
  );
  const totalPowerKw =
    storedTotalPowerKw ||
    (panelPowerWp > 0 && panelCount > 0 ? (panelPowerWp * panelCount) / 1000 : 0);
  const mountingType = firstValue(
    snapshot.roof_type,
    snapshot.roofType,
    snapshot.mounting_type,
    form.roofType,
    form.mountingType,
    result.roofType,
    result.mountingType
  );
  return {
    mountingType: hasPv ? formatMountingType(mountingType) : "Brak / nie dotyczy",
    panelModel: hasPv ? panelModel : "Brak / nie dotyczy",
    panelPowerWp: hasPv && panelPowerWp > 0 ? `${formatNumber(panelPowerWp, 0)} Wp` : "Brak / nie dotyczy",
    panelCount: hasPv && panelCount > 0 ? `${formatNumber(panelCount, 0)} szt.` : "Brak / nie dotyczy",
    totalPowerKw: hasPv && totalPowerKw > 0 ? `${formatNumber(totalPowerKw)} kWp` : "Brak / nie dotyczy",
  };
}

function parseSupplySources(value: unknown): InstallationSupplySources | null {
  if (value === undefined || value === null) {
    return { ...DEFAULT_INSTALLATION_SUPPLY_SOURCES };
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const keys: Array<keyof InstallationSupplySources> = [
    "panels",
    "inverter",
    "energy_storage",
    "construction",
    "materials",
  ];
  const parsed = { ...DEFAULT_INSTALLATION_SUPPLY_SOURCES };

  for (const key of keys) {
    if (record[key] !== "ideasol" && record[key] !== "installer") return null;
    parsed[key] = record[key];
  }

  return parsed;
}

function parseIncludedItems(value: unknown): InstallationOrderIncludedItems | null {
  if (value === undefined || value === null) {
    return { ...DEFAULT_INSTALLATION_ORDER_INCLUDED_ITEMS };
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const keys: Array<keyof InstallationOrderIncludedItems> = [
    "panels",
    "inverter",
    "energy_storage",
    "construction",
    "materials",
  ];
  const parsed = { ...DEFAULT_INSTALLATION_ORDER_INCLUDED_ITEMS };

  for (const key of keys) {
    if (typeof record[key] !== "boolean") return null;
    parsed[key] = record[key];
  }

  return parsed;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];

  String(text || "")
    .split(/\r?\n/)
    .forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        return;
      }

      let line = words[0];
      for (const word of words.slice(1)) {
        const candidate = `${line} ${word}`;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    });

  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = rgb(0.1, 0.15, 0.2),
  lineHeight = size * 1.35
) {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, font, size, color });
  });
  return y - lines.length * lineHeight;
}

async function addImagePage(
  pdfDoc: PDFDocument,
  bytes: Uint8Array,
  fileName: string,
  kind: "jpg" | "png",
  regularFont: PDFFont
) {
  const image = kind === "jpg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const captionHeight = 28;
  const availableWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
  const availableHeight = PAGE_HEIGHT - PAGE_MARGIN * 2 - captionHeight;
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    x: (PAGE_WIDTH - width) / 2,
    y: PAGE_MARGIN + captionHeight + (availableHeight - height) / 2,
    width,
    height,
  });
  drawWrappedText(
    page,
    fileName,
    PAGE_MARGIN,
    28,
    availableWidth,
    regularFont,
    8,
    rgb(0.35, 0.4, 0.45),
    10
  );
}

function detectFileKind(bytes: Uint8Array, fileType: string | null, fileName: string) {
  const normalizedType = cleanText(fileType).toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (
    (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) ||
    normalizedType.includes("pdf") ||
    normalizedName.endsWith(".pdf")
  ) return "pdf" as const;

  if (
    (bytes[0] === 0xff && bytes[1] === 0xd8) ||
    normalizedType.includes("jpeg") ||
    normalizedType.includes("jpg") ||
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".jpeg")
  ) return "jpg" as const;

  if (
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    normalizedType.includes("png") ||
    normalizedName.endsWith(".png")
  ) return "png" as const;

  return "unsupported" as const;
}

async function appendSaleDocuments(
  pdfDoc: PDFDocument,
  documents: SaleDocument[],
  regularFont: PDFFont,
  skippedFiles: string[],
  onDocumentProcessed?: (document: SaleDocument) => Promise<void>
) {
  for (const document of documents) {
    const { data, error } = await supabaseAdmin.storage
      .from("sale-documents")
      .download(document.file_path);

    if (error || !data) {
      skippedFiles.push(`${document.file_name} - nie udało się pobrać`);
      await onDocumentProcessed?.(document);
      continue;
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const kind = detectFileKind(bytes, document.file_type, document.file_name);

    try {
      if (kind === "pdf") {
        const attachment = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copiedPages = await pdfDoc.copyPages(attachment, attachment.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));
      } else if (kind === "jpg" || kind === "png") {
        await addImagePage(pdfDoc, bytes, document.file_name, kind, regularFont);
      } else {
        skippedFiles.push(`${document.file_name} - nieobsługiwany format`);
      }
    } catch (error) {
      console.error("Nie udało się dołączyć dokumentu do zlecenia", {
        documentId: document.id,
        fileName: document.file_name,
        error,
      });
      skippedFiles.push(`${document.file_name} - uszkodzony lub nieobsługiwany plik`);
    } finally {
      await onDocumentProcessed?.(document);
    }
  }
}

type GenerationProgressContext = {
  jobId: string;
  saleId: string;
  userId: string;
};

async function updateGenerationProgress(
  context: GenerationProgressContext,
  progress: number,
  stage: string,
  options?: { error?: string | null; completed?: boolean }
) {
  const { error } = await supabaseAdmin
    .from("installation_order_generation_jobs")
    .update({
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      stage,
      error: options?.error ?? null,
      updated_at: new Date().toISOString(),
      completed_at: options?.completed ? new Date().toISOString() : null,
    })
    .eq("id", context.jobId)
    .eq("sale_id", context.saleId)
    .eq("user_id", context.userId);

  if (error) {
    console.error("Nie udało się zaktualizować postępu zlecenia montażu", error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  let progressContext: GenerationProgressContext | null = null;

  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });
    }

    const [{ data: profile }, { data: permission }] = await Promise.all([
      supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabaseAdmin
        .from("user_permissions")
        .select("realization")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const canGenerate =
      String(profile?.role || "") === "admin" || permission?.realization === true;

    if (!canGenerate) {
      return NextResponse.json({ error: "Brak uprawnienia Realizacja." }, { status: 403 });
    }

    const { id: saleId } = await context.params;
    const body = await request.json();
    const installerId = cleanText(body.installerId);
    const installationDate = cleanText(body.installationDate);
    const installationTime = cleanText(body.installationTime).slice(0, 5);
    const supplySources = parseSupplySources(body.supplySources);
    const includedItems = parseIncludedItems(body.includedItems);
    const generationJobId = cleanText(body.generationJobId);

    if (!installerId) {
      return NextResponse.json({ error: "Wybierz instalatora." }, { status: 400 });
    }
    if (!installationDate) {
      return NextResponse.json({ error: "Wybierz datę montażu." }, { status: 400 });
    }
    if (!isValidDateOnly(installationDate)) {
      return NextResponse.json({ error: "Nieprawidłowa data montażu." }, { status: 400 });
    }
    if (!isValidTimeOnly(installationTime)) {
      return NextResponse.json({ error: "Wybierz poprawną godzinę montażu." }, { status: 400 });
    }
    const installationAt = polishLocalDateTimeToIso(installationDate, installationTime);
    if (!installationAt) {
      return NextResponse.json(
        { error: "Wybrana data i godzina montażu nie istnieją w polskiej strefie czasowej." },
        { status: 400 }
      );
    }
    if (!supplySources) {
      return NextResponse.json({ error: "Nieprawidłowe źródło dostawy." }, { status: 400 });
    }
    if (!includedItems) {
      return NextResponse.json({ error: "Nieprawidłowy wybór elementów zlecenia." }, { status: 400 });
    }
    if (
      generationJobId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        generationJobId
      )
    ) {
      return NextResponse.json({ error: "Nieprawidłowy identyfikator generowania." }, { status: 400 });
    }

    const [saleResponse, installerResponse, documentsResponse] = await Promise.all([
      supabaseAdmin.from("sales").select("*").eq("id", saleId).maybeSingle(),
      supabaseAdmin
        .from("installers")
        .select("id, company_name, address, nip, contact_name, phone, email, active")
        .eq("id", installerId)
        .maybeSingle(),
      supabaseAdmin
        .from("sale_documents")
        .select("id, document_type, file_name, file_path, file_type, created_at")
        .eq("sale_id", saleId)
        .in("document_type", [...TECHNICAL_AUDIT_TYPES, ...PHOTO_TYPES])
        .order("created_at", { ascending: true }),
    ]);

    if (saleResponse.error || !saleResponse.data) {
      return NextResponse.json({ error: "Nie znaleziono sprzedaży." }, { status: 404 });
    }
    if (installerResponse.error || !installerResponse.data) {
      return NextResponse.json({ error: "Nie znaleziono instalatora." }, { status: 404 });
    }
    if (documentsResponse.error) {
      console.error("Błąd pobierania załączników zlecenia", documentsResponse.error);
      return NextResponse.json(
        { error: "Nie udało się pobrać dokumentów sprzedaży." },
        { status: 500 }
      );
    }

    const sale = saleResponse.data as SaleRecord;
    const installer = installerResponse.data as Installer;

    const normalizedRole = String(profile?.role || "seller").toLowerCase();
    let canAccessSale = ["admin", "owner", "cc"].includes(normalizedRole);

    if (!canAccessSale && sale.seller_id === user.id) {
      canAccessSale = true;
    }

    if (!canAccessSale && normalizedRole === "manager" && sale.seller_id) {
      const { data: sellerProfile } = await supabaseAdmin
        .from("profiles")
        .select("manager_id")
        .eq("id", sale.seller_id)
        .maybeSingle();
      canAccessSale = sellerProfile?.manager_id === user.id;
    }

    if (!canAccessSale) {
      return NextResponse.json(
        { error: "Nie masz dostępu do tej sprzedaży." },
        { status: 403 }
      );
    }

    if (!installer.active) {
      const { data: existingOrder } = await supabaseAdmin
        .from("installation_orders")
        .select("installer_id")
        .eq("sale_id", saleId)
        .maybeSingle();

      if (existingOrder?.installer_id !== installer.id) {
        return NextResponse.json({ error: "Wybrany instalator jest nieaktywny." }, { status: 400 });
      }
    }

    if (generationJobId) {
      const now = new Date().toISOString();
      const { error: progressStartError } = await supabaseAdmin
        .from("installation_order_generation_jobs")
        .insert({
          id: generationJobId,
          sale_id: saleId,
          user_id: user.id,
          progress: 8,
          stage: "Pobieranie danych zlecenia",
          error: null,
          started_at: now,
          updated_at: now,
          completed_at: null,
        });

      if (progressStartError) {
        console.error("Nie udało się rozpocząć śledzenia generowania", progressStartError);
        return NextResponse.json(
          { error: "Nie udało się uruchomić śledzenia postępu." },
          { status: 500 }
        );
      }

      progressContext = {
        jobId: generationJobId,
        saleId,
        userId: user.id,
      };
      await updateGenerationProgress(progressContext, 15, "Sprawdzanie danych instalatora");
    }

    let client: JsonRecord | null = null;
    if (sale.client_id) {
      const { data: clientData, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id, full_name, company_name, phone, address, street, building_number, postal_code, city")
        .eq("id", sale.client_id)
        .maybeSingle();
      if (clientError) console.error("Błąd pobierania klienta do zlecenia montażu", clientError);
      client = clientData;
    }

    if (progressContext) {
      await updateGenerationProgress(progressContext, 24, "Przygotowanie danych klienta i instalacji");
    }

    const installerSnapshot = {
      company_name: installer.company_name,
      address: installer.address,
      nip: installer.nip,
      contact_name: installer.contact_name,
      phone: installer.phone,
      email: installer.email,
    };
    const { error: orderError } = await supabaseAdmin.from("installation_orders").upsert(
      {
        sale_id: saleId,
        installer_id: installer.id,
        installation_date: installationDate,
        installation_time: installationTime,
        installation_at: installationAt,
        installer_snapshot: installerSnapshot,
        supply_sources: supplySources,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sale_id" }
    );

    if (orderError) {
      console.error("Błąd zapisu zlecenia montażu", orderError);
      if (progressContext) {
        await updateGenerationProgress(progressContext, 100, "Generowanie nie powiodło się", {
          completed: true,
          error: "Nie udało się zapisać danych zlecenia montażu.",
        });
      }
      return NextResponse.json(
        { error: "Nie udało się zapisać danych zlecenia montażu." },
        { status: 500 }
      );
    }

    const { error: saleScheduleError } = await supabaseAdmin
      .from("sales")
      .update({
        installation_date: installationDate,
        installation_time: installationTime,
        installation_at: installationAt,
        installation_installer_id: installer.id,
        installation_sms_reminder_attempted_at: null,
        installation_sms_reminder_sent_at: null,
        installation_sms_reminder_error: null,
      })
      .eq("id", saleId);

    if (saleScheduleError) {
      console.error("Błąd zapisu terminu montażu na sprzedaży", saleScheduleError);
      return NextResponse.json(
        { error: "Zlecenie zapisano, ale nie udało się zapisać terminu montażu na sprzedaży." },
        { status: 500 }
      );
    }

    if (progressContext) {
      await updateGenerationProgress(progressContext, 32, "Zapisywanie parametrów zlecenia w CRM");
    }

    const saleNumber = sale.sale_public_id
      ? cleanText(sale.sale_public_id)
      : sale.public_id
        ? `SID${String(sale.public_id).padStart(6, "0")}`
        : `SID-${sale.id.slice(0, 8).toUpperCase()}`;

    const customerData = (sale.customer_data || {}) as JsonRecord;
    const clientName = cleanText(
      firstValue(
        sale.customer_full_name,
        customerData.first_client_name,
        customerData.customer_full_name,
        client?.full_name,
        client?.company_name
      )
    ) || "Brak danych";
    const clientPhone = cleanText(
      firstValue(sale.customer_phone, customerData.phone, customerData.customer_phone, client?.phone)
    ) || "Brak danych";
    const scope = getInstallationOrderScope(sale);
    const equipment = getEquipment(sale);
    const installationAddress = getInstallationAddress(sale, client);
    const documents = (documentsResponse.data || []) as SaleDocument[];
    const auditDocuments = documents.filter((document) =>
      TECHNICAL_AUDIT_TYPES.includes(document.document_type || "")
    );
    const photoDocuments = documents.filter((document) =>
      PHOTO_TYPES.includes(document.document_type || "")
    );
    const pv = getPvDetails(sale, equipment.panel, scope.hasPv);
    const { pdfDoc, regularFont, boldFont } = await createInstallationOrderCover({
      saleNumber,
      installationDate: `${formatPolishDate(installationDate)}, godz. ${installationTime}`,
      installer: {
        companyName: installer.company_name,
        address: installer.address || "Brak danych",
        nip: installer.nip || "Brak danych",
        contactName: installer.contact_name || "Brak danych",
        phone: installer.phone || "Brak danych",
        email: installer.email || "Brak danych",
      },
      client: {
        name: clientName,
        phone: clientPhone,
        installationAddress,
      },
      pv,
      scope,
      equipment: {
        inverter: equipment.inverter,
        energyStorage: equipment.storage,
      },
      supplySources,
      includedItems,
      attachments: {
        audits: auditDocuments.length,
        photos: photoDocuments.length,
      },
    });

    if (progressContext) {
      await updateGenerationProgress(progressContext, 42, "Strona główna zlecenia jest gotowa");
    }

    const skippedFiles: string[] = [];
    const totalAttachments = auditDocuments.length + photoDocuments.length;
    let processedAttachments = 0;
    const reportAttachmentProgress = async (kind: "audyt" | "zdjęcia") => {
      processedAttachments += 1;
      if (!progressContext) return;

      const attachmentProgress =
        totalAttachments > 0
          ? 42 + (processedAttachments / totalAttachments) * 48
          : 90;
      const kindLabel = kind === "audyt" ? "audytu technicznego" : "zdjęć";
      await updateGenerationProgress(
        progressContext,
        attachmentProgress,
        `Dołączanie ${kindLabel}: ${processedAttachments} z ${totalAttachments}`
      );
    };

    if (totalAttachments === 0 && progressContext) {
      await updateGenerationProgress(progressContext, 90, "Brak załączników do dołączenia");
    }

    await appendSaleDocuments(pdfDoc, auditDocuments, regularFont, skippedFiles, () =>
      reportAttachmentProgress("audyt")
    );
    await appendSaleDocuments(pdfDoc, photoDocuments, regularFont, skippedFiles, () =>
      reportAttachmentProgress("zdjęcia")
    );

    if (skippedFiles.length > 0) {
      const warningPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      warningPage.drawText("PLIKI, KTÓRYCH NIE UDAŁO SIĘ DOŁĄCZYĆ", {
        x: PAGE_MARGIN,
        y: PAGE_HEIGHT - 70,
        font: boldFont,
        size: 16,
        color: rgb(0.7, 0.2, 0.15),
      });
      drawWrappedText(
        warningPage,
        skippedFiles.map((file) => `- ${file}`).join("\n"),
        PAGE_MARGIN,
        PAGE_HEIGHT - 110,
        PAGE_WIDTH - PAGE_MARGIN * 2,
        regularFont,
        10
      );
    }

    if (progressContext) {
      await updateGenerationProgress(progressContext, 96, "Finalne scalanie kompletnego PDF");
    }

    const pdfBytes = await pdfDoc.save();

    if (progressContext) {
      await updateGenerationProgress(progressContext, 100, "Zlecenie montażu jest gotowe", {
        completed: true,
      });
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="zlecenie-montazu-${saleNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Błąd generatora zlecenia montażu", error);
    if (progressContext) {
      const errorMessage = error instanceof Error ? error.message : "Nieznany błąd generowania.";
      await updateGenerationProgress(progressContext, 100, "Generowanie nie powiodło się", {
        completed: true,
        error: errorMessage,
      });
    }
    return NextResponse.json(
      { error: "Nie udało się wygenerować zlecenia montażu." },
      { status: 500 }
    );
  }
}
