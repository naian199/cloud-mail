import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const pdfVersion = '4.10.38';
export const pdfDirectory = `pdfjs-${pdfVersion}`;

// pdf.js needs Adobe CMaps (for CJK and other composite-font PDFs) and the standard fonts at a
// URL. Serve them from this site, versioned, next to the app.
export function pdfAssets(root) {
  let files;
  const assets = () => {
    if (files) return files;
    const base = path.join(root, 'node_modules/pdfjs-dist');
    const manifest = JSON.parse(readFileSync(path.join(base, 'package.json'), 'utf8'));
    if (manifest.version !== pdfVersion) throw Error('Update pdfVersion before changing pdfjs-dist');
    files = new Map();
    for (const dir of ['cmaps', 'standard_fonts']) {
      for (const name of readdirSync(path.join(base, dir))) files.set(`${dir}/${name}`, readFileSync(path.join(base, dir, name)));
    }
    return files;
  };
  return {
    name: 'local-pdf-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (!pathname.startsWith(`/${pdfDirectory}/`)) return next();
        const source = assets().get(pathname.slice(pdfDirectory.length + 2));
        if (!source) { response.statusCode = 404; response.end(); return; }
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        response.end(source);
      });
    },
    generateBundle() {
      for (const [name, source] of assets()) this.emitFile({ type: 'asset', fileName: `${pdfDirectory}/${name}`, source });
    }
  };
}
