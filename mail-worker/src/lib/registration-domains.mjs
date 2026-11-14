function domainList(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

export function registrationDomains(env) {
  const excluded = new Set(domainList(env.registration_excluded_domains));
  return domainList(env.domain).filter((domain) => !excluded.has(domain));
}
