import http from '@/axios/index.js';

export const myProfile = () => http.get('/my/profile');
export const saveLocale = (locale) => http.put('/my/locale', { locale }, { noMsg: true });
export const saveProfile = (data) => http.put('/my/profile', data);
export const saveUsername = username => http.put('/my/username', { username });
export const messageAlerts = (params) => http.get('/my/notifications', { params, noMsg: true });

export function loginUserInfo() {
    return http.get('/my/loginUserInfo')
}

export function resetPassword(password) {
    return http.put('/my/resetPassword', {password})
}

export function userDelete() {
    return http.delete('/my/delete')
}

