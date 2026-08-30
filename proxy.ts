import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const maintenanceModeValue = process.env.MAINTENANCE_MODE
    ?.trim()
    .replace(/^['\"]|['\"]$/g, "")
    .toLowerCase();
  const maintenanceMode =
    maintenanceModeValue === "true" ||
    maintenanceModeValue === "1" ||
    maintenanceModeValue === "yes" ||
    maintenanceModeValue === "on";

  const { pathname } = request.nextUrl;

  if (
    maintenanceMode &&
    pathname !== "/maintenance" &&
    !pathname.startsWith("/kalkulator-magazynu-energii") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/favicon") &&
    !pathname.startsWith("/logo.png")
  ) {
    return NextResponse.redirect(
      new URL("/maintenance", request.url)
    );
  }

  if (pathname.startsWith("/sign")) {
    const response = NextResponse.next();
    const scriptPolicy = process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        scriptPolicy,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src 'self' blob:",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join("; ")
    );
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
