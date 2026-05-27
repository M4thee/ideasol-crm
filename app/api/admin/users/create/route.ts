import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const password = String(body.password || "").trim();

    const displayName = String(body.display_name || "").trim();

    const role = String(body.role || "seller").trim();

    const managerId = body.manager_id || null;

    if (!email || !password || !displayName) {
      return NextResponse.json(
        {
          error: "Brak wymaganych danych",
        },
        {
          status: 400,
        }
      );
    }

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        {
          error: authError?.message || "Nie udało się utworzyć użytkownika",
        },
        {
          status: 500,
        }
      );
    }

    const userId = authUser.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        display_name: displayName,
        role,
        manager_id: role === "seller" ? managerId : null,
      });

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
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
    console.error("Błąd create user", error);

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