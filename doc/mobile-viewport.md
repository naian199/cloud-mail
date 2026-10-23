# Mobile viewport behavior

The mobile web UI uses device width and a fixed 1× page scale, as requested by the site owner. Viewport limits, coarse-pointer `touch-action`, and Safari gesture handlers work together to suppress browser pinch/double-tap zoom. Multi-touch prevention applies only when two or more touches are present; normal single-finger scrolling, tapping, long presses and text entry remain available. Desktop keyboard/browser zoom and operating-system accessibility magnification are controlled by the browser/OS.

Mobile input controls use at least 16px text to prevent Safari's automatic focus zoom. Text autosizing is fixed at 100% during rotation. Dialogs, drawers and long notifications stay within device width. Existing compact chat layout and safe-area padding are retained. All compact mobile pages use the visual viewport height/offset, including during viewport contraction, rather than applying this only to the active conversation.

Sandboxed rich-email documents install the same gesture handlers without changing their sandbox, CSP, link or attachment permissions. Image-viewer controls can still enlarge an individual image; the page remains at 1×.

Validation uses Chromium touch emulation at 320/390px portrait widths, 844px landscape width and a reduced viewport. Checks cover native pinch/double-tap, Safari gesture cancellation, single-finger scrolling, long-press menus, input size, draft retention and settings width. These are simulated mobile checks, not a physical iPhone Safari test; browsers can override page zoom restrictions for accessibility.
