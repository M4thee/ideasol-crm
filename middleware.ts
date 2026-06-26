import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};