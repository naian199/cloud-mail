# Cloud Mail · naian199

An independently maintained email and chat application on Cloudflare. Independent release: **1.8.0**.

[简体中文](README.md) · [Repository](https://github.com/naian199/cloud-mail) · [Changelog](CHANGELOG.md) · [Deployment](doc/deployment.md)

## Features

- [Mail conversations](doc/mail-conversations.md): compact text bubbles, collapsible quoted history and original previews for branded mail. External recipients receive ordinary email replies.
- [Internal messaging](doc/internal-direct-messaging.md): contacts, unique usernames, private contact notes, presence, read receipts and attachments.
- [Private groups, channels and voice dictation](doc/groups-and-channels.md).
- [Interface languages and automatic translation](doc/languages-and-translation.md).
- [Sticker packs](doc/telegram-stickers.md), [conversation search and media](doc/conversation-search-and-media.md), and [mobile layouts](doc/mobile-viewport.md).
- Email delivery, drafts, attachment storage, permissions, statistics, verification code recognition, optional OAuth and notifications.

## Independent maintenance

Builds and deployments use this repository. There is no original-project release checker, update notification, automatic synchronization or merge workflow. Release metadata lives in [shared/project-info.mjs](shared/project-info.mjs); keep both package versions and the changelog aligned with it.

Application changes pushed to `main` trigger the repository's Cloudflare deployment workflow. See [deployment instructions](doc/deployment.md) for configuration and verification. Report issues in [this repository](https://github.com/naian199/cloud-mail/issues). No separate community or donation destination is configured.

## Layout

- `mail-vue/`: Vue 3 and Element Plus frontend.
- `mail-worker/`: Hono backend, email handling and Cloudflare Worker.
- `shared/`: language catalogs and project identity.
- `doc/`: feature and maintenance documentation.
- `.github/workflows/`: build, validation and deployment.

## Services and licenses

[Independent maintenance notes](doc/independent-maintenance.md) list remaining platform and feature services. They are separate from original-project update services.

The [MIT license](LICENSE), required copyright notices and Git history are retained. See [NOTICE.md](NOTICE.md) for provenance and third-party notices.

[视频播放与拖放附件 / Video playback and file drop](doc/video-and-file-drop.md)
