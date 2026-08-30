"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

const PDF_WORKER_URL = "/pdf.worker.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

export default function PdfPreview({
  file,
  title,
  onRendered,
}: {
  file: ArrayBuffer;
  title: string;
  onRendered: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [pageCount, setPageCount] = useState(0);
  const [pageWidth, setPageWidth] = useState(760);
  const [loadError, setLoadError] = useState("");
  const pdfSource = useMemo(
    () => ({ data: new Uint8Array(file.slice(0)) }),
    [file]
  );

  useEffect(() => {
    if (renderedRef.current) return;
    const timeout = window.setTimeout(() => {
      setLoadError("Wczytywanie dokumentu trwa zbyt długo. Zamknij podgląd i spróbuj ponownie.");
    }, 20_000);
    return () => window.clearTimeout(timeout);
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

  function confirmRendered() {
    if (renderedRef.current) return;
    renderedRef.current = true;
    setLoadError("");
    onRendered();
  }

  function showLoadError(error: unknown, stage: "source" | "document" | "page") {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[IdeaSign] PDF.js preview failed at ${stage}: ${name}: ${message}; worker=${PDF_WORKER_URL}; pdfjs=${pdfjs.version}`
    );
    setLoadError("Nie udało się wyświetlić dokumentu. Zamknij podgląd i spróbuj ponownie.");
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-slate-200 p-4">
      {loadError ? (
        <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="font-black text-red-700">{loadError}</p>
          <p className="mt-2 text-sm text-slate-500">Checkbox pozostanie nieaktywny, dopóki dokument nie zostanie poprawnie wyświetlony.</p>
        </div>
      ) : (
        <Document
          file={pdfSource}
          loading={<p className="py-16 text-center font-bold text-slate-500">Wczytujemy dokument PDF…</p>}
          error={<p className="py-16 text-center font-bold text-slate-500">Nie udało się wczytać dokumentu.</p>}
          onSourceError={(error) => showLoadError(error, "source")}
          onLoadError={(error) => showLoadError(error, "document")}
          onLoadSuccess={({ numPages }) => {
            setLoadError("");
            setPageCount(numPages);
          }}
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
                  onLoadError={(error) => showLoadError(error, "page")}
                  onRenderError={(error) => showLoadError(error, "page")}
                  onRenderSuccess={index === 0 ? confirmRendered : undefined}
                />
              </div>
            ))}
          </div>
        </Document>
      )}
    </div>
  );
}
