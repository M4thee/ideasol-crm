import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
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

function drawSectionTitle(page: PDFPage, title: string, y: number, boldFont: PDFFont) {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 5,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 25,
    color: rgb(0.92, 0.97, 0.96),
  });
  page.drawText(title, {
    x: PAGE_MARGIN + 10,
    y: y + 3,
    font: boldFont,
    size: 11,
    color: rgb(0.04, 0.45, 0.4),
  });
}

function drawField(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  regularFont: PDFFont,
  boldFont: PDFFont
) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    font: boldFont,
    size: 7.5,
    color: rgb(0.4, 0.45, 0.5),
  });
  return drawWrappedText(
    page,
    value || "Brak danych",
    x,
    y - 15,
    width,
    regularFont,
    10,
    rgb(0.08, 0.12, 0.16),
    13
  );
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
  skippedFiles: string[]
) {
  for (const document of documents) {
    const { data, error } = await supabaseAdmin.storage
      .from("sale-documents")
      .download(document.file_path);

    if (error || !data) {
      skippedFiles.push(`${document.file_name} - nie udało się pobrać`);
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
    }
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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
      ["admin", "owner"].includes(String(profile?.role || "")) ||
      permission?.realization === true;

    if (!canGenerate) {
      return NextResponse.json({ error: "Brak uprawnienia Realizacja." }, { status: 403 });
    }

    const { id: saleId } = await context.params;
    const body = await request.json();
    const installerId = cleanText(body.installerId);
    const installationDate = cleanText(body.installationDate);

    if (!installerId) {
      return NextResponse.json({ error: "Wybierz instalatora." }, { status: 400 });
    }
    if (!installationDate) {
      return NextResponse.json({ error: "Wybierz datę montażu." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(installationDate)) {
      return NextResponse.json({ error: "Nieprawidłowa data montażu." }, { status: 400 });
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
        installer_snapshot: installerSnapshot,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sale_id" }
    );

    if (orderError) {
      console.error("Błąd zapisu zlecenia montażu", orderError);
      return NextResponse.json(
        { error: "Nie udało się zapisać danych zlecenia montażu." },
        { status: 500 }
      );
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const regularFontBytes = await readFile(
      path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")
    );
    let boldFontBytes = regularFontBytes;
    try {
      boldFontBytes = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"));
    } catch {
      boldFontBytes = regularFontBytes;
    }

    const regularFont = await pdfDoc.embedFont(regularFontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 112,
      width: PAGE_WIDTH,
      height: 112,
      color: rgb(0.035, 0.43, 0.38),
    });
    page.drawText("ZLECENIE MONTAŻU", {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 68,
      font: boldFont,
      size: 24,
      color: rgb(1, 1, 1),
    });

    const saleNumber = sale.sale_public_id
      ? cleanText(sale.sale_public_id)
      : sale.public_id
        ? `SID${String(sale.public_id).padStart(6, "0")}`
        : `SID-${sale.id.slice(0, 8).toUpperCase()}`;
    page.drawText(saleNumber, {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 91,
      font: regularFont,
      size: 10,
      color: rgb(0.86, 1, 0.97),
    });

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
    const equipment = getEquipment(sale);
    const installationAddress = getInstallationAddress(sale, client);

    let y = PAGE_HEIGHT - 150;
    drawSectionTitle(page, "Dane zlecenia", y, boldFont);
    y -= 34;
    drawField(page, "Data montażu", formatPolishDate(installationDate), PAGE_MARGIN, y, 230, regularFont, boldFont);
    drawField(page, "Numer sprzedaży", saleNumber, 315, y, 238, regularFont, boldFont);
    y -= 58;
    drawSectionTitle(page, "Instalator", y, boldFont);
    y -= 34;
    drawField(page, "Nazwa firmy", installer.company_name, PAGE_MARGIN, y, 300, regularFont, boldFont);
    drawField(page, "NIP", installer.nip || "Brak danych", 385, y, 168, regularFont, boldFont);
    y -= 48;
    drawField(page, "Adres", installer.address || "Brak danych", PAGE_MARGIN, y, 511, regularFont, boldFont);
    y -= 48;
    drawField(page, "Osoba kontaktowa", installer.contact_name || "Brak danych", PAGE_MARGIN, y, 230, regularFont, boldFont);
    drawField(page, "Telefon", installer.phone || "Brak danych", 285, y, 130, regularFont, boldFont);
    drawField(page, "E-mail", installer.email || "Brak danych", 430, y, 123, regularFont, boldFont);
    y -= 62;
    drawSectionTitle(page, "Klient i miejsce montażu", y, boldFont);
    y -= 34;
    drawField(page, "Klient", clientName, PAGE_MARGIN, y, 300, regularFont, boldFont);
    drawField(page, "Telefon", clientPhone, 385, y, 168, regularFont, boldFont);
    y -= 52;
    drawField(page, "Adres montażu", installationAddress, PAGE_MARGIN, y, 511, regularFont, boldFont);
    y -= 66;
    drawSectionTitle(page, "Urządzenia", y, boldFont);
    y -= 34;
    drawField(page, "Model panela", equipment.panel, PAGE_MARGIN, y, 245, regularFont, boldFont);
    drawField(page, "Model falownika", equipment.inverter, 308, y, 245, regularFont, boldFont);
    y -= 56;
    drawField(page, "Model magazynu energii", equipment.storage, PAGE_MARGIN, y, 511, regularFont, boldFont);

    const documents = (documentsResponse.data || []) as SaleDocument[];
    const auditDocuments = documents.filter((document) =>
      TECHNICAL_AUDIT_TYPES.includes(document.document_type || "")
    );
    const photoDocuments = documents.filter((document) =>
      PHOTO_TYPES.includes(document.document_type || "")
    );
    page.drawText(
      `Załączniki: audyt techniczny - ${auditDocuments.length}, zdjęcia - ${photoDocuments.length}`,
      {
        x: PAGE_MARGIN,
        y: 35,
        font: regularFont,
        size: 8,
        color: rgb(0.4, 0.45, 0.5),
      }
    );

    const skippedFiles: string[] = [];
    await appendSaleDocuments(pdfDoc, auditDocuments, regularFont, skippedFiles);
    await appendSaleDocuments(pdfDoc, photoDocuments, regularFont, skippedFiles);

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

    const pdfBytes = await pdfDoc.save();
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
    return NextResponse.json(
      { error: "Nie udało się wygenerować zlecenia montażu." },
      { status: 500 }
    );
  }
}
