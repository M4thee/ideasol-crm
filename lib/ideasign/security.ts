import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";

export const IDEA_SIGN_ACCESS_COOKIE = "ideasign_access";
export const IDEA_SIGN_CSRF_COOKIE = "ideasign_csrf";
export const IDEA_SIGN_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
export const IDEA_SIGN_ACCESS_TTL_SECONDS = 60 * 60 * 8;
export const IDEA_SIGN_OTP_TTL_SECONDS = 5 * 60;

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function createSecretToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function createOtpCode() {
  const value = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(value).padStart(6, "0");
}

function getOtpPepper() {
  const pepper =
    process.env.IDEASIGN_OTP_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!pepper) {
    throw new Error("Brak IDEASIGN_OTP_PEPPER lub SUPABASE_SERVICE_ROLE_KEY.");
  }

  return pepper;
}

export function hashOtp(challengeId: string, code: string) {
  return createHmac("sha256", getOtpPepper())
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function safeEqualHex(left: string, right: string) {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right)) {
    return false;
  }

  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");

  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function maskEmail(value: string) {
  const [localPart = "", domain = ""] = value.trim().split("@");
  if (!localPart || !domain) return "ukryty adres e-mail";
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"•".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function phoneSuffix(value: string) {
  return value.replace(/\D/g, "").slice(-4);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function getRequestEvidence(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const rawIpAddress = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  const ipAddress = isIP(rawIpAddress) ? rawIpAddress : null;
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 1000) || null;

  return {
    ipAddress,
    userAgent,
    sessionMetadata: {
      acceptLanguage: (request.headers.get("accept-language") || "").slice(0, 160) || null,
      secChUa: (request.headers.get("sec-ch-ua") || "").slice(0, 300) || null,
      secChUaMobile: (request.headers.get("sec-ch-ua-mobile") || "").slice(0, 20) || null,
      secChUaPlatform: (request.headers.get("sec-ch-ua-platform") || "").slice(0, 80) || null,
    },
  };
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
