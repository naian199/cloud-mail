// Opens a message's menu with a touch long press (pointer or touch events),
// and swallows the click that ends the press.
// headerMenuAllowed(): whether pressing the thread header (no message) may open a menu.
// menuOpen(): whether a message menu is currently shown.
export function useMessagePress({ headerMenuAllowed, openMessageMenu, menuOpen }) {
  let pressTimer, pressStart, suppressUntil = 0;

  function cancelPress() {
    clearTimeout(pressTimer);
    pressStart = null;
  }
  function startPress(event, message) {
    if ((!message && !headerMenuAllowed()) || event.pointerType !== 'touch') return;
    if (event.target?.closest('button, a, input, textarea, select, .message-translation')) return;
    cancelPress();
    pressStart = { x: event.clientX, y: event.clientY };
    pressTimer = setTimeout(() => {
      suppressUntil = Date.now() + 800;
      openMessageMenu(event, message);
    }, 450);
  }
  function startTouch(event, message) {
    if (event.touches.length !== 1) { cancelPress(); return; }
    const touch = event.touches[0];
    startPress({ pointerType: 'touch', target: event.target, currentTarget: event.currentTarget,
      clientX: touch.clientX, clientY: touch.clientY, preventDefault() {} }, message);
  }
  function moveTouch(event) {
    if (event.touches.length !== 1) { cancelPress(); return; }
    movePress(event.touches[0]);
  }
  function endTouch(event) {
    cancelPress();
    if (menuOpen() && Date.now() < suppressUntil && event.cancelable) event.preventDefault();
  }
  function movePress(event) {
    if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10)
      cancelPress();
  }
  function suppressAfterPress(event) {
    if (Date.now() < suppressUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return { cancelPress, startPress, startTouch, moveTouch, endTouch, movePress, suppressAfterPress };
}
