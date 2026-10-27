# Cloud Mail · naian199

独立维护的 Cloudflare 邮箱与聊天项目。当前独立版本为 **1.12.1**。

[English](README-en.md) · [项目仓库](https://github.com/naian199/cloud-mail) · [更新记录](CHANGELOG.md) · [部署与维护](doc/deployment.md)

## 功能

- [邮件会话](doc/mail-conversations.md)：普通邮件用聊天气泡展示，历史引用折叠，品牌邮件可查看原版；对外回复仍按正常邮件发送。
- [站内即时聊天](doc/internal-direct-messaging.md)：联系人、唯一用户名、备注、在线状态、已读回执及图片附件。
- [私有群组、频道与语音输入](doc/groups-and-channels.md)：邀请加入、成员权限、消息实时更新及语音转文字。
- [多语言与自动翻译](doc/languages-and-translation.md)：跟随界面语言，支持浏览器本地能力与配置后的 Google Cloud Translation。
- [表情包](doc/telegram-stickers.md)、[会话搜索与媒体](doc/conversation-search-and-media.md)、[手机布局](doc/mobile-viewport.md)。
- 邮箱收发、草稿、附件、权限管理、验证码识别、统计、可选第三方登录及通知。

## 独立维护

构建和部署只读取本仓库代码；没有原项目的版本检查、更新提醒、自动同步或自动合并流程。版本元数据统一维护在 [shared/project-info.mjs](shared/project-info.mjs)，前后端包版本与更新记录同步维护。

向本仓库 `main` 推送应用改动后，GitHub Actions 构建并部署到配置的 Cloudflare 资源。需要的资源、变量、运行方式和验证步骤见[部署文档](doc/deployment.md)。问题请提交到[本仓库 Issues](https://github.com/naian199/cloud-mail/issues)。没有单独的社群或捐助入口。

## 项目结构

- `mail-vue/`：Vue 3、Element Plus 前端。
- `mail-worker/`：Hono 后端、邮件处理和 Cloudflare Worker。
- `shared/`：语言目录与本项目版本元数据。
- `doc/`：功能、部署和维护文档。
- `.github/workflows/`：本仓库的构建、验证与部署流程。

## 外部服务与许可证

平台和功能所需的 Cloudflare、邮件投递、可选翻译、Telegram、OAuth 等服务见[依赖清单](doc/independent-maintenance.md)。这些服务与原项目的更新入口无关。

项目保留 [MIT 许可证](LICENSE) 及其要求的版权声明。代码来源和第三方组件声明见 [NOTICE.md](NOTICE.md)。独立维护不删除合法署名或 Git 历史。

[视频播放与拖放附件 / Video playback and file drop](doc/video-and-file-drop.md)
