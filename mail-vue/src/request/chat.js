import http from '@/axios/index.js';

export const listFriends = () => http.get('/chat/friends');
export const requestFriend = email => http.post('/chat/friends', { email });
export const respondFriend = (id, accept) => http.put(`/chat/friends/${id}`, { accept });
export const removeFriend = id => http.delete(`/chat/friends/${id}`);
export const listMessages = (id, params = {}) => http.get(`/chat/friends/${id}/messages`, { params });
export const sendMessage = (id, body, clientId) => http.post(`/chat/friends/${id}/messages`, { body, clientId });
export const readMessages = (id, messageId) => http.put(`/chat/friends/${id}/read`, { messageId });

export function openChatSocket() {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Login required');
  const url = new URL(import.meta.env.VITE_BASE_URL + '/chat/socket', window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  // Keep credentials out of URL query strings and request logs.
  return new WebSocket(url, ['cloud-mail-chat', `auth.${token}`]);
}
