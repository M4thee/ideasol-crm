import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function getEstimatedSecondsRemaining(progress: number, startedAt: string) {
  if (progress <= 1 || progress >= 100) return progress >= 100 ? 0 : null;

  const elapsedSeconds = Math.max(
    1,
    (Date.now() - new Date(startedAt).getTime()) / 1000
  );
  const rawEstimate = (elapsedSeconds / progress) * (100 - progress);

  if (!Number.isFinite(rawEstimate)) return null;
  return Math.min(3600, Math.max(1, Math.round(rawEstimate / 5) * 5));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });
  }

  const { id: saleId } = await context.params;
  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json({ error: "Nieprawidłowy identyfikator generowania." }, { status: 400 });
  }

  const { data: job, error } = await supabaseAdmin
    .from("installation_order_generation_jobs")
    .select("progress, stage, error, started_at, updated_at, completed_at")
    .eq("id", jobId)
    .eq("sale_id", saleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Błąd pobierania postępu zlecenia montażu", error);
    return NextResponse.json({ error: "Nie udało się pobrać postępu." }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Postęp nie jest jeszcze dostępny." }, { status: 404 });
  }

  const progress = Number(job.progress || 0);

  return NextResponse.json({
    progress,
    stage: job.stage,
    error: job.error,
    estimatedSecondsRemaining: getEstimatedSecondsRemaining(progress, job.started_at),
    updatedAt: job.updated_at,
    completed: Boolean(job.completed_at),
  });
}
