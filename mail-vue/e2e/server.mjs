// Starts an isolated local backend for the end-to-end tests and seeds it.
//
// 1. Builds the frontend into mail-worker/dist (skip with E2E_SKIP_BUILD=1).
// 2. Runs `wrangler dev` on E2E_PORT (default 8788) with its own state directory,
//    wiped on every run, so local development data is never touched.
// 3. Initialises the database and seeds users, mail and chat messages.
// 4. Only then opens the readiness port that Playwright's webServer waits for.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API, BASE, PORT, READY_PORT, ADMIN, PEER, PASSWORD } from './env.mjs';

const vue = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = path.resolve(vue, '../mail-worker');
const stateDir = path.join(worker, '.wrangler', 'e2e-state');
const config = path.join(worker, 'wrangler-e2e.toml');

if (!process.env.E2E_SKIP_BUILD) {
  execFileSync('npx', ['vite', 'build', '--mode', 'release'], { cwd: vue, stdio: 'inherit' });
}

// The dev config with this run's admin address.
const devConfig = readFileSync(path.join(worker, 'wrangler-dev.toml'), 'utf8');
writeFileSync(config, devConfig.replace(/^admin = .*$/m, `admin = "${ADMIN}"`));
const secret = devConfig.match(/^jwt_secret = "(.*)"$/m)[1];

rmSync(stateDir, { recursive: true, force: true });
const wrangler = spawn(path.join(worker, 'node_modules/.bin/wrangler'),
  ['dev', '--config', config, '--port', String(PORT), '--persist-to', stateDir],
  { cwd: worker, stdio: ['ignore', 'pipe', 'inherit'] });
wrangler.stdout.on('data', () => {});
const stop = () => { wrangler.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
wrangler.on('exit', code => { console.error(`wrangler exited (${code})`); process.exit(1); });

async function waitForBackend() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${API}/setting/websiteConfig`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('backend did not start');
}

async function post(url, body, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (data.code !== 200) throw new Error(`${url}: ${data.message}`);
  return data.data;
}

// Delivers a raw message through wrangler's local email handler.
async function receive(from, subject, html) {
  const raw = [`From: ${from.split('@')[0]} <${from}>`, `To: ${ADMIN}`, `Subject: ${subject}`,
    `Message-ID: <${Math.random().toString(16).slice(2)}@${from.split('@')[1]}>`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', '', html, ''].join('\r\n');
  const response = await fetch(`${BASE}/cdn-cgi/handler/email?from=${from}&to=${ADMIN}`, { method: 'POST', body: raw });
  if (!response.ok) throw new Error(`receive ${subject}: ${response.status}`);
}

async function seed() {
  await fetch(`${API}/init/${secret}`);
  await post(`${API}/register`, { email: ADMIN, password: PASSWORD });
  await post(`${API}/register`, { email: PEER, password: PASSWORD });
  const admin = (await post(`${API}/login`, { email: ADMIN, password: PASSWORD })).token;
  const peer = (await post(`${API}/login`, { email: PEER, password: PASSWORD })).token;

  await receive('news@tracker.test', 'Remote image probe',
    '<p>Promo with pixel</p><img src="https://pixel.tracker.test/open.gif" width="1" height="1"><a href="https://example.com/deal">Deal</a>');
  await receive('attacker@evil.test', 'XSS probe',
    '<p>Hello</p><img src="x" onerror="window.__XSS_FIRED=1">');
  for (let n = 1; n <= 4; n++) {
    await receive(`sender${n}@other.test`, `Newsletter number ${n}`,
      `<table width="900"><tr><td>Wide newsletter ${n} with a very long line of content.</td></tr></table>`);
  }

  // An internal conversation between the two users.
  const peerAccount = (await (await fetch(`${API}/my/loginUserInfo`, { headers: { Authorization: peer } })).json()).data.account.accountId;
  const adminAccount = (await (await fetch(`${API}/my/loginUserInfo`, { headers: { Authorization: admin } })).json()).data.account.accountId;
  const send = (token, accountId, to, text) => post(`${API}/mail-chat/send`,
    { accountId, recipients: [to], subject: 'Chat', text, attachments: [], clientId: crypto.randomUUID() }, token);
  await send(admin, adminAccount, PEER, 'Hi there, first message');
  await send(peer, peerAccount, ADMIN, 'Hello back');
}

await waitForBackend();
await seed();
createServer((req, res) => res.end('ready')).listen(READY_PORT);
console.log(`e2e backend ready on ${BASE}`);
