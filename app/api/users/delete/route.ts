

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentProfile();

    if (
      !currentUser ||
      (currentUser.role !== "owner" && currentUser.role !== "admin")
    ) {
      return NextResponse.json(
        {
          error: "Brak uprawnień",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const userId = String(body.user_id || "");

    if (!userId) {
      return NextResponse.json(
        {
          error: "Brak user_id",
        },
        {
          status: 400,
        }
      );
    }

    const { error } = await adminSupabase.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Błąd delete user", error);

    return NextResponse.json(
      {
        error: "Błąd serwera",
      },
      {
        status: 500,
      }
    );
  }
}