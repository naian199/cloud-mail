"""Read-only production checks run by the normal GitHub deployment workflow."""
import json
import os
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.modules = []
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'script' and attrs.get('type') == 'module' and attrs.get('src'):
            self.modules.append(attrs['src'])

def modules(html):
    parser = Scripts()
    parser.feed(html)
    return parser.modules

base = os.environ['DEPLOY_URL'].strip().rstrip('/') + '/'
parsed = urllib.parse.urlsplit(base)
if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
    raise RuntimeError('A credential-free HTTPS deployment URL is required')
expected = modules(Path('mail-worker/dist/index.html').read_text())
if not expected:
    raise RuntimeError('No built frontend entry found')

def get(path):
    request = urllib.request.Request(urllib.parse.urljoin(base, path), headers={
        'Cache-Control': 'no-cache', 'User-Agent': 'Cloud-Mail-Deployment-Check'
    })
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError('Unexpected HTTP status')
        if not response.headers.get('Strict-Transport-Security'):
            raise RuntimeError('HTTPS transport policy missing')
        if path.startswith('api/') and 'no-store' not in response.headers.get('Cache-Control', '').lower():
            raise RuntimeError('Private API cache protection missing')
        return response.read()

for attempt in range(12):
    try:
        actual = modules(get('').decode())
        if not all(src in actual for src in expected):
            raise RuntimeError('Frontend version has not propagated yet')
        for src in expected:
            if not get(src):
                raise RuntimeError('Empty frontend entry')
        manifest = json.loads(get('manifest.webmanifest'))
        if manifest.get('id') != '/' or manifest.get('start_url') != '/mail-chat' or manifest.get('scope') != '/' or manifest.get('display') != 'standalone':
            raise RuntimeError('Application install manifest is invalid')
        if not get('mail-pwa.png').startswith(b'\x89PNG') or b'<svg' not in get('mail-app.svg') or not get('sw.js'):
            raise RuntimeError('Application install assets unavailable')
        video_base = 'video-engine/core-0.12.10-wrapper-0.12.15/'
        if b'FFMessageType' not in get(video_base + 'worker.js'):
            raise RuntimeError('Video worker asset unavailable')
        engine = get(video_base + 'ffmpeg-core.wasm.gz')
        if len(engine) > 48 * 1024 * 1024 or not engine.startswith((b'\x1f\x8b', b'\x00asm')):
            raise RuntimeError('Video engine asset unavailable')
        config = json.loads(get('api/setting/websiteConfig'))
        if config.get('code') != 200 or not isinstance(config.get('data'), dict):
            raise RuntimeError('Website configuration check failed')
        for endpoint in ['api/mail-chat/conversations?accountId=1', 'api/chat/socket']:
            if json.loads(get(endpoint)).get('code') != 401:
                raise RuntimeError('Authentication protection check failed')
        print('PASS: production frontend matches this build; entry assets, website configuration, chat authentication, HTTPS transport policy, and private API cache protection checks passed.')
        break
    except Exception as error:
        if attempt == 11:
            # No URLs, response bodies, or credentials in diagnostic output.
            raise RuntimeError(f'Production checks failed: {type(error).__name__}') from None
        print('Waiting for deployment readiness...', flush=True)
        time.sleep(5)
