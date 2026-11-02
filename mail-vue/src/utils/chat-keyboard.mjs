// Touch keyboards use Enter for a line break; explicit send and Ctrl/Command+Enter remain available.
export function shouldSendOnEnter(event, touchCompact = false) {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229 &&
    (!touchCompact || event.ctrlKey || event.metaKey);
}
