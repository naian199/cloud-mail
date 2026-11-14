import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { categoryUnread } from '@/composables/use-category-unread';
import { useAccountStore } from '@/store/account';

// The site's sections. Every route belongs to exactly one, so the desktop rail and the phone tab
// bar always agree on what is active. Mail is a fixed secondary entry on desktop and sits under
// "Me" on phones, where it keeps its own unread count.
export const SECTIONS = {
  chat: ['mail-chat', 'rooms'],
  store: ['apps', 'app-detail', 'app-publish', 'app-review'],
  files: ['files'],
  mail: ['external-mail', 'email', 'content', 'send', 'draft', 'star'],
  me: ['me', 'setting', 'user', 'role', 'sys-setting', 'reg-key', 'all-email', 'analysis']
};

export function sectionOf(name) {
  return Object.keys(SECTIONS).find((key) => SECTIONS[key].includes(name)) || '';
}

export function useSiteNav() {
  const route = useRoute();
  const accounts = useAccountStore();
  const section = computed(() => sectionOf(route.name));
  // Mail unread counts each unread external message once (the conversation view and the inbox
  // show the same messages), for the current mailbox.
  const unread = computed(() => {
    const summary = categoryUnread.value;
    const mailbox = summary.accounts[accounts.currentAccountId] || {};
    const chat = (Number(mailbox.chat) || 0) + (Number(summary.categories.group) || 0) + (Number(summary.categories.channel) || 0);
    return { chat, mail: Number(mailbox.external) || 0 };
  });
  return { section, unread };
}

export const badge = (n, format) => (n > 99 ? format(99) + '+' : format(n));
