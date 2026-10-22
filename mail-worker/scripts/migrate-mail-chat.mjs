// Additive pre-deployment migration. Existing Worker versions tolerate these
// extra columns; migrate first so the new Worker never sees missing fields.
import { execFileSync } from 'node:child_process';
import { migrateMailChat } from '../src/init/mail-chat-schema.js';

const args = process.argv.slice(2);
if (args.includes('--remote') === args.includes('--local')) {
  throw new Error('Choose exactly one of --remote or --local');
}
const allowed = new Set(['--remote', '--local', '--config', '--persist-to']);
for (let i = 0; i < args.length; i++) {
  if (!allowed.has(args[i])) throw new Error('Unsupported migration option');
  if (['--config', '--persist-to'].includes(args[i]) && !args[++i]) throw new Error('Missing option value');
}
function execute(sql) {
  let output;
  try {
    output = execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'db', ...args, '--command', sql, '--json'], {
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
    });
  } catch (error) {
    // Do not dump CLI output or environment/configuration values into CI logs.
    throw new Error(`D1 schema migration failed (Wrangler exit ${error.status ?? 'unknown'}); deployment stopped`);
  }
  const rows = JSON.parse(output);
  if (!Array.isArray(rows) || !rows.length || rows.some(row => row.success !== true)) {
    throw new Error('D1 schema migration did not return a successful result');
  }
  return rows[0];
}
const columns = execute('PRAGMA table_info(email)').results;
if (!Array.isArray(columns)) throw new Error('D1 schema inspection failed');
if (!columns.length) {
  console.log('Fresh database: full post-deployment initialization will create the base tables.');
} else {
  const db = {
    prepare(sql) {
      return {
        all: async () => execute(sql),
        run: async () => execute(sql)
      };
    },
    async batch(statements) { for (const statement of statements) await statement.run(); }
  };
  await migrateMailChat(db);
  const names = new Set(execute('PRAGMA table_info(email)').results.map(row => row.name));
  for (const name of ['conversation_key', 'conversation_peers', 'reply_to', 'ingest_key', 'send_key']) {
    if (!names.has(name)) throw new Error(`Missing migrated column: ${name}`);
  }
  console.log('Mail conversation schema ready; existing email data preserved.');
}
