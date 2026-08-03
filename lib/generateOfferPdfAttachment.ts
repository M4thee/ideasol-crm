export async function generateOfferPdfBase64(
  payload: Record<string, unknown>
): Promise<string> {
  const response = await fetch("/api/generate-offer-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || "Nie udało się wygenerować oferty PDF");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return window.btoa(binary);
}
