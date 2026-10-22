export function mailDate(value) {
  const iso = String(value).replace(' ', 'T');
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

export function showChatTime(current, previous) {
  if (!previous) return true;
  const a = mailDate(current),
    b = mailDate(previous);
  return a.toDateString() !== b.toDateString() || Math.abs(a - b) >= 5 * 60 * 1000;
}

export function chatTimeLabel(value, locale = 'zh-CN', now = new Date()) {
  const at = mailDate(value);
  const clock = at.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  if (at.toDateString() === now.toDateString()) return clock;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString())
    return `${locale.startsWith('zh') ? '昨天' : 'Yesterday'} ${clock}`;
  return `${at.toLocaleDateString(locale, { ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}), month: 'short', day: 'numeric' })} ${clock}`;
}
