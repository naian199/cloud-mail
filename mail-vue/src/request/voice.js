import http from '@/axios';
export const transcribeVoice = (data, signal) => http.post('/mail-chat/transcribe', data, {signal, noMsg:true, timeout:90000});
export async function roomVoice(roomId, messageId, {signal} = {}) {
  const response = await fetch(new URL(`${import.meta.env.VITE_BASE_URL}/chat/rooms/${encodeURIComponent(roomId)}/messages/${messageId}/voice`, location.origin), {signal, headers:{Authorization:localStorage.getItem('token') || ''}});
  if (!response.ok || response.headers.get('content-type')?.includes('application/json')) throw Error('Audio unavailable');
  return response.blob();
}
