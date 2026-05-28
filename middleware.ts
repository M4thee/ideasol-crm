import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const maintenanceMode =
    process.env.MAINTENANCE_MODE === "true";

  const { pathname } = request.nextUrl;

  if (
    maintenanceMode &&
    pathname !== "/maintenance" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/favicon") &&
    !pathname.startsWith("/logo.png")
  ) {
    return NextResponse.rewrite(
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