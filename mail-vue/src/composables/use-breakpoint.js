import { computed, effectScope } from 'vue';
import { useMediaQuery, useWindowSize } from '@vueuse/core';

// One source of truth for layout breakpoints. CSS media queries use the same
// numbers: phone ≤767px, tablet ≤1024px, compact desktop ≤1366px.
export const BREAKPOINTS = Object.freeze({ phone: 767, tablet: 1024, laptop: 1366 });

// Phones, including landscape phones whose width exceeds the phone breakpoint.
export const PHONE_QUERY = '(max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse)';

let shared = null;

// Returns app-wide reactive viewport state. A detached scope keeps exactly one
// set of listeners for the app's lifetime, however many components (cached by
// keep-alive or not) read it, so no component needs its own resize handler.
export function useBreakpoint() {
  if (shared) return shared;
  shared = effectScope(true).run(() => {
    const { width, height } = useWindowSize();
    const phone = useMediaQuery(PHONE_QUERY);
    return {
      width,
      height,
      isPhone: phone,
      isTablet: computed(() => width.value <= BREAKPOINTS.tablet),
      isLaptop: computed(() => width.value <= BREAKPOINTS.laptop)
    };
  });
  return shared;
}
