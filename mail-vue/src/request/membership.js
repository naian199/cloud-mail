import http from '@/axios/index.js';

// Cloud Mail membership. Prices come from the server; the client only names a plan.
export const memberMe = () => http.get('/member/me');
export const memberCreateOrder = (planId) => http.post('/member/orders', { planId });
export const memberCancelOrder = (orderId) => http.post(`/member/orders/${orderId}/cancel`);
// Test provider: exists only where the deployment enables test payments.
export const memberTestPayment = (orderId, type) => http.post('/member/test-payments', { orderId, type });
export const memberAdminOrders = (params) => http.get('/member-admin/orders', { params });
