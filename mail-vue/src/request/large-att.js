import http from '@/axios/index.js';

// Large attachments stored with CostAction/Turbobit. The API token never reaches the
// browser: the server hands out a one-time upload URL and, later, a download page.
export const largeAttConfig = () => http.get('/large-att/config');
export const largeAttBegin = (data) => http.post('/large-att/begin', data);
export const largeAttComplete = (data) => http.post('/large-att/complete', data);
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
