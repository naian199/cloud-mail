// Shared formatting for membership pages.
export const money = (amount, currency, locale) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100);
export const day = (seconds, locale) => (seconds ? new Date(seconds * 1000).toLocaleDateString(locale) : '');
export const dateTime = (seconds, locale) => (seconds ? new Date(seconds * 1000).toLocaleString(locale) : '');
