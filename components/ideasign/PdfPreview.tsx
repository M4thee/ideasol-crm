"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfPreview({ file, title }: { file: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageWidth, setPageWidth] = useState(760);
  const [pdfData, setPdfData] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const [loadError, setLoadError] = useState("");
  const documentFile = useMemo(() => (pdfData ? { data: pdfData } : null), [pdfData]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(file, { cache: "no-store", credentials: "include", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Nie udało się pobrać PDF.");
        return response.arrayBuffer();
      })
      .then((buffer) => setPdfData(new Uint8Array(buffer)))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("Nie udało się wyświetlić dokumentu. Zamknij podgląd i spróbuj ponownie.");
      });
    return () => controller.abort();
  }, [file]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateWidth = () => setPageWidth(Math.max(280, Math.min(900, container.clientWidth - 32)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-slate-200 p-4">
      {!documentFile && !loadError && <p className="py-16 text-center font-bold text-slate-500">Wczytujemy dokument PDF…</p>}
      {loadError && <p className="mx-auto my-12 max-w-md rounded-xl border border-red-200 bg-white p-5 text-center font-bold text-red-700">{loadError}</p>}
      {documentFile && <Document
        file={documentFile}
        loading={<p className="py-16 text-center font-bold text-slate-500">Wczytujemy dokument PDF…</p>}
        error={<p className="mx-auto my-12 max-w-md rounded-xl border border-red-200 bg-white p-5 text-center font-bold text-red-700">Nie udało się wyświetlić dokumentu. Zamknij podgląd i spróbuj ponownie.</p>}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
      >
        <div className="mx-auto flex w-fit flex-col gap-4" aria-label={`Podgląd dokumentu: ${title}`}>
          {Array.from({ length: pageCount }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-sm bg-white shadow-lg">
              <Page
                pageNumber={index + 1}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={<div style={{ width: pageWidth, height: Math.round(pageWidth * 1.414) }} className="animate-pulse bg-white" />}
              />
            </div>
          ))}
        </div>
      </Document>}
    </div>
  );
}
