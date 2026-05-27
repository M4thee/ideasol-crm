

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const currentUserRole = String(body.current_user_role || "");

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

    const userId = String(body.user_id || "");
    const password = String(body.password || "");

    if (!userId || !password) {
      return NextResponse.json(
        {
          error: "Brak wymaganych danych",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Hasło musi mieć minimum 8 znaków",
        },
        {
          status: 400,
        }
      );
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUppercase || !hasNumber) {
      return NextResponse.json(
        {
          error:
            "Hasło musi zawierać minimum 1 dużą literę i 1 cyfrę",
        },
        {
          status: 400,
        }
      );
    }

    const { error } = await adminSupabase.auth.admin.updateUserById(
      userId,
      {
        password,
      }
    );

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
    console.error("Błąd reset password", error);

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