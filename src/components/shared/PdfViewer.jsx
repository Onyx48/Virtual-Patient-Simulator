// The app's own PDF reader (pdf.js), so reports open inside VPS instead of the browser's viewer:
// pages on a soft backdrop, page count, zoom, fit to width, download, Esc to close.
// Lazy: pdf.js loads only when a report is opened. The PDF is fetched once and the same bytes
// are rendered and downloaded.
import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { X, Download, ZoomIn, ZoomOut, Maximize2, Loader2, FileText } from "lucide-react";
import { getAuthHeaders, cn } from "../../lib/utils.js";
import "../vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const btn = "grid size-10 place-items-center rounded-full transition-colors hover:bg-[rgb(var(--vx-cell))] disabled:opacity-40";

let pdfjsPromise;
const loadPdfjs = () => (pdfjsPromise ||= Promise.all([
  import("pdfjs-dist"),
  import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
]).then(([lib, worker]) => { lib.GlobalWorkerOptions.workerSrc = worker.default; return lib; }));

function Page({ pdf, n, scale, onVisible }) {
  const canvas = useRef(null), box = useRef(null);
  useEffect(() => {
    let task, cancelled = false;
    pdf.getPage(n).then((page) => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale });
      const c = canvas.current;
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
      c.style.width = `${Math.floor(vp.width)}px`; c.style.height = `${Math.floor(vp.height)}px`;
      task = page.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, n, scale]);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(n), { threshold: 0.5 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, [n, onVisible]);
  return (
    <div ref={box} className="overflow-hidden rounded-lg bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
      <canvas ref={canvas} aria-label={`Page ${n}`} />
    </div>
  );
}

/**
 * url: an API path returning a PDF (auth header added). title: shown in the bar.
 * filename: used for Download.
 */
export default function PdfViewer({ url, title = "Report", subtitle, filename = "report.pdf", onClose, fetchPdf }) {
  const [pdf, setPdf] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(null); // null = fit width
  const [fit, setFit] = useState(1);
  const [page, setPage] = useState(1);
  const scroller = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data }, lib] = await Promise.all([
          // fetchPdf: for pages with their own auth (the patient room); resolves to { data: ArrayBuffer }.
          fetchPdf ? fetchPdf(url) : axios.get(url, { ...getAuthHeaders(), responseType: "arraybuffer" }),
          loadPdfjs(),
        ]);
        if (!alive) return;
        setBytes(data);
        const doc = await lib.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
        if (alive) setPdf(doc);
      } catch (e) {
        if (alive) setError(e.response?.status === 404 ? "This report is not available." : "The report could not be loaded.");
      }
    })();
    return () => { alive = false; };
  }, [url, fetchPdf]);

  // Fit width: the page's natural width against the reading area.
  useEffect(() => {
    if (!pdf) return undefined;
    const measure = async () => {
      const p = await pdf.getPage(1);
      const w = p.getViewport({ scale: 1 }).width;
      const avail = Math.min((scroller.current?.clientWidth || 800) - 48, 980);
      setFit(Math.max(0.5, avail / w));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pdf]);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const download = useCallback(() => {
    if (!bytes) return;
    const href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = Object.assign(document.createElement("a"), { href, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }, [bytes, filename]);

  const s = scale ?? fit;
  const zoom = (d) => setScale(Math.min(3, Math.max(0.5, Math.round((s + d) * 10) / 10)));

  return (
    <div className="vx fixed inset-0 z-[70] flex flex-col bg-[rgb(var(--vx-ink)/0.55)] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-[rgb(var(--vx-bg))] text-[rgb(var(--vx-ink))] shadow-2xl sm:m-4">
        <header className="flex items-center gap-3 border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--vx-accent)/0.15)]"><FileText size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <p className={cn("truncate text-sm", muted)}>{subtitle || (pdf ? `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}` : "Loading…")}</p>
          </div>
          {pdf && <span className={cn("hidden rounded-full bg-[rgb(var(--vx-cell))] px-3 py-1 text-sm tabular-nums sm:inline", muted)}>{page} / {pdf.numPages}</span>}
          <div className="flex items-center gap-0.5 rounded-full bg-[rgb(var(--vx-cell)/0.6)] p-0.5">
            <button type="button" className={btn} onClick={() => zoom(-0.1)} disabled={!pdf} title="Zoom out" aria-label="Zoom out"><ZoomOut size={18} /></button>
            <button type="button" onClick={() => setScale(null)} disabled={!pdf} title="Fit to width"
              className="h-10 min-w-14 rounded-full px-2 text-sm font-medium tabular-nums hover:bg-[rgb(var(--vx-cell))] disabled:opacity-40">{Math.round(s * 100)}%</button>
            <button type="button" className={btn} onClick={() => zoom(0.1)} disabled={!pdf} title="Zoom in" aria-label="Zoom in"><ZoomIn size={18} /></button>
            <button type="button" className={cn(btn, "hidden sm:grid")} onClick={() => setScale(null)} disabled={!pdf} title="Fit to width" aria-label="Fit to width"><Maximize2 size={17} /></button>
          </div>
          <button type="button" onClick={download} disabled={!bytes}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[rgb(var(--vx-accent))] px-4 text-sm font-semibold text-[rgb(var(--vx-on-accent))] disabled:opacity-40">
            <Download size={17} /> <span className="hidden sm:inline">Download</span>
          </button>
          <button type="button" className={btn} onClick={onClose} title="Close (Esc)" aria-label="Close"><X size={20} /></button>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <p className={cn("grid h-full place-items-center p-10 text-base", muted)}>{error}</p>
          ) : !pdf ? (
            <p className={cn("flex h-full items-center justify-center gap-2 p-10 text-base", muted)}><Loader2 size={18} className="animate-spin" /> Preparing the report…</p>
          ) : (
            <div className="flex w-max min-w-full flex-col items-center gap-6 px-6 py-8">
              {Array.from({ length: pdf.numPages }, (_, i) => <Page key={i} pdf={pdf} n={i + 1} scale={s} onVisible={setPage} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
