// Makes blood report uploads fit the live server's request limit. The PMS API
// runs as a Netlify Function, which rejects uploads over ~4.5 MB (413). Files
// that already fit are sent as they are; bigger ones are made smaller here:
// - PDF with a text layer (most lab reports): just its text, as a .txt file —
//   tiny, and the values read more reliably than from a picture of the page;
// - scanned PDF (no text): its pages as compressed JPEG images;
// - photos: resized and re-saved as JPEG.
import { extractPdfPage, toLines } from '@/lib/planPdfImport';

/** Total upload size that safely fits under Netlify's limit (with form overhead). */
const UPLOAD_BUDGET = 4 * 1024 * 1024;
/** The server takes at most 10 files per report. */
const MAX_FILES = 10;
/** A PDF with less text than this is treated as scanned. */
const MIN_TEXT_CHARS = 200;

const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
const baseName = (f: File) => f.name.replace(/\.[^.]+$/, '');

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress the image'))), 'image/jpeg', quality),
  );

/** Draws a source onto a canvas no wider / taller than maxSide and saves it as JPEG. */
const drawToJpeg = async (
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void | Promise<void>,
  width: number,
  height: number,
  maxSide: number,
  quality: number,
) => {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await draw(ctx, canvas.width, canvas.height);
  return toBlob(canvas, quality);
};

const shrinkImage = async (file: File, maxSide: number, quality: number): Promise<File> => {
  const bitmap = await createImageBitmap(file);
  const blob = await drawToJpeg((ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h), bitmap.width, bitmap.height, maxSide, quality);
  bitmap.close();
  return new File([blob], `${baseName(file)}.jpg`, { type: 'image/jpeg' });
};

const loadPdf = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return { pdfjs, doc };
};

/** The PDF's text, line by line (table rows stay on one line: "Hemoglobin 13.5 g/dL 12-15"). */
const pdfText = async (file: File) => {
  const { pdfjs, doc } = await loadPdf(file);
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await extractPdfPage(await doc.getPage(n), pdfjs.OPS);
    pages.push(`--- Page ${n} ---\n${toLines(page.texts).map((l) => l.text).join('\n')}`);
  }
  return pages.join('\n\n');
};

/** A scanned PDF's pages as JPEG images (up to `maxPages`). */
const pdfPageImages = async (file: File, maxPages: number, maxSide: number, quality: number) => {
  const { doc } = await loadPdf(file);
  const images: File[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const blob = await drawToJpeg(
      async (ctx, w) => {
        const viewport = page.getViewport({ scale: w / base.width });
        await page.render({ canvas: ctx.canvas, canvasContext: ctx, viewport }).promise;
      },
      base.width,
      base.height,
      maxSide,
      quality,
    );
    images.push(new File([blob], `${baseName(file)}-page-${n}.jpg`, { type: 'image/jpeg' }));
  }
  return { images, skippedPages: Math.max(0, doc.numPages - maxPages) };
};

const totalSize = (files: File[]) => files.reduce((n, f) => n + f.size, 0);

export interface PreparedUpload {
  files: File[];
  /** Shown to the nutritionist, e.g. pages left out of a long scanned report. */
  warnings: string[];
}

/** Files ready to upload: unchanged when they fit, otherwise made smaller. */
export const prepareReportUpload = async (files: File[]): Promise<PreparedUpload> => {
  if (totalSize(files) <= UPLOAD_BUDGET) return { files, warnings: [] };

  const warnings: string[] = [];
  // Try progressively smaller images until everything fits.
  for (const [maxSide, quality] of [[2000, 0.8], [1600, 0.7], [1300, 0.6]] as const) {
    const out: File[] = [];
    for (const file of files) {
      if (isPdf(file)) {
        // Small PDFs go as they are, when the rest leaves room.
        if (file.size < 1024 * 1024) {
          out.push(file);
          continue;
        }
        const text = await pdfText(file);
        if (text.replace(/--- Page \d+ ---|\s/g, '').length >= MIN_TEXT_CHARS) {
          out.push(new File([text], `${baseName(file)}.txt`, { type: 'text/plain' }));
        } else {
          const room = Math.max(1, MAX_FILES - out.length - (files.length - files.indexOf(file) - 1));
          const { images, skippedPages } = await pdfPageImages(file, room, maxSide, quality);
          out.push(...images);
          if (skippedPages) {
            warnings.push(`Only the first ${images.length} pages of ${file.name} were read (scanned report, ${images.length + skippedPages} pages). Upload the other pages separately if values are missing.`);
          }
        }
      } else if (file.type.startsWith('image/') && file.size > 700 * 1024) {
        out.push(await shrinkImage(file, maxSide, quality));
      } else {
        out.push(file);
      }
    }
    if (totalSize(out) <= UPLOAD_BUDGET) return { files: out.slice(0, MAX_FILES), warnings: [...new Set(warnings)] };
    warnings.length = 0;
  }
  throw new Error('This report is too large to upload even after compressing it. Please upload fewer pages at a time.');
};
