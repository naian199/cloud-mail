const formats = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  ogv: 'video/ogg', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  wmv: 'video/x-ms-wmv', asf: 'video/x-ms-asf', flv: 'video/x-flv',
  mpg: 'video/mpeg', mpeg: 'video/mpeg', m2v: 'video/mpeg', vob: 'video/mpeg',
  ts: 'video/mp2t', mts: 'video/mp2t', m2ts: 'video/mp2t',
  '3gp': 'video/3gpp', '3g2': 'video/3gpp2', f4v: 'video/mp4',
  rm: 'video/x-pn-realvideo', rmvb: 'video/x-pn-realvideo', mxf: 'application/mxf',
  divx: 'video/x-msvideo', h264: 'video/h264', h265: 'video/hevc', hevc: 'video/hevc', av1: 'video/av1'
};
export function isStickerFile(file) {
  return /\.tgs$/i.test(file.filename || '') || /^sticker(?:[._-].*)?\.webm$/i.test(file.filename || '');
}
const audioFormats = { mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',amr:'audio/amr' };
export function audioMime(file) {
  const declared = String(file.mimeType || file.contentType || '').split(';')[0].trim();
  if (/^audio\/[a-z0-9.+-]+$/i.test(declared)) return declared;
  if (/^video\//i.test(declared)) return '';
  const name = String(file.filename || '');
  return audioFormats[name.split('.').at(-1).toLowerCase()] || (/^voice-.+\.webm$/i.test(name) ? 'audio/webm' : '');
}
export function isAudioFile(file) { return !!audioMime(file); }
export function videoMime(file) {
  if (isAudioFile(file)) return '';
  const extension = String(file.filename || '').split('.').at(-1).toLowerCase();
  return formats[extension] || (/^video\/[a-z0-9.+-]+$/i.test(file.mimeType || '') ? file.mimeType : '');
}
export function isVideoFile(file) { return !isStickerFile(file) && !!videoMime(file); }
