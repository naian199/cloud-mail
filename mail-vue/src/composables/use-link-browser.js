import { ref } from 'vue';
import { normalizeChatLink } from '@/utils/chat-links.mjs';
export const browsingUrl = ref('');
export function openLinkBrowser(url, event) {
  if (event && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
  const normalized = normalizeChatLink(url);
  if (!normalized) return;
  // Keep same-origin application routes out of the untrusted frame.
  if (new URL(normalized).origin === location.origin) {
    if (!event) window.open(normalized, '_blank', 'noopener,noreferrer');
    return;
  }
  event?.preventDefault();
  browsingUrl.value = normalized;
}
export function closeLinkBrowser() { browsingUrl.value = ''; }
