// Limit both attachment reads and decoding; a history page may contain many videos.
const waiting = [];
let active = 0;
const aborted = () => new DOMException('Cancelled', 'AbortError');
function pump() {
  while (active < 2 && waiting.length) {
    const task = waiting.shift();
    task.signal?.removeEventListener('abort', task.cancel);
    if (task.signal?.aborted) { task.reject(aborted()); continue; }
    active++;
    Promise.resolve().then(task.job).then(task.resolve, task.reject).finally(() => { active--; pump(); });
  }
}
export function queueVideoPreview(job, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    const task = { job, signal, resolve, reject };
    task.cancel = () => { const index = waiting.indexOf(task); if (index >= 0) { waiting.splice(index, 1); reject(aborted()); } };
    signal?.addEventListener('abort', task.cancel, { once: true });
    waiting.push(task); pump();
  });
}
function ready(video, event, predicate, signal) {
  if (signal.aborted) return Promise.reject(aborted());
  if (predicate()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { video.removeEventListener(event, success); video.removeEventListener('error', failed); signal.removeEventListener('abort', cancelled); };
    const success = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(Error('Unsupported video preview')); };
    const cancelled = () => { cleanup(); reject(aborted()); };
    video.addEventListener(event, success, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', cancelled, { once: true });
  });
}
export function videoPoster(load, { signal } = {}) {
  return queueVideoPreview(async () => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(cancel, 20000);
    let source, probe;
    let cancelRead;
    try {
      const interrupted = new Promise((_, reject) => {
        cancelRead = () => reject(aborted());
        controller.signal.addEventListener('abort', cancelRead, { once: true });
        if (controller.signal.aborted) cancelRead();
      });
      const blob = await Promise.race([load(controller.signal), interrupted]);
      controller.signal.removeEventListener('abort', cancelRead);
      if (controller.signal.aborted) throw aborted();
      probe = document.createElement('video');
      probe.muted = true; probe.playsInline = true; probe.preload = 'auto';
      source = URL.createObjectURL(blob); probe.src = source;
      await ready(probe, 'loadeddata', () => probe.readyState >= 2, controller.signal);
      const width = probe.videoWidth, height = probe.videoHeight, duration = probe.duration;
      if (!width || !height) throw Error('Invalid video dimensions');
      if (Number.isFinite(duration) && duration > .1) {
        const seeked = ready(probe, 'seeked', () => false, controller.signal);
        probe.currentTime = Math.min(.5, duration / 10);
        await seeked;
      }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      context.drawImage(probe, 0, 0, canvas.width, canvas.height);
      const poster = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
      canvas.width = canvas.height = 0;
      if (controller.signal.aborted) throw aborted();
      if (!poster) throw Error('Video preview unavailable');
      return { poster, width, height, duration: Number.isFinite(duration) ? duration : 0 };
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (cancelRead) controller.signal.removeEventListener('abort', cancelRead);
      if (probe) { probe.pause(); probe.removeAttribute('src'); probe.load(); }
      if (source) URL.revokeObjectURL(source);
    }
  }, signal);
}
