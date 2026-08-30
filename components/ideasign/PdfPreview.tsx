"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

const PDF_WORKER_URL = "/pdf.worker.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

export default function PdfPreview({
  file,
  title,
  onRendered,
}: {
  file: string;
  title: string;
  onRendered: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [pageCount, setPageCount] = useState(0);
  const [pageWidth, setPageWidth] = useState(760);
  const [nativePreview, setNativePreview] = useState(false);

  useEffect(() => {
    if (nativePreview || renderedRef.current) return;
    const timeout = window.setTimeout(() => setNativePreview(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [file, nativePreview]);

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
    onRendered();
  }

  function switchToNativePreview(error: unknown, stage: "source" | "document" | "page") {
    console.warn("[IdeaSign] PDF.js preview failed; switching to browser preview", {
      stage,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      workerSrc: PDF_WORKER_URL,
      pdfjsVersion: pdfjs.version,
    });
    setNativePreview(true);
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-slate-200 p-4">
      {nativePreview ? (
        <div className="mx-auto flex h-full min-h-[520px] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>Dokument otwarto w zgodnym trybie podglądu przeglądarki.</span>
            <a
              href={file}
              target="_blank"
              rel="noopener noreferrer"
              className="font-black text-sky-700 hover:text-sky-900"
            >
              Otwórz w nowej karcie
            </a>
          </div>
          <iframe
            src={file}
            title={`Podgląd dokumentu: ${title}`}
            className="min-h-0 flex-1 border-0 bg-white"
            onLoad={confirmRendered}
          />
        </div>
      ) : (
        <Document
          file={file}
          loading={<p className="py-16 text-center font-bold text-slate-500">Wczytujemy dokument PDF…</p>}
          error={<p className="py-16 text-center font-bold text-slate-500">Przełączamy sposób wyświetlania dokumentu…</p>}
          onSourceError={(error) => switchToNativePreview(error, "source")}
          onLoadError={(error) => switchToNativePreview(error, "document")}
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
                  onLoadError={(error) => switchToNativePreview(error, "page")}
                  onRenderError={(error) => switchToNativePreview(error, "page")}
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
