import { fetchBrandIcon } from '../mail-worker/src/lib/brand-avatar.js';

// Optional public source check: no email addresses, message bodies or credentials.
const icon = await fetchBrandIcon('atlassian.com');
console.log(icon
  ? '::notice::Brand icon source verified: Atlassian returned a bounded PNG through the trusted favicon service.'
  : '::warning::Brand icon source unavailable from this runner; letter-avatar fallback remains active.');
