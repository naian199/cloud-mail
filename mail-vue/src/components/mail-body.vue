<template>
  <div class="mail-body">
    <div v-if="blockedRemote" class="remote-images" role="status">
      <span>{{ t('mailRemoteImagesBlocked') }}</span>
      <el-button size="small" text type="primary" @click="showRemote = true">{{ t('mailRemoteImagesShow') }}</el-button>
    </div>
    <iframe
      ref="frame"
      :srcdoc="documentHtml"
      :style="{ height: height + 'px' }"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="no-referrer"
      :title="title"
    />
    <el-button v-if="failed" text @click="hydrate">{{ t('mailChatImageRetry') }}</el-button>
  </div>
</template>
<script setup>
import { randomUUID } from '@/utils/uuid';
import { installMobileViewport } from '@/utils/mobile-viewport';

import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { mailAttachment } from '@/request/mail-chat';
const props = defineProps({
  html: { type: String, default: '' },
  images: { type: Array, default: () => [] },
  title: { type: String, default: 'Email' },
  attachmentLoader: { type: Function, default: mailAttachment },
  // Origins whose images load without asking, e.g. the deployment's own attachment storage.
  trustedImageOrigins: { type: Array, default: () => [] }
});
const { t } = useI18n();
const frame = ref(null),
  height = ref(180),
  sources = ref({}),
  failed = ref(false),
  showRemote = ref(false);
// Remote images can be tracking pixels, so they stay blocked until the reader asks for them.
const REMOTE_URL = /(?:\b(?:src|srcset|background|poster)\s*=\s*["']?|url\(\s*["']?)\s*((?:https?:)?\/\/[^\s"'()<>,]+)/gi;
const trustedOrigins = computed(() => {
  const origins = new Set([location.origin]);
  for (const value of props.trustedImageOrigins) {
    try { origins.add(new URL(value, location.origin).origin); } catch {}
  }
  return [...origins];
});
const blockedRemote = computed(() => {
  if (showRemote.value) return false;
  for (const [, url] of props.html.matchAll(REMOTE_URL)) {
    try { if (!trustedOrigins.value.includes(new URL(url, location.origin).origin)) return true; } catch {}
  }
  return false;
});
const imageSources = computed(() => (showRemote.value ? 'https: http: data:' : `data: ${trustedOrigins.value.join(' ')}`));
const nonce = randomUUID();
let version = 0,
  stopped = false;
function revoke() {
  sources.value = {};
}
async function hydrate() {
  const mine = ++version;
  failed.value = false;
  const entries = await Promise.all(
    props.images.map(async (image) => {
      try {
        const blob = await props.attachmentLoader(image.attId);
        const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        const mime =
          bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
            ? 'image/png'
            : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
              ? 'image/jpeg'
              : /^GIF8[79]a$/.test(String.fromCharCode(...bytes.slice(0, 6)))
                ? 'image/gif'
                : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
                    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
                  ? 'image/webp'
                  : '';
        if (!mime) throw Error('Unsupported image');
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(new Blob([blob], { type: mime }));
        });
        return [image.attId, data];
      } catch {
        if (mine === version && !stopped) failed.value = true;
        return null;
      }
    })
  );
  const urls = Object.fromEntries(entries.filter(Boolean));
  if (stopped || mine !== version) {
    return;
  }
  revoke();
  sources.value = urls;
}
const documentHtml = computed(() => {
  const body = props.html.replace(/src="mail-image:(\d+)"/g, (_, id) =>
    sources.value[id] ? `src="${sources.value[id]}"` : ''
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imageSources.value}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; connect-src 'none'"><style>html,body{margin:0;padding:0;background:white;color:#202124;font:14px/1.6 Arial,sans-serif;touch-action:pan-x pan-y;-webkit-text-size-adjust:100%}#mail-root{padding:16px;display:flow-root;overflow-wrap:anywhere;box-sizing:border-box}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}a{overflow-wrap:anywhere}</style></head><body><div id="mail-root">${body}</div><script nonce="${nonce}">(${installMobileViewport.toString()})(document);const root=document.getElementById('mail-root');for(const link of root.querySelectorAll('a[href]')){link.target='_blank';link.rel='noopener noreferrer';}function size(){parent.postMessage({kind:'cloud-mail-size',height:Math.ceil(root.getBoundingClientRect().height)},'*')}new ResizeObserver(size).observe(root);addEventListener('load',size);addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();parent.postMessage({kind:'cloud-mail-escape',nonce:'${nonce}'},'*')}});size();<\/script></body></html>`;
});
function onSize(event) {
  if(event.source===frame.value?.contentWindow&&event.data?.kind==='cloud-mail-escape'&&event.data.nonce===nonce){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return;}
  if (
    event.source !== frame.value?.contentWindow ||
    event.data?.kind !== 'cloud-mail-size' ||
    !Number.isFinite(event.data.height)
  )
    return;
  height.value = Math.min(20000, Math.max(50, event.data.height));
}
watch(
  () => JSON.stringify([props.html, props.images.map((image) => image.attId)]),
  () => {
    height.value = 180;
    showRemote.value = false;
    hydrate();
  },
  { immediate: true }
);
onMounted(() => window.addEventListener('message', onSize));
onBeforeUnmount(() => {
  stopped = true;
  version++;
  revoke();
  window.removeEventListener('message', onSize);
});
</script>
<style scoped>
.remote-images {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  margin-bottom: 8px;
}
.mail-body,
iframe {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
iframe {
  display: block;
  border: 0;
  background: white;
}
</style>
