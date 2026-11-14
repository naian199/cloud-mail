import http from '@/axios/index.js';

// Personal document library and CostAction file access. Originals are never served by this
// site: downloads open the official share page the server returns.
export const cloudFileList = (params) => http.get('/cloud-file/list', { params });
export const cloudFileDownload = (fileId) => http.post(`/cloud-file/${fileId}/download`, {}, { noMsg: true });
export const cloudFileView = (fileId) => http.post(`/cloud-file/${fileId}/view`, {}, { noMsg: true });
export const cloudFileRemove = (fileId) => http.delete(`/cloud-file/${fileId}`);
export const cloudFilePutPreview = (fileId, blob) =>
  http.put(`/cloud-file/${fileId}/preview`, blob, { noMsg: true, headers: { 'Content-Type': blob.type } });

// The stored preview as an object URL (the caller revokes it), or null when there is none.
export async function cloudFilePreview(fileId, { signal } = {}) {
  const url = new URL(`${import.meta.env.VITE_BASE_URL}/cloud-file/${fileId}/preview`, location.origin);
  const response = await fetch(url, { headers: { Authorization: localStorage.getItem('token') || '' }, signal });
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.startsWith('image/')) return null;
  return URL.createObjectURL(await response.blob());
}

// Opens the official download page. The tab is opened inside the click so popup blockers allow
// it. Resolves 'ok', 'gone' (CostAction confirmed the file is deleted) or 'retry'.
export async function openOfficialDownload(fileId) {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const { url } = await cloudFileDownload(fileId);
    if (tab) tab.location.href = url; else window.open(url, '_blank', 'noopener');
    return 'ok';
  } catch (error) {
    tab?.close();
    return error?.code === 410 ? 'gone' : 'retry';
  }
}
