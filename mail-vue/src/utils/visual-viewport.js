// One viewport source also serves dialogs teleported outside the app layout.
export function installVisualViewport(win = window) {
  const doc = win.document, root = doc.documentElement;
  let frame = 0;
  function update() {
    frame = 0;
    const viewport = win.visualViewport;
    if (viewport && viewport.scale !== 1) return;
    root.style.setProperty('--app-viewport-height', `${viewport?.height || win.innerHeight}px`);
    root.style.setProperty('--app-viewport-top', `${viewport?.offsetTop || 0}px`);
    const editing = doc.activeElement?.matches('input,textarea,[contenteditable="true"]');
    root.classList.toggle('mobile-keyboard-open', !!editing && win.matchMedia('(any-pointer: coarse)').matches &&
      win.innerHeight - (viewport?.height || win.innerHeight) > 120);
  }
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update); };
  win.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);
  doc.addEventListener('focusin', schedule);
  doc.addEventListener('focusout', schedule);
  update();
  return () => {
    win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    win.visualViewport?.removeEventListener('resize', schedule);
    win.visualViewport?.removeEventListener('scroll', schedule);
    doc.removeEventListener('focusin', schedule);
    doc.removeEventListener('focusout', schedule);
    for (const key of ['--app-viewport-height','--app-viewport-top']) root.style.removeProperty(key);
    root.classList.remove('mobile-keyboard-open');
  };
}
