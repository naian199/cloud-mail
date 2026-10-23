// Safari may ignore viewport scale limits. Cancel only zoom gestures, so one-finger
// scrolling, taps, long presses and text entry retain their normal behavior.
export function installMobileViewport(target = document) {
  const preventPinch = (event) => {
    if (event.touches?.length > 1 && event.cancelable) event.preventDefault();
  };
  const preventGesture = (event) => {
    if (event.cancelable) event.preventDefault();
  };
  const options = { passive: false };
  target.addEventListener('touchstart', preventPinch, options);
  target.addEventListener('touchmove', preventPinch, options);
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    target.addEventListener(type, preventGesture, options);
  }
  return () => {
    target.removeEventListener('touchstart', preventPinch);
    target.removeEventListener('touchmove', preventPinch);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      target.removeEventListener(type, preventGesture);
    }
  };
}
