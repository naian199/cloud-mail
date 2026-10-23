import http from '@/axios';
export const mailConversations = (params) => http.get('/mail-chat/conversations', { params });
export const mailMessages = (params) => http.get('/mail-chat/messages', { params });
export const mailDetail = (id) => http.get(`/mail-chat/message/${id}`);
export const mailRead = (data) => http.put('/mail-chat/read', data);
export const mailPin = (data) => http.put('/mail-chat/pin', data);
export const mailSend = (data) => http.post('/mail-chat/send', data, { timeout: 60000 });
export async function mailAttachment(id) {
  const url = new URL(
    `${import.meta.env.VITE_BASE_URL}/mail-chat/attachment/${id}`,
    location.origin
  );
  const response = await fetch(url, {
    headers: { Authorization: localStorage.getItem('token') || '' }
  });
  if (!response.ok) throw new Error('Attachment download failed');
  if (response.headers.get('content-type')?.includes('application/json')) {
    const error = await response.json();
    throw new Error(error.message || 'Attachment download failed');
  }
  return response.blob();
}
export const mailLive = (params) => http.get('/mail-chat/live', { params, noMsg: true });
export const mailPresence = (data) => http.put('/mail-chat/presence', data, { noMsg: true });
export const mailRemoveBoth = (data) => http.post('/mail-chat/delete', data);
export const mailOpen = (data) => http.post('/mail-chat/open', data);
export const mailInstant = (data) => http.post('/mail-chat/instant', data, { timeout: 60000 });

export const mailExplore = (params) => http.get('/mail-chat/explore', { params });

export const mailRemoveSelf = data => http.post('/mail-chat/delete-self',data);
