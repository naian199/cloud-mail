import http from '@/axios/index.js';

export function allEmailList(params) {
  return http.get('/allEmail/list', { params: { ...params } });
}

export function allEmailDelete(emailIds) {
  return http.delete('/allEmail/delete?emailIds=' + emailIds);
}

export function allEmailBatchDelete(params) {
  return http.delete('/allEmail/batchDelete', { params: params });
}

export function allEmailLatest(emailId) {
  return http.get('/allEmail/latest', { params: { emailId }, noMsg: true, timeout: 35 * 1000 });
}

export const removedMailDetail = (id) => http.get(`/allEmail/removed/${id}`);
export async function removedMailAttachment(id, attId) {
  const url = new URL(
    `${import.meta.env.VITE_BASE_URL}/allEmail/removed/${id}/attachment/${attId}`,
    location.origin
  );
  const response = await fetch(url, {
    headers: { Authorization: localStorage.getItem('token') || '' }
  });
  if (!response.ok || response.headers.get('content-type')?.includes('application/json'))
    throw Error('Attachment unavailable');
  return response.blob();
}
