import "server-only";

import { createHmac } from "node:crypto";

function secret() {
  const value = process.env.IDEASIGN_DOCUMENT_PASSWORD_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Brak sekretu do zabezpieczania dokumentów IdeaSign.");
  return value;
}

function token(sessionId: string, signerId: string, purpose: string) {
  return createHmac("sha256", secret())
    .update(`ideasign:${purpose}:${sessionId}:${signerId}`)
    .digest("base64url")
    .replace(/[01OIl_-]/g, "K")
    .toUpperCase();
}

export function getIdeaSignDeliveryPassword(sessionId: string, signerId: string) {
  const value = token(sessionId, signerId, "recipient").slice(0, 16);
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`;
}

export function getIdeaSignOwnerPassword(sessionId: string, signerId: string) {
  return token(sessionId, signerId, "owner").slice(0, 32);
}
