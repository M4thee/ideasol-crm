import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALID_CODE = /^[A-Za-z0-9]{4,10}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params;

  if (!VALID_CODE.test(shortCode)) {
    return new NextResponse("Nie znaleziono skróconego linku.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { data, error } = await supabaseAdmin.rpc("resolve_short_link", {
    p_code: shortCode,
  });

  if (error) {
    console.error("Błąd rozwiązywania skróconego linku", error);
    return new NextResponse("Nie udało się otworzyć skróconego linku.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const destinationUrl = data?.[0]?.destination_url;

  if (!destinationUrl) {
    return new NextResponse(
      "Ten skrócony link nie istnieje albo został wyłączony.",
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  let destination: URL;

  try {
    destination = new URL(destinationUrl);
  } catch {
    return new NextResponse("Docelowy adres skróconego linku jest nieprawidłowy.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!["http:", "https:"].includes(destination.protocol)) {
    return new NextResponse("Docelowy adres skróconego linku jest niedozwolony.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.redirect(destination, 302);
}
