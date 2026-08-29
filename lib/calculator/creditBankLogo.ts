import { supabase } from "@/lib/supabase";

export const CREDIT_BANK_LOGO_BUCKET = "credit-bank-logos";

export function getCreditBankLogoUrl(logoPath: string | null | undefined) {
  if (!logoPath) return "";
  if (logoPath.startsWith("data:image/") || /^https?:\/\//i.test(logoPath)) {
    return logoPath;
  }

  return supabase.storage.from(CREDIT_BANK_LOGO_BUCKET).getPublicUrl(logoPath).data.publicUrl;
}

export function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Nie udało się odczytać pliku logo.")));
    reader.readAsDataURL(file);
  });
}
