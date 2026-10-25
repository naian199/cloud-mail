import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projectInfo } from '../shared/project-info.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(path.join(root, name), 'utf8');
const blocked = ['maillab/cloud-mail', 'skymail.ink', 'cloud_mail_tg', 'trendshift.io'];
const sources = ['README.md', 'README-en.md', 'mail-vue/.env.remote'];
for (const directory of ['mail-vue/src', 'mail-worker/src', 'shared', '.github/workflows']) {
  const walk = (relative) => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (/\.(?:[cm]?js|vue|json|ya?ml|html|css|scss)$/.test(name)) sources.push(name);
    }
  };
  walk(directory);
}

for (const filename of sources) {
  const value = read(filename).toLowerCase();
  for (const marker of blocked)
    assert(!value.includes(marker), `Retired project reference in ${filename}: ${marker}`);
}
assert.equal(projectInfo.repository, 'https://github.com/naian199/cloud-mail');
assert.match(projectInfo.version, /^\d+\.\d+\.\d+$/);
for (const key of ['documentation', 'changelog', 'license', 'notices'])
  assert(projectInfo[key].startsWith(projectInfo.repository + '/'), `Foreign ${key} link`);
for (const filename of ['mail-vue/package.json', 'mail-worker/package.json'])
  assert.equal(JSON.parse(read(filename)).version, projectInfo.version, `${filename} release mismatch`);
assert(read('CHANGELOG.md').includes(`## ${projectInfo.version} `), 'Release missing from changelog');
assert(read('LICENSE').includes('Copyright (c) 2025 aslost'), 'Required MIT copyright missing');
assert(read('NOTICE.md').includes('Copyright (c) 2025 aslost'), 'Provenance notice missing');
for (const filename of ['mail-vue/public/tinymce/license.md', 'mail-vue/public/tinymce/notices.txt'])
  assert(read(filename).trim(), `Third-party license missing: ${filename}`);
console.log(`PASS: independent release ${projectInfo.version}; project links, runtime sources, package versions and required notices verified.`);
