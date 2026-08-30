import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTeamsSaleChannelNotification } from "@/lib/microsoftTeams";
import { DOCUMENT_GROUPS, type DocumentGroupKey } from "@/lib/saleDocumentGrouping";
import { appendIdeaSignAuditEvent, type IdeaSignAccessContext, verifyIdeaSignOtp } from "./server";
import { sha256 } from "./security";
import {
  SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE,
  SALE_STATUS_DOCUMENT_REVIEW,
} from "./lifecycle";

type FrozenDocumentRow = {
  id: string;
  kind: string;
  title: string;
  file_name: string;
  storage_path: string;
  crm_container_key: DocumentGroupKey;
  mime_type: string;
  byte_size: number;
  sha256: string;
  acceptance_required: boolean;
  sort_order: number;
};

function mailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.MAIL_FROM || process.env.SMTP_FROM;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) throw new Error("Brak konfiguracji SMTP dla IdeaSign.");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });
}

function formatWarsawDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function splitText(text: string, maxChars = 92) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function downloadFrozenDocument(document: FrozenDocumentRow) {
  const { data, error } = await supabaseAdmin.storage
    .from("ideasign-documents")
    .download(document.storage_path);
  if (error || !data) throw new Error(`Nie udało się pobrać dokumentu ${document.id}.`);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (sha256(bytes) !== document.sha256 || bytes.length !== Number(document.byte_size)) {
    throw new Error(`Integralność zamrożonego dokumentu ${document.id} nie została potwierdzona.`);
  }
  return bytes;
}

async function buildSignedPdf(params: {
  documentBytes: Buffer;
  documentTitle: string;
  primaryAgreement: boolean;
  concludedAt: string;
  transactionId: string;
  contractNumber: string;
  clientName: string;
  clientAddress: string;
  offerorName: string;
  offerorCapacity: string;
  manifestSha256: string;
  documentSha256: string;
}) {
  const pdf = await PDFDocument.load(params.documentBytes);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")),
    { subset: true }
  );
  const page = pdf.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  let y = height - 62;
  const draw = (text: string, size = 10, color = rgb(0.15, 0.2, 0.28), gap = 17) => {
    for (const line of splitText(text, size >= 16 ? 60 : 94)) {
      page.drawText(line, { x: 52, y, size, font, color });
      y -= gap;
    }
  };

  draw(
    params.primaryAgreement
      ? "UMOWA ZAWARTA DROGĄ ELEKTRONICZNĄ"
      : "DOKUMENT ZAAKCEPTOWANY ELEKTRONICZNIE",
    18,
    rgb(0.02, 0.39, 0.65),
    26
  );
  y -= 6;
  draw(params.documentTitle, 11, rgb(0.3, 0.36, 0.44), 20);
  y -= 16;
  draw(`Data i godzina zawarcia: ${formatWarsawDate(params.concludedAt)} (Europe/Warsaw)`);
  draw(`ID transakcji: ${params.transactionId}`);
  draw(`Numer umowy: ${params.contractNumber}`);
  y -= 12;
  draw("STRONY", 12, rgb(0.05, 0.12, 0.2), 22);
  draw("IdeaSol Sp. z o.o. — oferent");
  draw(`Osoba składająca ofertę: ${params.offerorName}`);
  draw(`Umocowanie/rola w procesie: ${params.offerorCapacity}`);
  y -= 5;
  draw(`${params.clientName} — klient przyjmujący ofertę`);
  if (params.clientAddress) draw(`Adres klienta: ${params.clientAddress}`);
  y -= 12;
  draw("OŚWIADCZENIE", 12, rgb(0.05, 0.12, 0.2), 22);
  draw("Klient zapoznał się osobno z każdym dokumentem wskazanym w manifeście, zaakceptował jego treść i potwierdził przyjęcie oferty drugim jednorazowym kodem SMS przypisanym do poniższego manifestu. Z tą chwilą umowa została zawarta z obowiązkiem zapłaty.");
  y -= 12;
  draw("INTEGRALNOŚĆ", 12, rgb(0.05, 0.12, 0.2), 22);
  draw(`SHA-256 zaakceptowanej wersji dokumentu: ${params.documentSha256}`, 8, rgb(0.3, 0.36, 0.44), 14);
  draw(`SHA-256 manifestu wszystkich dokumentów: ${params.manifestSha256}`, 8, rgb(0.3, 0.36, 0.44), 14);
  y -= 16;
  draw("Dokument wygenerowany automatycznie przez IdeaSign. Pełny ślad audytowy obejmuje m.in. znaczniki czasu, identyfikator sesji, adres IP i metadane przeglądarki oraz niezmienny łańcuch hashy zdarzeń.", 8, rgb(0.42, 0.47, 0.54), 14);

  return Buffer.from(await pdf.save());
}

export async function finalizeIdeaSignContract(params: {
  context: IdeaSignAccessContext;
  code: string;
  request: Request;
}) {
  const verified = await verifyIdeaSignOtp(params.context, "signature", params.code, params.request);
  if (!verified.ok) return verified;

  const [{ data: signature, error: signatureError }, { data: documents, error: documentsError }, { data: acceptances }] =
    await Promise.all([
      supabaseAdmin
        .from("contract_signature_sessions")
        .select("id, transaction_id, sale_id, client_id, created_by, client_name, client_email, offeror_name, offeror_capacity, manifest_sha256, status")
        .eq("id", params.context.signature.id)
        .maybeSingle(),
      supabaseAdmin
        .from("contract_signature_documents")
        .select("id, kind, title, file_name, storage_path, crm_container_key, mime_type, byte_size, sha256, acceptance_required, sort_order")
        .eq("signature_session_id", params.context.signature.id)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("contract_signature_acceptances")
        .select("document_id, document_sha256")
        .eq("signature_session_id", params.context.signature.id),
    ]);

  if (signatureError || !signature || documentsError || !documents?.length) {
    throw new Error("Nie udało się odczytać zamrożonego pakietu IdeaSign.");
  }
  if (signature.status !== "oczekuje_na_podpis_klienta") {
    return { ok: false as const, status: 409, error: "Umowa nie oczekuje na podpis klienta." };
  }

  const acceptanceMap = new Map((acceptances || []).map((item) => [item.document_id, item.document_sha256]));
  const missingAcceptance = (documents as FrozenDocumentRow[]).some(
    (document) => document.acceptance_required && acceptanceMap.get(document.id) !== document.sha256
  );
  if (missingAcceptance) {
    return { ok: false as const, status: 422, error: "Nie wszystkie dokumenty zostały poprawnie zaakceptowane." };
  }

  const frozenDocuments = documents as FrozenDocumentRow[];
  const agreement = frozenDocuments.find((document) => document.kind === "agreement");
  if (!agreement) throw new Error("Brak zamrożonego PDF umowy.");
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("contract_number, public_id, sale_public_id, customer_data")
    .eq("id", signature.sale_id)
    .maybeSingle();
  const { data: client } = signature.client_id
    ? await supabaseAdmin.from("clients").select("address, street, building_number, postal_code, city").eq("id", signature.client_id).maybeSingle()
    : { data: null };
  const customer = (sale?.customer_data || {}) as Record<string, unknown>;
  const clientAddress = String(
    customer.contract_address || client?.address ||
      [client?.street, client?.building_number, client?.postal_code, client?.city].filter(Boolean).join(" ")
  ).trim();
  const contractNumber = String(sale?.contract_number || sale?.sale_public_id || sale?.public_id || signature.transaction_id);
  const concludedAt = new Date().toISOString();
  const signedDocuments = await Promise.all(
    frozenDocuments.map(async (document) => {
      const documentBytes = await downloadFrozenDocument(document);
      const signedBytes = await buildSignedPdf({
        documentBytes,
        documentTitle: document.title,
        primaryAgreement: document.id === agreement.id,
        concludedAt,
        transactionId: signature.transaction_id,
        contractNumber,
        clientName: signature.client_name,
        clientAddress,
        offerorName: signature.offeror_name,
        offerorCapacity: signature.offeror_capacity,
        manifestSha256: signature.manifest_sha256,
        documentSha256: document.sha256,
      });
      const finalFileName =
        document.id === agreement.id
          ? `umowa-zawarta-${signature.transaction_id}.pdf`
          : `podpisany-${document.file_name}`;
      const finalStoragePath = `${signature.id}/final/${String(document.sort_order + 1).padStart(2, "0")}-${finalFileName}`;
      const { error: signedUploadError } = await supabaseAdmin.storage
        .from("ideasign-documents")
        .upload(finalStoragePath, signedBytes, { contentType: "application/pdf", upsert: false });
      if (signedUploadError) {
        throw new Error(`Nie udało się zapisać podpisanego dokumentu ${document.title}: ${signedUploadError.message}`);
      }
      return {
        document,
        bytes: signedBytes,
        sha256: sha256(signedBytes),
        fileName: finalFileName,
        storagePath: finalStoragePath,
      };
    })
  );
  const finalAgreement = signedDocuments.find((item) => item.document.id === agreement.id);
  if (!finalAgreement) throw new Error("Nie udało się przygotować końcowego PDF umowy.");
  const finalBytes = finalAgreement.bytes;
  const finalHash = sha256(finalBytes);
  const finalPath = finalAgreement.storagePath;

  const { data: concluded, error: concludeError } = await supabaseAdmin
    .from("contract_signature_sessions")
    .update({
      status: "zawarta",
      concluded_at: concludedAt,
      final_pdf_storage_path: finalPath,
      final_pdf_sha256: finalHash,
      updated_at: concludedAt,
    })
    .eq("id", signature.id)
    .eq("status", "oczekuje_na_podpis_klienta")
    .select("id")
    .maybeSingle();
  if (concludeError || !concluded) {
    return { ok: false as const, status: 409, error: "Umowa została już przetworzona w innej sesji." };
  }

  await appendIdeaSignAuditEvent({
    signatureSessionId: signature.id,
    eventType: "contract_concluded",
    request: params.request,
    eventData: {
      transactionId: signature.transaction_id,
      challengeId: verified.challengeId,
      manifestSha256: signature.manifest_sha256,
      finalPdfSha256: finalHash,
      signedDocumentHashes: signedDocuments.map((item) => ({
        documentId: item.document.id,
        sha256: item.sha256,
      })),
    },
  });

  const failedChannels: string[] = [];
  let crmFailed = false;
  for (const [index, signedDocument] of signedDocuments.entries()) {
    const crmPath = `${signature.sale_id}/ideasign/${signature.transaction_id}/${String(index + 1).padStart(2, "0")}-${signedDocument.fileName}`;
    const { error: crmUploadError } = await supabaseAdmin.storage
      .from("sale-documents")
      .upload(crmPath, signedDocument.bytes, { contentType: "application/pdf", upsert: false });
    if (crmUploadError) {
      crmFailed = true;
      continue;
    }

    const group = DOCUMENT_GROUPS.find(
      (item) => item.key === signedDocument.document.crm_container_key
    );
    const { error: crmDocumentError } = await supabaseAdmin.from("sale_documents").insert({
      sale_id: signature.sale_id,
      client_id: signature.client_id,
      uploaded_by: signature.created_by,
      description: `${signedDocument.document.title} — podpis elektroniczny IdeaSign ${signature.transaction_id}`,
      document_type: group?.title || "Inne",
      file_name: signedDocument.fileName,
      file_path: crmPath,
      file_type: "application/pdf",
      file_size: signedDocument.bytes.length,
    });
    if (crmDocumentError) crmFailed = true;
  }

  const { error: saleStatusError } = await supabaseAdmin
    .from("sales")
    .update({ status: SALE_STATUS_DOCUMENT_REVIEW })
    .eq("id", signature.sale_id)
    .eq("status", SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE);
  if (saleStatusError) failedChannels.push("sale_status");
  if (crmFailed) failedChannels.push("crm");

  try {
    const attachments = signedDocuments.map((item) => ({
      filename: item.fileName,
      content: item.bytes,
      contentType: "application/pdf",
    }));
    await mailTransport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: signature.client_email,
      subject: `Umowa ${contractNumber} została zawarta — IdeaSign`,
      text: `Dzień dobry,\n\nUmowa ${contractNumber} została zawarta drogą elektroniczną ${formatWarsawDate(concludedAt)}.\nID transakcji: ${signature.transaction_id}\nSHA-256 końcowego PDF: ${finalHash}\n\nW załączeniu przesyłamy końcowy PDF oraz załączniki.\n\nIdeaSol Sp. z o.o.`,
      attachments,
    });
  } catch {
    failedChannels.push("email");
  }

  try {
    await sendTeamsSaleChannelNotification({
      message: `<strong>IdeaSign: umowa zawarta</strong>\nNumer umowy: ${contractNumber}\nID transakcji: ${signature.transaction_id}\nData: ${formatWarsawDate(concludedAt)}`,
    });
  } catch {
    failedChannels.push("teams");
  }

  if (failedChannels.length) {
    await supabaseAdmin
      .from("contract_signature_sessions")
      .update({ last_error: `POST_CONCLUSION_FAILED:${failedChannels.join(",")}`, updated_at: new Date().toISOString() })
      .eq("id", signature.id);
    await appendIdeaSignAuditEvent({
      signatureSessionId: signature.id,
      eventType: "post_conclusion_delivery_failed",
      request: params.request,
      eventData: { failedChannels },
    });
  } else {
    await appendIdeaSignAuditEvent({
      signatureSessionId: signature.id,
      eventType: "post_conclusion_delivery_completed",
      request: params.request,
      eventData: { channels: ["crm", "email", "teams"] },
    });
  }

  return { ok: true as const, concludedAt, transactionId: signature.transaction_id, finalPdfSha256: finalHash };
}
