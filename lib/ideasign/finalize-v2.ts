import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTeamsSaleChannelNotification } from "@/lib/microsoftTeams";
import { DOCUMENT_GROUPS, type DocumentGroupKey } from "@/lib/saleDocumentGrouping";
import { appendIdeaSignAuditEvent, type IdeaSignAccessContext, verifyIdeaSignOtp } from "./server";
import { getIdeaSignDeliveryPassword, getIdeaSignOwnerPassword } from "./password";
import { getRequestEvidence, sha256 } from "./security";
import {
  ACTIVE_IDEASIGN_SALE_STATUSES,
  getConcludedIdeaSignSaleStatus,
  SALE_STATUS_IDEASIGN_PARTIALLY_SIGNED,
} from "./lifecycle";
import { renderIdeaSignCompletedEmail } from "./email";

type FrozenDocumentRow = {
  id: string; kind: string; title: string; file_name: string; storage_path: string;
  crm_container_key: DocumentGroupKey; mime_type: string; byte_size: number;
  sha256: string; acceptance_required: boolean; sort_order: number;
};

type SignerRow = {
  id: string; signer_order: number; name: string; email: string;
  status: string; signed_at: string | null;
};

type SignatureRow = {
  id: string; transaction_id: string; sale_id: string; client_id: string | null;
  created_by: string; offeror_name: string; offeror_capacity: string;
  manifest_sha256: string; status: string; concluded_at: string | null;
  final_pdf_storage_path: string | null; final_pdf_sha256: string | null;
};

type DeliveryJobRow = {
  id: string; signature_session_id: string; signer_id: string | null;
  channel: "crm" | "sale_status" | "email" | "teams"; attempts: number;
};

function mailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.MAIL_FROM || process.env.SMTP_FROM;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) throw new Error("Brak konfiguracji SMTP dla IdeaSign.");
  return nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port === 587, auth: { user, pass } });
}

function formatWarsawDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Warsaw" }).format(new Date(value));
}

function splitText(text: string, maxChars = 92) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) { lines.push(current); current = word; }
    else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

async function downloadFrozenDocument(document: FrozenDocumentRow) {
  const { data, error } = await supabaseAdmin.storage.from("ideasign-documents").download(document.storage_path);
  if (error || !data) throw new Error(`Nie udało się pobrać dokumentu ${document.id}.`);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (sha256(bytes) !== document.sha256 || bytes.length !== Number(document.byte_size)) {
    throw new Error(`Integralność zamrożonego dokumentu ${document.id} nie została potwierdzona.`);
  }
  return bytes;
}

async function embedCertificateFont(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")), { subset: true });
}

function appendCertificatePage(params: {
  pdf: PDFDocument; font: PDFFont; heading: string; documentTitle: string;
  concludedAt: string; transactionId: string; contractNumber: string;
  clientAddress: string; offerorName: string; offerorCapacity: string;
  manifestSha256: string; documentSha256?: string; signers: SignerRow[];
}) {
  const page = params.pdf.addPage([595.28, 841.89]);
  let y = page.getHeight() - 58;
  const draw = (text: string, size = 10, color = rgb(0.15, 0.2, 0.28), gap = 16) => {
    for (const line of splitText(text, size >= 16 ? 60 : 94)) {
      page.drawText(line, { x: 52, y, size, font: params.font, color });
      y -= gap;
    }
  };
  draw(params.heading, 18, rgb(0.02, 0.39, 0.65), 25);
  draw(params.documentTitle, 10, rgb(0.3, 0.36, 0.44), 19);
  y -= 8;
  draw(`Data i godzina zawarcia: ${formatWarsawDate(params.concludedAt)} (Europe/Warsaw)`);
  draw(`ID transakcji: ${params.transactionId}`);
  draw(`Numer umowy: ${params.contractNumber}`);
  y -= 8;
  draw("STRONY I OŚWIADCZENIA", 12, rgb(0.05, 0.12, 0.2), 21);
  draw("IdeaSol Sp. z o.o. — oferent");
  draw(`Osoba składająca ofertę: ${params.offerorName}`);
  draw(`Rola w procesie: ${params.offerorCapacity}`);
  y -= 4;
  params.signers.forEach((signer) => {
    draw(`${signer.name} — osoba podpisująca ${signer.signer_order}; potwierdzenie SMS: ${formatWarsawDate(signer.signed_at || params.concludedAt)}`);
  });
  if (params.clientAddress) draw(`Adres klientów: ${params.clientAddress}`);
  y -= 8;
  draw("Klienci otworzyli i zaakceptowali osobno każdy wymagany dokument, a następnie potwierdzili przyjęcie oferty własnymi kodami SMS przypisanymi do niezmiennego manifestu. Z chwilą potwierdzenia przez ostatnią wymaganą osobę umowa została zawarta z obowiązkiem zapłaty.");
  y -= 8;
  draw("INTEGRALNOŚĆ", 12, rgb(0.05, 0.12, 0.2), 21);
  if (params.documentSha256) draw(`SHA-256 źródłowej wersji dokumentu: ${params.documentSha256}`, 8, rgb(0.3, 0.36, 0.44), 13);
  draw(`SHA-256 manifestu pakietu: ${params.manifestSha256}`, 8, rgb(0.3, 0.36, 0.44), 13);
  y -= 10;
  draw("Dokument wygenerowany automatycznie przez IdeaSign. Ślad audytowy obejmuje znaczniki czasu, niezależne sesje podpisujących, adresy IP, metadane przeglądarek, otwarcia dokumentów i łańcuch hashy zdarzeń.", 8, rgb(0.42, 0.47, 0.54), 13);
}

async function buildSignedDocument(params: {
  bytes: Buffer; document: FrozenDocumentRow; concludedAt: string; transactionId: string;
  contractNumber: string; clientAddress: string; offerorName: string;
  offerorCapacity: string; manifestSha256: string; signers: SignerRow[];
}) {
  const pdf = await PDFDocument.load(params.bytes);
  const font = await embedCertificateFont(pdf);
  appendCertificatePage({
    pdf, font,
    heading: params.document.kind === "agreement" ? "UMOWA ZAWARTA DROGĄ ELEKTRONICZNĄ" : "DOKUMENT ZAAKCEPTOWANY ELEKTRONICZNIE",
    documentTitle: params.document.title, concludedAt: params.concludedAt,
    transactionId: params.transactionId, contractNumber: params.contractNumber,
    clientAddress: params.clientAddress, offerorName: params.offerorName,
    offerorCapacity: params.offerorCapacity, manifestSha256: params.manifestSha256,
    documentSha256: params.document.sha256, signers: params.signers,
  });
  return Buffer.from(await pdf.save());
}

async function buildMergedPackage(params: {
  documents: Array<{ document: FrozenDocumentRow; bytes: Buffer }>;
  concludedAt: string; transactionId: string; contractNumber: string; clientAddress: string;
  offerorName: string; offerorCapacity: string; manifestSha256: string; signers: SignerRow[];
}) {
  const pdf = await PDFDocument.create();
  for (const item of params.documents) {
    const source = await PDFDocument.load(item.bytes);
    const pages = await pdf.copyPages(source, source.getPageIndices());
    pages.forEach((page) => pdf.addPage(page));
  }
  const font = await embedCertificateFont(pdf);
  appendCertificatePage({
    ...params, pdf, font, heading: "UMOWA ZAWARTA DROGĄ ELEKTRONICZNĄ",
    documentTitle: "Scalony pakiet: umowa i wszystkie wymagane załączniki",
  });
  return Buffer.from(await pdf.save());
}

export async function finalizeIdeaSignContractV2(params: { context: IdeaSignAccessContext; code: string; request: Request }) {
  const verified = await verifyIdeaSignOtp(params.context, "signature", params.code, params.request);
  if (!verified.ok) return verified;

  const [{ data: signature }, { data: documents, error: documentsError }, { data: acceptances }] = await Promise.all([
    supabaseAdmin.from("contract_signature_sessions").select("id, transaction_id, sale_id, client_id, created_by, offeror_name, offeror_capacity, manifest_sha256, status").eq("id", params.context.signature.id).maybeSingle(),
    supabaseAdmin.from("contract_signature_documents").select("id, kind, title, file_name, storage_path, crm_container_key, mime_type, byte_size, sha256, acceptance_required, sort_order").eq("signature_session_id", params.context.signature.id).order("sort_order", { ascending: true }),
    supabaseAdmin.from("contract_signature_acceptances").select("document_id, document_sha256").eq("signature_session_id", params.context.signature.id).eq("signer_id", params.context.signer.id),
  ]);
  if (!signature || documentsError || !documents?.length) throw new Error("Nie udało się odczytać zamrożonego pakietu IdeaSign.");
  if (["zawarta", "wygasła", "anulowana"].includes(signature.status)) return { ok: false as const, status: 409, error: "Ten proces nie oczekuje już na podpis." };

  const acceptanceMap = new Map((acceptances || []).map((item) => [item.document_id, item.document_sha256]));
  if ((documents as FrozenDocumentRow[]).some((document) => document.acceptance_required && acceptanceMap.get(document.id) !== document.sha256)) {
    return { ok: false as const, status: 422, error: "Nie wszystkie dokumenty zostały poprawnie zaakceptowane." };
  }

  const requestedSignedAt = new Date().toISOString();
  const password = getIdeaSignDeliveryPassword(signature.id, params.context.signer.id);
  const evidence = getRequestEvidence(params.request);
  const signerEventData = {
    challengeId: verified.challengeId,
    manifestSha256: signature.manifest_sha256,
  };
  const { data: claimData, error: claimError } = await supabaseAdmin.rpc("claim_ideasign_signature", {
    p_signature_session_id: signature.id,
    p_signer_id: params.context.signer.id,
    p_signed_at: requestedSignedAt,
    p_delivery_password_sha256: sha256(password),
    p_ip_address: evidence.ipAddress,
    p_user_agent: evidence.userAgent,
    p_session_metadata: evidence.sessionMetadata,
    p_event_data: signerEventData,
  });
  if (claimError) throw new Error(`Nie udało się bezpiecznie zarejestrować podpisu: ${claimError.message}`);

  const claim = (claimData || {}) as {
    mode?: string; signedAt?: string; waitingForSigners?: number;
  };
  if (claim.mode === "partial") {
    const { error: saleStatusError } = await supabaseAdmin
      .from("sales")
      .update({ status: SALE_STATUS_IDEASIGN_PARTIALLY_SIGNED })
      .eq("id", signature.sale_id)
      .in("status", [...ACTIVE_IDEASIGN_SALE_STATUSES]);
    if (saleStatusError) {
      await supabaseAdmin
        .from("contract_signature_sessions")
        .update({ last_error: "SALE_STATUS_SYNC_FAILED", updated_at: new Date().toISOString() })
        .eq("id", signature.id);
      console.error("[IdeaSign] Failed to sync partial-signature sale status", {
        signatureSessionId: signature.id,
        saleId: signature.sale_id,
        code: saleStatusError.code,
        message: saleStatusError.message,
      });
    }
    return {
      ok: true as const,
      contractConcluded: false as const,
      signedAt: claim.signedAt || requestedSignedAt,
      waitingForSigners: Number(claim.waitingForSigners || 1),
      transactionId: signature.transaction_id,
      password,
    };
  }
  if (claim.mode === "busy") {
    return { ok: false as const, status: 409, error: "Końcowy dokument jest właśnie przygotowywany. Spróbuj ponownie za chwilę." };
  }
  if (claim.mode !== "finalizing") {
    return { ok: false as const, status: 409, error: "Ten podpis został już złożony albo proces został zakończony." };
  }

  const signedAt = claim.signedAt || requestedSignedAt;

  const { data: signersData } = await supabaseAdmin.from("contract_signature_signers").select("id, signer_order, name, email, status, signed_at").eq("signature_session_id", signature.id).order("signer_order");
  const signers = ((signersData || []) as SignerRow[]).map((signer) =>
    signer.id === params.context.signer.id
      ? { ...signer, status: "podpisany", signed_at: signedAt }
      : signer
  );
  if (signers.some((signer) => signer.status !== "podpisany")) {
    throw new Error("Nie wszyscy wymagani podpisujący potwierdzili umowę.");
  }

  const frozenDocuments = documents as FrozenDocumentRow[];
  const { data: sale } = await supabaseAdmin.from("sales").select("contract_number, public_id, sale_public_id, customer_data").eq("id", signature.sale_id).maybeSingle();
  const { data: client } = signature.client_id
    ? await supabaseAdmin.from("clients").select("address, street, building_number, postal_code, city").eq("id", signature.client_id).maybeSingle()
    : { data: null };
  const customer = (sale?.customer_data || {}) as Record<string, unknown>;
  const clientAddress = String(customer.contract_address || client?.address || [client?.street, client?.building_number, client?.postal_code, client?.city].filter(Boolean).join(" ")).trim();
  const contractNumber = String(sale?.contract_number || sale?.sale_public_id || sale?.public_id || signature.transaction_id);
  const rawDocuments = await Promise.all(frozenDocuments.map(async (document) => ({ document, bytes: await downloadFrozenDocument(document) })));
  const mergedBytes = await buildMergedPackage({
    documents: rawDocuments, concludedAt: signedAt, transactionId: signature.transaction_id,
    contractNumber, clientAddress, offerorName: signature.offeror_name,
    offerorCapacity: signature.offeror_capacity, manifestSha256: signature.manifest_sha256, signers,
  });
  const finalHash = sha256(mergedBytes);
  const finalPath = `${signature.id}/final/umowa-zalaczniki-${signature.transaction_id}.pdf`;
  const { error: mergedUploadError } = await supabaseAdmin.storage.from("ideasign-documents").upload(finalPath, mergedBytes, { contentType: "application/pdf", upsert: true });
  if (mergedUploadError) throw new Error(`Nie udało się zapisać scalonego PDF: ${mergedUploadError.message}`);

  const { data: conclusionData, error: conclusionError } = await supabaseAdmin.rpc("complete_ideasign_conclusion", {
    p_signature_session_id: signature.id,
    p_signer_id: params.context.signer.id,
    p_delivery_password_sha256: sha256(password),
    p_final_pdf_storage_path: finalPath,
    p_final_pdf_sha256: finalHash,
    p_ip_address: evidence.ipAddress,
    p_user_agent: evidence.userAgent,
    p_session_metadata: evidence.sessionMetadata,
    p_signer_event_data: signerEventData,
    p_conclusion_event_data: {
      transactionId: signature.transaction_id,
      manifestSha256: signature.manifest_sha256,
      finalPdfSha256: finalHash,
      signerCount: signers.length,
    },
  });
  if (conclusionError) throw new Error(`Nie udało się atomowo zawrzeć umowy: ${conclusionError.message}`);
  const conclusion = (conclusionData || {}) as { mode?: string; concludedAt?: string };
  if (!["concluded", "already_concluded"].includes(String(conclusion.mode))) {
    return { ok: false as const, status: 409, error: "Umowa została już przetworzona w innej sesji." };
  }

  await processPendingIdeaSignDeliveries({ signatureSessionId: signature.id, request: params.request, limit: 10 });
  return {
    ok: true as const,
    contractConcluded: true as const,
    concludedAt: conclusion.concludedAt || signedAt,
    transactionId: signature.transaction_id,
    finalPdfSha256: finalHash,
    password,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadDeliveryContext(signatureSessionId: string) {
  const { data: signature, error: signatureError } = await supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, transaction_id, sale_id, client_id, created_by, offeror_name, offeror_capacity, manifest_sha256, status, concluded_at, final_pdf_storage_path, final_pdf_sha256")
    .eq("id", signatureSessionId)
    .maybeSingle();
  if (signatureError || !signature || signature.status !== "zawarta" || !signature.concluded_at) {
    throw new Error("Proces IdeaSign nie jest gotowy do dostarczenia dokumentów.");
  }

  const typedSignature = signature as SignatureRow;
  const [{ data: documents, error: documentsError }, { data: signers, error: signersError }, { data: sale, error: saleError }] = await Promise.all([
    supabaseAdmin.from("contract_signature_documents").select("id, kind, title, file_name, storage_path, crm_container_key, mime_type, byte_size, sha256, acceptance_required, sort_order").eq("signature_session_id", signatureSessionId).order("sort_order"),
    supabaseAdmin.from("contract_signature_signers").select("id, signer_order, name, email, status, signed_at").eq("signature_session_id", signatureSessionId).order("signer_order"),
    supabaseAdmin.from("sales").select("contract_number, public_id, sale_public_id, customer_data").eq("id", typedSignature.sale_id).maybeSingle(),
  ]);
  if (documentsError || signersError || saleError || !documents?.length || !signers?.length) {
    throw new Error("Nie udało się odczytać danych dostarczenia IdeaSign.");
  }
  const { data: client } = typedSignature.client_id
    ? await supabaseAdmin.from("clients").select("address, street, building_number, postal_code, city").eq("id", typedSignature.client_id).maybeSingle()
    : { data: null };
  const customer = (sale?.customer_data || {}) as Record<string, unknown>;
  const clientAddress = String(customer.contract_address || client?.address || [client?.street, client?.building_number, client?.postal_code, client?.city].filter(Boolean).join(" ")).trim();
  const contractNumber = String(sale?.contract_number || sale?.sale_public_id || sale?.public_id || typedSignature.transaction_id);

  return {
    signature: typedSignature,
    documents: documents as FrozenDocumentRow[],
    signers: signers as SignerRow[],
    contractNumber,
    clientAddress,
  };
}

async function downloadFinalPackage(signature: SignatureRow) {
  if (!signature.final_pdf_storage_path || !signature.final_pdf_sha256) {
    throw new Error("Brakuje końcowego pakietu IdeaSign.");
  }
  const { data, error } = await supabaseAdmin.storage.from("ideasign-documents").download(signature.final_pdf_storage_path);
  if (error || !data) throw new Error("Nie udało się pobrać końcowego pakietu IdeaSign.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (sha256(bytes) !== signature.final_pdf_sha256) {
    throw new Error("Końcowy pakiet IdeaSign nie przeszedł kontroli integralności.");
  }
  return bytes;
}

async function deliverIdeaSignJob(job: DeliveryJobRow) {
  const context = await loadDeliveryContext(job.signature_session_id);
  const { signature, documents, signers, contractNumber, clientAddress } = context;

  if (job.channel === "sale_status") {
    const concludedSaleStatus = getConcludedIdeaSignSaleStatus(signers.length);
    const { error } = await supabaseAdmin
      .from("sales")
      .update({ status: concludedSaleStatus })
      .eq("id", signature.sale_id)
      .in("status", [...ACTIVE_IDEASIGN_SALE_STATUSES]);
    if (error) throw new Error(`Nie udało się zmienić statusu sprzedaży: ${error.message}`);
    return;
  }

  if (job.channel === "crm") {
    const rawDocuments = await Promise.all(documents.map(async (document) => ({ document, bytes: await downloadFrozenDocument(document) })));
    const signedDocuments = await Promise.all(rawDocuments.map(async ({ document, bytes }) => {
      const signedBytes = await buildSignedDocument({
        bytes,
        document,
        concludedAt: signature.concluded_at!,
        transactionId: signature.transaction_id,
        contractNumber,
        clientAddress,
        offerorName: signature.offeror_name,
        offerorCapacity: signature.offeror_capacity,
        manifestSha256: signature.manifest_sha256,
        signers,
      });
      const fileName = document.kind === "agreement" ? `umowa-zawarta-${signature.transaction_id}.pdf` : `podpisany-${document.file_name}`;
      return { document, bytes: signedBytes, fileName };
    }));

    for (const [index, item] of signedDocuments.entries()) {
      const crmPath = `${signature.sale_id}/ideasign/${signature.transaction_id}/${String(index + 1).padStart(2, "0")}-${item.fileName}`;
      const { error: uploadError } = await supabaseAdmin.storage.from("sale-documents").upload(crmPath, item.bytes, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error(`Nie udało się zapisać dokumentu CRM: ${uploadError.message}`);

      const { data: existing, error: existingError } = await supabaseAdmin.from("sale_documents").select("id").eq("file_path", crmPath).limit(1).maybeSingle();
      if (existingError) throw new Error(`Nie udało się sprawdzić dokumentu CRM: ${existingError.message}`);
      if (!existing) {
        const group = DOCUMENT_GROUPS.find((candidate) => candidate.key === item.document.crm_container_key);
        const { error: recordError } = await supabaseAdmin.from("sale_documents").insert({
          sale_id: signature.sale_id,
          client_id: signature.client_id,
          uploaded_by: signature.created_by,
          description: `${item.document.title} — podpis elektroniczny IdeaSign ${signature.transaction_id}`,
          document_type: group?.title || "Inne",
          file_name: item.fileName,
          file_path: crmPath,
          file_type: "application/pdf",
          file_size: item.bytes.length,
        });
        if (recordError) throw new Error(`Nie udało się dodać dokumentu do CRM: ${recordError.message}`);
      }
    }
    return;
  }

  if (job.channel === "email") {
    const signer = signers.find((candidate) => candidate.id === job.signer_id);
    if (!signer) throw new Error("Nie znaleziono adresata końcowej wiadomości IdeaSign.");
    const mergedBytes = await downloadFinalPackage(signature);
    const signerPassword = getIdeaSignDeliveryPassword(signature.id, signer.id);
    const encrypted = await encryptPDF(new Uint8Array(mergedBytes), signerPassword, {
      ownerPassword: getIdeaSignOwnerPassword(signature.id, signer.id),
      algorithm: "AES-256",
      allowPrinting: true,
      allowCopying: false,
      allowModifying: false,
      allowAnnotating: false,
      allowFillingForms: false,
      allowAssembly: false,
    });
    await mailTransport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: signer.email,
      subject: `Umowa ${contractNumber} została zawarta — IdeaSign`,
      text: `Dzień dobry,\n\nUmowa ${contractNumber} została zawarta drogą elektroniczną ${formatWarsawDate(signature.concluded_at!)}.\nID transakcji: ${signature.transaction_id}\nSHA-256 scalonego PDF: ${signature.final_pdf_sha256}\n\nW załączeniu znajduje się jeden scalony, zahasłowany PDF. Hasło zostało pokazane po złożeniu Twojego podpisu w IdeaSign i nie jest wysyłane e-mailem.\n\nIdeaSol Sp. z o.o.`,
      html: renderIdeaSignCompletedEmail({
        signerName: signer.name,
        contractNumber,
        concludedAt: formatWarsawDate(signature.concluded_at!),
        transactionId: signature.transaction_id,
        finalPdfSha256: signature.final_pdf_sha256 || "",
      }),
      attachments: [{ filename: `umowa-zalaczniki-${signature.transaction_id}.pdf`, content: Buffer.from(encrypted), contentType: "application/pdf" }],
    });
    return;
  }

  await sendTeamsSaleChannelNotification({
    message: `<strong>IdeaSign: umowa zawarta</strong>\nNumer umowy: ${escapeHtml(contractNumber)}\nID transakcji: ${escapeHtml(signature.transaction_id)}\nData: ${escapeHtml(formatWarsawDate(signature.concluded_at!))}`,
  });
}

export async function processPendingIdeaSignDeliveries(params: {
  signatureSessionId?: string;
  request: Request;
  limit?: number;
}) {
  const { data, error } = await supabaseAdmin.rpc("claim_ideasign_delivery_jobs", {
    p_signature_session_id: params.signatureSessionId || null,
    p_limit: params.limit || 20,
  });
  if (error) throw new Error(`Nie udało się pobrać kolejki dostarczeń IdeaSign: ${error.message}`);

  const jobs = (data || []) as DeliveryJobRow[];
  let completedCount = 0;
  let failedCount = 0;
  for (const job of jobs) {
    try {
      await deliverIdeaSignJob(job);
      const completedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("contract_signature_delivery_jobs")
        .update({ status: "completed", completed_at: completedAt, locked_at: null, last_error: null, updated_at: completedAt })
        .eq("id", job.id)
        .eq("status", "running");
      if (updateError) throw updateError;
      completedCount += 1;
      await appendIdeaSignAuditEvent({
        signatureSessionId: job.signature_session_id,
        signerId: job.signer_id,
        eventType: "delivery_job_completed",
        request: params.request,
        eventData: { channel: job.channel, attempt: job.attempts },
      }).catch(() => undefined);
    } catch (error) {
      failedCount += 1;
      const message = (error instanceof Error ? error.message : "Nieznany błąd dostarczenia.").slice(0, 1000);
      const terminal = job.attempts >= 10;
      const nextDelayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
      const nextAttemptAt = new Date(Date.now() + nextDelayMinutes * 60_000).toISOString();
      await supabaseAdmin
        .from("contract_signature_delivery_jobs")
        .update({
          status: terminal ? "failed" : "pending",
          next_attempt_at: nextAttemptAt,
          locked_at: null,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "running");
      await supabaseAdmin
        .from("contract_signature_sessions")
        .update({ last_error: `DELIVERY_PENDING:${job.channel}`, updated_at: new Date().toISOString() })
        .eq("id", job.signature_session_id);
      await appendIdeaSignAuditEvent({
        signatureSessionId: job.signature_session_id,
        signerId: job.signer_id,
        eventType: terminal ? "delivery_job_failed" : "delivery_job_retry_scheduled",
        request: params.request,
        eventData: { channel: job.channel, attempt: job.attempts, nextAttemptAt: terminal ? null : nextAttemptAt },
      }).catch(() => undefined);
    }
  }

  const touchedSessionIds = [...new Set(jobs.map((job) => job.signature_session_id))];
  for (const signatureSessionId of touchedSessionIds) {
    const { count } = await supabaseAdmin
      .from("contract_signature_delivery_jobs")
      .select("id", { count: "exact", head: true })
      .eq("signature_session_id", signatureSessionId)
      .neq("status", "completed");
    if (count === 0) {
      await supabaseAdmin
        .from("contract_signature_sessions")
        .update({ last_error: null, updated_at: new Date().toISOString() })
        .eq("id", signatureSessionId);
    }
  }

  return { claimedCount: jobs.length, completedCount, failedCount };
}
