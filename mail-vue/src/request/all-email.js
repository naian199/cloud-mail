import http from '@/axios/index.js';

export function allMailConversations(params) {
  return http.get('/allEmail/conversations', { params });
}

export function allMailConversationMessages(id, before) {
  return http.get(`/allEmail/conversations/${id}/messages`, { params: { before } });
}

export function allEmailDelete(emailIds) {
  return http.delete('/allEmail/delete?emailIds=' + emailIds);
}
