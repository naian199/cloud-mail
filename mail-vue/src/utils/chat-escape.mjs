export function hasChatOverlay(doc = document) {
  return [...doc.querySelectorAll('.el-overlay-dialog,.el-dialog,.el-drawer,.el-message-box,.el-overlay-message-box,.el-message-box__wrapper,.el-popover,.el-dropdown__popper,.el-select__popper')]
    .some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none');
}
