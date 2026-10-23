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
