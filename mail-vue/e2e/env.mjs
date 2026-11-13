// Shared settings for the end-to-end tests and the backend they run against.
export const PORT = Number(process.env.E2E_PORT || 8788);
export const READY_PORT = PORT + 1;
export const BASE = `http://127.0.0.1:${PORT}`;
export const API = `${BASE}/api`;
export const ADMIN = 'owner@example.com';
export const PEER = 'palmer@example.com';
export const PASSWORD = 'Passw0rd!123';
