export function registrationEmail(value, suffix = '', fullAddressMode = false) {
  const email = String(value || '').trim();
  if (!email || fullAddressMode || email.includes('@')) return email;
  return email + suffix;
}
export function registrationPrefix(value) { return String(value || '').trim().split('@')[0]; }
export function registrationNeedsChallenge(error) {
  return error?.code === 400 && ['server_emptyBotToken','server_botVerifyFail'].includes(error.errorKey);
}
