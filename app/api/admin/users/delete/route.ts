import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentUserRole = String(body.currentUserRole || "");

    if (currentUserRole !== "admin") {
      return NextResponse.json(
        {
          error: "Brak uprawnień",
        },
        {
          status: 403,
        }
      );
    }

    const userId = String(body.userId || "");

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

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("SUPABASE DELETE USER ERROR", error);

      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: error,
          },
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