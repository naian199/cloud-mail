import { Gunzip } from 'fflate';

const basePath = '/video-engine/core-0.12.10-wrapper-0.12.15/';
const maxInput = 10 * 1024 * 1024;
let active = false;

function unpack(bytes) {
  // Some hosts transparently decode gzip; accept either representation.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    if (bytes.length > 48 * 1024 * 1024) throw Error('Engine size');
    return bytes;
  }
  const parts = []; let size = 0;
  const unzip = new Gunzip(part => {
    size += part.length;
    if (size > 48 * 1024 * 1024) throw Error('Engine size');
    parts.push(part);
  });
  for (let i = 0; i < bytes.length; i += 65536)
    unzip.push(bytes.subarray(i, i + 65536), i + 65536 >= bytes.length);
  const output = new Uint8Array(size); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

// Exactly one conversion at a time; terminating its worker releases decoder
// memory. The original attachment is never modified or sent to a third party.
export async function compatibleVideo(blob, { signal, progress = () => {} } = {}) {
  if (active) throw Error('videoBusy');
  if (blob.size > maxInput) throw Error('videoTooLarge');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  active = true;
  let ffmpeg, wasmURL, timer;
  const cancel = () => ffmpeg?.terminate();
  try {
    const [{ FFmpeg }, response] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      fetch(new URL(basePath + 'ffmpeg-core.wasm.gz', location.origin), { signal, cache: 'force-cache' })
    ]);
    if (!response.ok) throw Error('videoConvertFailed');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 48 * 1024 * 1024) throw Error('videoConvertFailed');
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    wasmURL = URL.createObjectURL(new Blob([unpack(bytes)], { type: 'application/wasm' }));
    ffmpeg = new FFmpeg();
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(cancel, 180000);
    ffmpeg.on('progress', ({ progress: value }) => progress(Math.max(0, Math.min(99, Math.round(value * 100)))));
    await ffmpeg.load({
      classWorkerURL: new URL(basePath + 'worker.js', location.origin).href,
      coreURL: new URL(basePath + 'ffmpeg-core.js', location.origin).href,
      wasmURL
    }, { signal });
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    URL.revokeObjectURL(wasmURL); wasmURL = null;
    await ffmpeg.writeFile('input', new Uint8Array(await blob.arrayBuffer()), { signal });
    const probe = await ffmpeg.ffprobe(['-protocol_whitelist', 'file,pipe', '-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', '-o', 'info.json', 'input'], 15000, { signal });
    // core 0.12.10 leaves the ffprobe return sentinel at -1 even when its
    // JSON report is complete. Require the report and a real video stream.
    if (![0, -1].includes(probe)) throw Error('videoConvertFailed');
    const info = JSON.parse(new TextDecoder().decode(await ffmpeg.readFile('info.json')));
    if (!info.streams?.some(stream => stream.width > 0 && stream.height > 0)) throw Error('videoConvertFailed');
    const duration = Number(info.format?.duration);
    if (duration > 600 || info.streams?.some(stream => stream.width > 8192 || stream.height > 8192)) throw Error('videoConvertFailed');
    const status = await ffmpeg.exec([
      '-protocol_whitelist', 'file,pipe', '-i', 'input', '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
      '-vf', 'scale=w=min(1280\\,iw):h=min(720\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-threads', '1',
      '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', '-fs', '67108864', 'output.mp4'
    ], 150000, { signal });
    if (status !== 0) throw Error('videoConvertFailed');
    // A size-capped encode may be a valid but incomplete file. Never present it
    // as the complete video: verify its duration against the source first.
    if (duration > 0) {
      const result = await ffmpeg.ffprobe(['-protocol_whitelist', 'file,pipe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', '-o', 'out.json', 'output.mp4'], 15000, { signal });
      const outputInfo = [0, -1].includes(result) && JSON.parse(new TextDecoder().decode(await ffmpeg.readFile('out.json')));
      if (!outputInfo || Math.abs(Number(outputInfo.format?.duration) - duration) > Math.max(1, duration * 0.02)) throw Error('videoConvertFailed');
    }
    const output = await ffmpeg.readFile('output.mp4', 'binary', { signal });
    if (!(output instanceof Uint8Array) || !output.length || output.length >= 63 * 1024 * 1024) throw Error('videoConvertFailed');
    return new Blob([output], { type: 'video/mp4' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    ffmpeg?.terminate();
    if (wasmURL) URL.revokeObjectURL(wasmURL);
    active = false;
  }
}
