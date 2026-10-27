# 部署与维护

本项目部署源为 `naian199/cloud-mail`，使用 `.github/workflows/deploy-cloudflare.yml`。
不需要访问其他项目的演示站点或复制其更新流程。

## 现有站点

现有站点为 `https://e.naian.edu.kg`。在同一 Cloudflare Worker、D1、KV 和附件存储上发布代码，会继续使用原有业务数据。不要为普通版本发布新建替代数据库、修改资源 ID 或清空资源。

## GitHub Actions 配置

在本仓库的 Actions secrets/variables 中配置现有部署流程所需的值：

- `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`：部署到自己的 Cloudflare 账号。
- `D1_DATABASE_ID`、`KV_NAMESPACE_ID`：现有数据库与 KV。
- `DOMAIN`：邮箱域名的 JSON 数组；`ADMIN`：管理员邮箱。
- `JWT_SECRET`：沿用现有密钥，勿在普通更新时更换。
- 网站域名固定为工作流中的 `CUSTOM_DOMAIN: e.naian.edu.kg`，不再读取同名 Secret/Variable，以防旧值 `199.naian.edu.kg` 在发布时覆盖当前绑定；`NAME` 仍为现有 Worker 名称。
- `R2_BUCKET_NAME`：使用 R2 时的现有附件桶；其他存储遵循站点现有设置。
- `CLOUDFLARE_EMAIL`：使用 Cloudflare 发件绑定时启用；否则沿用配置的邮件服务。
- `AI_MODEL`、`ANALYSIS_CACHE`、`PROJECT_LINK`：保留现有配置。`PROJECT_LINK` 只控制登录页是否显示本项目仓库入口。

具体必填校验及生成的 Wrangler 配置以当前工作流为准。不要将密钥写入源码、Issues、截图或文档。

向 `main` 推送 `mail-worker/`、`mail-vue/`、`shared/` 或部署工作流的变更会触发部署；仅修改文档时可在 Actions 手动运行。流程安装依赖、检查项目身份和语言目录、运行测试、构建前端、部署 Worker、运行增量初始化并验证线上版本。

## 本地开发

使用 Node.js 24 和 pnpm 11，分别在 `mail-worker` 与 `mail-vue` 安装依赖。

- 前端：在 `mail-vue` 执行 `pnpm dev`；开发 API 默认是本机 `127.0.0.1:8787/api`。
- 后端：基于 Wrangler 配置准备自己的本地 D1、KV、Durable Objects 和站点初始化，再运行 `wrangler dev`。不要连接生产数据库进行测试。
- `pnpm remote` 使用 `.env.remote` 中的自有站点 API；这会访问真实站点，普通开发优先使用本地模式。
- 生产构建：在 `mail-vue` 执行 `pnpm build`，输出到 `mail-worker/dist`。

功能与资源说明见同目录的邮件会话、群组频道、表情包和翻译文档。

## 发布版本

同时更新 `shared/project-info.mjs`、两个 `package.json` 的版本和 `CHANGELOG.md`；运行：

```bash
node scripts/check-project-identity.mjs
node scripts/check-locales.mjs
node --test mail-worker/test/*.test.mjs
```

本地集成测试需要已初始化的隔离 Worker/D1，具体要求见 `mail-worker/test/*.integration.mjs`。构建通过后推送并确认部署工作流成功。原项目没有自动同步或自动合并入口；以后引入外部修复时，需要单独评审与现有功能的兼容性。
