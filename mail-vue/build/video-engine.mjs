import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export const engineDirectory = 'video-engine/core-0.12.10-wrapper-0.12.15';

// Ship the engine from this site, on demand. The compressed WASM stays below
// Cloudflare's per-asset limit without a cross-origin CDN or threaded WASM.
export function videoEngine(root) {
  let files;
  const assets = () => {
    if (files) return files;
    for (const [name, version] of [['core', '0.12.10'], ['ffmpeg', '0.12.15']]) {
      const manifest = JSON.parse(readFileSync(path.join(root, `node_modules/@ffmpeg/${name}/package.json`), 'utf8'));
      if (manifest.version !== version) throw Error('Update the versioned video asset path before changing the engine');
    }
    const wrapper = path.join(root, 'node_modules/@ffmpeg/ffmpeg/dist/esm');
    const core = path.join(root, 'node_modules/@ffmpeg/core/dist/esm');
    files = new Map();
    for (const name of ['worker.js', 'const.js', 'errors.js']) {
      let source = readFileSync(path.join(wrapper, name), 'utf8');
      if (name === 'const.js') source = source.replace(/export const CORE_URL = .*;/,
        `export const CORE_URL = "/${engineDirectory}/ffmpeg-core.js";`);
      files.set(name, source);
    }
    files.set('ffmpeg-core.js', readFileSync(path.join(core, 'ffmpeg-core.js')));
    files.set('ffmpeg-core.wasm.gz', gzipSync(readFileSync(path.join(core, 'ffmpeg-core.wasm')), { level: 9 }));
    files.set('LICENSE-core.txt', readFileSync(path.join(root, '../licenses/ffmpeg-core.GPL-2.0.txt')));
    files.set('LICENSE-wrapper.txt', readFileSync(path.join(root, '../licenses/ffmpeg-wasm.MIT.txt')));
    for (const [name, bytes] of files)
      if (Buffer.byteLength(bytes) > 25 * 1024 * 1024) throw Error(`Video asset too large: ${name}`);
    return files;
  };
  return {
    name: 'local-video-engine',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (!pathname.startsWith(`/${engineDirectory}/`)) return next();
        const name = pathname.slice(engineDirectory.length + 2);
        const source = assets().get(name);
        if (!source) { response.statusCode = 404; response.end(); return; }
        response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.gz') ? 'application/gzip' : 'text/plain');
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        response.end(source);
      });
    },
    generateBundle() {
      for (const [name, source] of assets()) this.emitFile({ type: 'asset', fileName: `${engineDirectory}/${name}`, source });
    }
  };
}
