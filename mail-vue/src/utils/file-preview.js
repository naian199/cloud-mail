// Small previews made in the browser from a file the user is uploading: an image thumbnail or
// a video cover. Returns a Blob (WebP, or JPEG where WebP encoding is unavailable) under the
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

export async function makePreview(file) {
  try {
    if (file.type.startsWith('image/')) return await imagePreview(file);
    if (file.type.startsWith('video/')) return await videoPreview(file);
  } catch {}
  return null;
}
