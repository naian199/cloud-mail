# End-to-end tests

Black-box tests that drive the built app in Chromium on a desktop (1440×900)
and a phone (iPhone 13) viewport, against a local Workers backend.

```bash
pnpm test:e2e                     # build, start the backend, run everything
E2E_SKIP_BUILD=1 pnpm test:e2e    # reuse the last build
pnpm test:e2e chat --project phone
```

`e2e/server.mjs` builds the frontend into `mail-worker/dist`, runs
`wrangler dev` on port 8788 with its own state in
`mail-worker/.wrangler/e2e-state` (wiped every run, so local development data
is untouched), and seeds two users, a few received mails and an internal chat.
Playwright waits on port 8789, which opens once seeding is done.

Tests never deliver mail: sends are answered by `page.route` with an error.
The service worker is blocked because headless Chromium lacks the Badge API
it calls. Both projects share one backend, so a test that changes data should
use data no other test (or the other project) depends on.

First time on a new machine, install the browser: `npx playwright install chromium`.
