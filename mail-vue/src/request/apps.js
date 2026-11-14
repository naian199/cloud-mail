import http from '@/axios/index.js';

// App store. Downloads return the provider's official page; only the click is counted here.
export const appList = (params) => http.get('/apps', { params });
export const appDetail = (id) => http.get(`/apps/${id}`);
export const appCard = (id) => http.get(`/apps/${id}/card`, { noMsg: true });
export const appDownload = (id, versionId) => http.post(`/apps/${id}/versions/${versionId}/download`);

export const myApps = () => http.get('/app-publish/mine');
export const myInstallers = () => http.get('/app-publish/files');
export const createApp = (data) => http.post('/app-publish', data);
export const updateApp = (id, data) => http.put(`/app-publish/${id}`, data);
export const addVersion = (id, data) => http.post(`/app-publish/${id}/versions`, data);
export const submitApp = (id) => http.post(`/app-publish/${id}/submit`);
export const hideApp = (id) => http.post(`/app-publish/${id}/hide`);
export const withdrawVersion = (id, versionId) => http.post(`/app-publish/${id}/versions/${versionId}/withdraw`);

export const reviewQueue = () => http.get('/app-review/queue');
export const reviewApp = (id, action, note = '', extra = {}) => http.post(`/app-review/${id}`, { action, note, ...extra });
export const reviewVersion = (id, versionId, action, note = '') => http.post(`/app-review/${id}/versions/${versionId}`, { action, note });

// A link to an app on this site: https://<this host>/apps/<id>.
export function appLinkId(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return 0;
    const m = u.pathname.match(/^\/apps\/(\d+)\/?$/);
    return m ? Number(m[1]) : 0;
  } catch { return 0; }
}
export const appLink = (id) => `${window.location.origin}/apps/${id}`;
