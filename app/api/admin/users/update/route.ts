import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentUserRole = String(body.current_user_role || "");

    const {
      user_id,
      values,
    } = body;

    if (currentUserRole !== "admin") {
      return NextResponse.json(
        { error: "Brak uprawnień." },
        { status: 403 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
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