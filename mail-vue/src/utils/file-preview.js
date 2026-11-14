// Small previews made in the browser from a file the user is uploading: an image thumbnail,
// a video cover, or the first pages of a PDF. Returns a Blob (WebP, or JPEG where WebP encoding is unavailable) under the
// server's 512 KB limit, or null when the file has no preview or one cannot be made.
const EDGE = 480;
const LIMIT = 500 * 1024;

function scaled(width, height) {
  const ratio = Math.min(1, EDGE / Math.max(width, height));
  return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
}

async function encode(canvas) {
  for (const quality of [0.8, 0.6, 0.4]) {
    for (const type of ['image/webp', 'image/jpeg']) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      // Browsers that cannot encode a type fall back to PNG; skip those.
      if (blob && blob.type === type && blob.size <= LIMIT) return blob;
    }
  }
  return null;
}

function draw(source, width, height) {
  const [w, h] = scaled(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);
  return encode(canvas);
}

async function imagePreview(file) {
  if (file.size > 60 * 1024 * 1024) return null;
  const bitmap = await createImageBitmap(file);
  try { return await draw(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close?.(); }
}

function videoPreview(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value) => { clearTimeout(timer); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(value); };
    const timer = setTimeout(() => done(null), 15000);
    video.muted = true; video.playsInline = true; video.preload = 'metadata';
    video.onerror = () => done(null);
    video.onloadedmetadata = () => { video.currentTime = Math.min(1, (video.duration || 0) / 10); };
    video.onseeked = () => {
      if (!video.videoWidth) return done(null);
      draw(video, video.videoWidth, video.videoHeight).then(done, () => done(null));
    };
    video.src = url;
  });
}

// The first pages of a PDF, stacked into one image 480 px wide. pdf.js loads only when needed.
const PDF_PAGES = 3;
async function pdfPreview(file) {
  if (file.size > 60 * 1024 * 1024) return null;
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/build/pdf.min.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: false }).promise;
  try {
    const pages = [];
    for (let n = 1; n <= Math.min(PDF_PAGES, doc.numPages); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: EDGE / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push(canvas);
      page.cleanup();
    }
    if (!pages.length) return null;
    const gap = 8;
    const sheet = document.createElement('canvas');
    sheet.width = EDGE;
    sheet.height = pages.reduce((h, c) => h + c.height, 0) + gap * (pages.length - 1);
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    let y = 0;
    for (const canvas of pages) { ctx.drawImage(canvas, 0, y); y += canvas.height + gap; }
    return await encode(sheet);
  } finally {
    doc.destroy();
  }
}

const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

export async function makePreview(file) {
  try {
    if (file.type.startsWith('image/')) return await imagePreview(file);
    if (file.type.startsWith('video/')) return await videoPreview(file);
    if (isPdf(file)) return await pdfPreview(file);
  } catch (error) {
    // A preview is optional; the original is stored either way.
    console.warn('Preview could not be made:', error?.message || error);
  }
  return null;
}
