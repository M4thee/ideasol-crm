import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRequest(request);
    if (!actor) {
      return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
    }

    const body = await request.json();

    const {
      user_id,
      values,
      action,
    } = body;

    if (action && !["update", "deactivate", "restore"].includes(action)) {
      return NextResponse.json({ error: "Nieprawidłowa akcja." }, { status: 400 });
    }

    // Future workflow:
    // action = "deactivate" -> save snapshot to user_deactivation_logs
    // action = "restore" -> restore clients and user settings from snapshot
    // action = "update" (or undefined) -> standard profile update

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(values)
      .eq("id", user_id)
      .select()
      .single();

    if (error) {
      console.error("UPDATE USER ERROR", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Błąd serwera." },
      { status: 500 }
    );
  }
}
