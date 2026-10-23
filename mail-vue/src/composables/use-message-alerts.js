import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ElNotification } from 'element-plus';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { messageAlerts } from '@/request/my';
import { useMailSync } from './use-mail-sync';

export const alertsEnabled = ref(localStorage.getItem('mail-alerts') !== 'off');
export const notificationPermission = ref(
  'Notification' in window ? Notification.permission : 'unsupported'
);
export function setAlertsEnabled(value) {
  alertsEnabled.value = value;
  localStorage.setItem('mail-alerts', value ? 'on' : 'off');
}
export async function enableBrowserAlerts() {
  if (!('Notification' in window)) return;
  notificationPermission.value = await Notification.requestPermission();
}
export function useMessageAlerts() {
  const router = useRouter(),
    { t } = useI18n();
  const baseTitle = document.title;
  let cursor,
    busy = false,
    dirty = false,
    stopped = false,
    count = 0;
  const notices = new Set();
  function clearTitle() {
    if (!document.hidden) {
      count = 0;
      document.title = baseTitle;
    }
  }
  function open(message) {
    window.focus();
    router.push({
      path: '/mail-chat',
      query: { accountId: String(message.accountId), conversation: message.conversationKey || '' }
    });
  }
  async function refresh() {
    if (stopped) return;
    if (busy) {
      dirty = true;
      return;
    }
    busy = true;
    try {
      let more;
      do {
        dirty = false;
        const data = await messageAlerts(cursor === undefined ? {} : { after: cursor });
        if (stopped) return;
        cursor = data.cursor;
        more = data.hasMore;
        if (!alertsEnabled.value) continue;
        const grouped = data.messages.length > 3;
        const incoming = grouped ? data.messages.slice(-1) : data.messages;
        for (const message of incoming) {
          if (document.hidden) {
            count += grouped ? data.messages.length : 1;
            document.title = `(${count}) ${t('profileNewMessage')} · ${baseTitle}`;
          }
          const text = grouped
            ? t('profileMessagesCount', { count: data.messages.length })
            : t('profileMessageFrom', { name: message.displayName });
          const toast = ElNotification({
            title: t('profileNewMessage'),
            message: text,
            duration: 6000,
            onClick: () => {
              open(message);
              toast.close();
            },
            onClose: () => notices.delete(toast)
          });
          notices.add(toast);
          if (
            document.hidden &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              const notice = new Notification(t('profileNewMessage'), {
                body: text,
                tag: `mail-${message.emailId}`
              });
              notices.add(notice);
              notice.onclick = () => {
                open(message);
                notice.close();
                notices.delete(notice);
              };
              notice.onclose = () => notices.delete(notice);
            } catch {
              /* Safari may require a home-screen installation for system notifications. */
            }
          }
        }
      } while ((more || dirty) && !stopped);
    } catch {
      /* Reconnect and periodic reconciliation retry without losing the cursor. */
    } finally {
      busy = false;
    }
  }
  useMailSync(refresh, { background: true });
  onMounted(() => {
    refresh();
    document.addEventListener('visibilitychange', clearTitle);
  });
  onBeforeUnmount(() => {
    stopped = true;
    document.removeEventListener('visibilitychange', clearTitle);
    document.title = baseTitle;
    for (const notice of notices) notice.close();
  });
}
