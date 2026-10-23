import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useSettingStore } from '@/store/setting.js';
dayjs.extend(utc);
dayjs.extend(timezone);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const language = () => useSettingStore().lang || 'en';
export function tzDayjs(time) {
  return dayjs.utc(time).tz(zone);
}
export function toUtc(time) {
  return dayjs(time).utc();
}
export function setExtend() {
  /* Date presentation uses Intl; no global language mutation. */
}
export function fromNow(value) {
  const at = tzDayjs(value),
    now = dayjs(),
    seconds = Math.max(0, now.diff(at, 'second'));
  const relative = new Intl.RelativeTimeFormat(language(), { numeric: 'auto' });
  if (now.isSame(at, 'day')) {
    if (seconds < 60) return relative.format(0, 'second');
    if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), 'minute');
    if (seconds < 7200) return relative.format(-Math.floor(seconds / 3600), 'hour');
    return new Intl.DateTimeFormat(language(), { hour: '2-digit', minute: '2-digit' }).format(
      at.toDate()
    );
  }
  if (now.subtract(1, 'day').isSame(at, 'day')) return relative.format(-1, 'day');
  return formatCalendarDate(value);
}
export const updateNow = fromNow;
export function formatCalendarDate(value, includeTime = false) {
  const at = tzDayjs(value);
  return new Intl.DateTimeFormat(language(), {
    month: 'short',
    day: 'numeric',
    ...(at.year() !== dayjs().year() ? { year: 'numeric' } : {}),
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(at.toDate());
}
export function formatDetailDate(value) {
  return new Intl.DateTimeFormat(language(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(tzDayjs(value).toDate());
}
