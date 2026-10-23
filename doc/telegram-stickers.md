# Emoji and Telegram sticker packs

Chat has a smiley button next to the attachment control. Its emoji tab includes the bundled Unicode 15 catalog (1,870 emoji, 3,395 entries including skin tones); rendering uses the device's fonts. Choosing an emoji inserts it at the draft cursor. The catalog and animation player are loaded on demand.

The sticker tab accepts `https://t.me/addstickers/<name>`, `https://t.me/addemoji/<name>` or a pack name. Packs are imported through the platform's existing **system settings → Telegram bot** token. Users do not supply personal credentials. Notification forwarding does not need to be enabled, and importing never sends Telegram messages. If the platform has no working bot token or Telegram is unreachable, import displays an error; local uploads and Unicode emoji still work. No live provider account was configured or tested as part of this change.

There is no public API to enumerate every Telegram pack. Import supports any pack that Telegram's Bot API makes available to the platform bot, including accessible custom emoji packs. It does not bypass premium, private, unavailable or author restrictions. A pack's availability on Telegram alone does not grant reuse rights.

Supported media:

- WebP static stickers display as normal inline images.
- TGS gzip/Lottie animations display inline using a bundled player, without evaluating expressions or loading external animation resources.
- WebM video stickers play inline, muted and looping. Playback depends on browser codec support; unsupported browsers retain the attachment download control.

The picker imports at most 200 entries per pack (Telegram's current custom emoji pack maximum), and remembers 20 pack names on this device. It does not preload every pack or sticker. Users can also upload exported WebP/TGS/WebM files. Selecting a sticker adds it to the current draft; the existing Send action delivers it as an authenticated mail attachment to both participants. Historical messages keep working independently of later changes to the Telegram pack. Existing message deletion and administrator archive rules apply.

Pack metadata is cached in platform KV for 24 hours. Telegram credentials and upstream download URLs never reach the browser. Authenticated downloads must reference a sticker in the chosen manifest; upstream methods and hosts are fixed, redirects are rejected, and downloads are bounded to 1 MiB. Sent messages keep the existing attachment size rules. Animated previews load when visible, pause offscreen, release resources on unmount, and respect reduced motion for TGS. Invalid or unsupported media retains the download option.

Validation: mocked provider tests verify pack URLs, three format manifests, token handling, fixed upstream paths and size bounds. Local browser checks cover real authenticated mail delivery and inline rendering with generated media fixtures. Chromium mobile emulation is not an iPhone Safari device test. Dependencies: Emoji Mart data (MIT), lottie-web (MIT), fflate (MIT); original notices remain in their packages.
