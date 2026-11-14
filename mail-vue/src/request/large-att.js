import http from '@/axios/index.js';

// Large attachments stored with CostAction/Turbobit. The API token never reaches the
// browser: the server hands out a one-time upload URL and, later, a download page.
export const largeAttConfig = () => http.get('/large-att/config');
export const largeAttBegin = (data) => http.post('/large-att/begin', data);
export const largeAttComplete = (data) => http.post('/large-att/complete', data, { noMsg: true });
export const largeAttDirect = (attId) => http.post(`/large-att/${attId}/direct`, {}, { noMsg: true });
export const largeAttFailed = (attId) => http.post('/large-att/failed', { attId });
export const largeAttLink = (attId) => http.get(`/large-att/${attId}/link`);
export const largeAttRemove = (attId) => http.delete(`/large-att/${attId}`);
export const costactionTest = (token) => http.post('/setting/costactionTest', token ? { token } : {});

// Posts the file to this site's Worker as multipart/form-data (field "file"), which relays it
// to Turbobit and verifies it. Turbobit's upload hosts reject browser CORS preflights, so the
// browser never posts to them directly. Resolves with { attId, status: 'ready' }.
export function uploadToStorage(attId, file, { onProgress, signal } = {}) {
  // Cancelled before the upload began.
  if (signal?.aborted) return Promise.reject(new Error('upload-aborted'));
  const form = new FormData();
  form.append('file', file, file.name);
  return http.post(`/large-att/${attId}/upload`, form, {
    noMsg: true,
    timeout: 0,
    signal,
    onUploadProgress: (event) => { if (event.total) onProgress?.(event.loaded / event.total); }
  }).catch((error) => {
    throw new Error(signal?.aborted ? 'upload-aborted' : 'upload-failed', { cause: error });
  });
}

// Direct path for files too large for the Worker relay: posts the file from the browser straight
// to the one-time upload URL. It is a plain multipart form with no upload progress listener, so
// the browser sends no CORS preflight (the upload hosts do not answer one); the hosts allow the
// response to be read. Resolves with the remote file ID.
export async function uploadDirect(url, file, { signal } = {}) {
  if (signal?.aborted) throw new Error('upload-aborted');
  const form = new FormData();
  form.append('file', file, file.name);
  let response;
  try {
    response = await fetch(url, { method: 'POST', body: form, credentials: 'omit', signal });
  } catch (error) {
    throw new Error(signal?.aborted ? 'upload-aborted' : 'upload-direct-network', { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'success' || typeof data.id !== 'string') throw new Error('upload-failed');
  return data.id;
}
