# Copyright and third-party notices

## Code provenance

This independently maintained repository contains code derived from Cloud Mail
(maillab/cloud-mail). The original MIT copyright notice is:

> Copyright (c) 2025 aslost

The complete original MIT terms remain in [LICENSE](LICENSE). Independent release
numbers, product links and maintenance decisions do not remove or replace that
notice, or imply authorship of all pre-existing code.

## Third-party components

Dependencies keep their individual licenses and notices. Package manifests and
lockfiles describe the versions in use. In particular:

- The bundled TinyMCE license and notices remain at
  `mail-vue/public/tinymce/license.md` and
  `mail-vue/public/tinymce/notices.txt`, and are copied into the frontend build.
- Emoji Mart data, lottie-web, fflate and the other installed frontend/backend
  dependencies retain the license files supplied in their packages.
- Video compatibility uses the separate single-threaded FFmpeg WebAssembly core
  `@ffmpeg/core` 0.12.10 (GPL-2.0-or-later) and the JavaScript wrapper
  `@ffmpeg/ffmpeg` 0.12.15 (MIT), from
  [ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).
  The upstream repository provides the core source, dependency recipes and build
  scripts under `src/`, `build/` and `packages/`; package versions are pinned in
  the frontend manifest and lockfile. The prebuilt core is used without code
  modifications and is gzip-compressed for static distribution; the wrapper's
  default asset address is changed to the local site. Full license texts are
  retained in `licenses/ffmpeg-core.GPL-2.0.txt` and
  `licenses/ffmpeg-wasm.MIT.txt` and shipped alongside the engine assets as
  `LICENSE-core.txt` and `LICENSE-wrapper.txt`. These component licenses remain
  separate from the original project's MIT notice above.
- Cloudflare, Vue, Element Plus, Hono, Drizzle and other library/service names
  identify dependencies, not ownership by this repository's maintainer.

Removing promotional links, demo screenshots or donation assets does not alter
these licenses. This notice is not a replacement for dependency license terms.
