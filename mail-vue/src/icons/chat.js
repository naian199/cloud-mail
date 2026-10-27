import { addCollection } from '@iconify/vue';

// Bundle chat controls so they also render when external icon services are unavailable.
const outline = (body) => ({
  body: `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
});
addCollection({
  prefix: 'cloud-mail',
  width: 24,
  height: 24,
  icons: {
    'external-mail': outline('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>'),
    chat: outline('<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 1-6a8 8 0 0 1-1-4V5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2Z"/><path d="M6 8h11M6 12h8"/>'),
    inbox: outline('<path d="M3 13 6 3h12l3 10v8H3Zm0 0h5l2 3h4l2-3h5"/>'),
    star: outline('<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>'),
    settings: outline('<path d="M3 7h3m6 0h9M3 17h9m6 0h3"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>'),
    analytics: outline('<path d="M12 3v9h9a9 9 0 1 1-9-9Zm3 0v6h6a9 9 0 0 0-6-6Z"/>'),
    lock: outline('<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>'),
    key: outline('<circle cx="7" cy="7" r="4"/><path d="m10 10 11 11h-4v-3h-3v-3h-3"/>'),
    menu: outline('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    more: outline('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    select: outline('<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>'),
    expand: outline('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'),
    play: outline('<path d="m9 5 11 7-11 7V5Z"/>'),
    bell: outline('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
    'bell-off': outline('<path d="m3 3 18 18M6 6a6 6 0 0 0 0 2c0 7-3 7-3 9h14M10 2a6 6 0 0 1 8 6c0 3 1 5 2 6M10 21h4"/>'),
    install: outline('<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'),
    microphone: outline('<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>'),
    stop: outline('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
    group: outline('<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>'),
    attach: outline('<path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a6 6 0 0 1 8 8l-8 8"/>'),
    search: outline('<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'),
    send: outline('<path d="m3 3 18 9-18 9 4-9-4-9Zm4 9h14"/>'),
    file: outline('<path d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M9 12h6m-6 4h6"/>'),
    copy: outline('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'),
    reply: outline('<path d="m10 5-7 6 7 6v-4c6 0 9 2 11 6 0-8-4-12-11-12V5Z"/>'),
    translate: outline(
      '<path d="M3 5h12M9 3v2m-4 3c1 4 4 7 8 9M13 5c-1 6-4 10-10 13m11 3 4-11 4 11m-7-3h6"/>'
    ),
    delete: outline('<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'),
    back: outline('<path d="m12 5-7 7 7 7M5 12h15"/>')
  }
});
