import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import { getProfitAdminClient, ProfitConfigurationError } from "@/lib/profit/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });

  try {
    const formData = await request.formData();
    const entityType = String(formData.get("entityType") || "");
    const entityId = String(formData.get("entityId") || "");
    const file = formData.get("file");

    if (!isUuid(entityId) || !["category", "reward"].includes(entityType)) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowy obiekt grafiki." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !allowedTypes[file.type]) {
      return NextResponse.json({ ok: false, error: "Wybierz plik JPG, PNG, WebP lub GIF o rozmiarze do 5 MB." }, { status: 400 });
    }

    const profit = getProfitAdminClient();
    const table = entityType === "category" ? "reward_categories" : "rewards";
    const { data: before, error: beforeError } = await profit.from(table).select("id,image_path").eq("id", entityId).maybeSingle();
    if (beforeError) throw beforeError;
    if (!before) return NextResponse.json({ ok: false, error: "Nie znaleziono obiektu katalogu." }, { status: 404 });

    const path = `${entityType === "category" ? "categories" : "rewards"}/${entityId}/${randomUUID()}.${allowedTypes[file.type]}`;
    const { error: uploadError } = await profit.storage
      .from("profit-reward-media")
      .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: after, error: updateError } = await profit
      .from(table)
      .update({ image_path: path })
      .eq("id", entityId)
      .select("id,image_path")
      .single();
    if (updateError) throw updateError;

    await profit.from("audit_log").insert({
      actor_type: "crm_admin",
      actor_id: admin.id,
      action: `${entityType}_image_updated`,
      entity_type: entityType === "category" ? "reward_category" : "reward",
      entity_id: entityId,
      before_data: before,
      after_data: after,
    });

    const { data: publicData } = profit.storage.from("profit-reward-media").getPublicUrl(path);
    return NextResponse.json({ ok: true, path, url: publicData.publicUrl });
  } catch (error) {
    console.error("Błąd wgrywania grafiki IdeaSol Profit", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Nie udało się wgrać grafiki." },
      { status: error instanceof ProfitConfigurationError ? 503 : 500 },
    );
  }
}
