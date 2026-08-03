"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OpenOcrSourceImageButton({ noteId }: { noteId: string }) {
  const [opening, setOpening] = useState(false);

  async function openSourceImage() {
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Otwieranie notatki źródłowej...";
      previewWindow.document.body.textContent = "Otwieranie notatki źródłowej...";
    }

    setOpening(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      }

      const response = await fetch(`/api/client-notes/${noteId}/source-image`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.signedUrl) {
        throw new Error(result.error || "Nie udało się otworzyć zdjęcia źródłowego.");
      }

      if (previewWindow) {
        previewWindow.location.replace(result.signedUrl);
      } else {
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      previewWindow?.close();
      window.alert(
        error instanceof Error ? error.message : "Nie udało się otworzyć zdjęcia źródłowego."
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openSourceImage}
      disabled={opening}
      className="mt-2 inline-flex text-xs font-black text-[#0f7f72] underline decoration-[#0f7f72]/40 underline-offset-4 transition hover:text-[#095f56] disabled:cursor-wait disabled:opacity-60"
    >
      {opening ? "[Otwieranie notatki źródłowej...]" : "[Otwórz notatkę źródłową]"}
    </button>
  );
}
