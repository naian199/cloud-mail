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

// Posts the file to the one-time upload URL as multipart/form-data (field "file") and
// reports progress. Resolves with the remote file ID. No credentials are sent.
export function uploadToStorage(url, file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = false;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded / event.total); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data?.status === 'success' && typeof data.id === 'string') resolve(data.id);
      else reject(new Error('upload-failed'));
    };
    xhr.onerror = () => reject(new Error('upload-network'));
    xhr.onabort = () => reject(new Error('upload-aborted'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
}
