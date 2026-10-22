# 好友与实时私聊

同一 Cloud Mail 站点的注册用户可以使用侧边栏的「好友聊天」。输入对方的**注册邮箱**发送申请，接收方接受后才能聊天。当前支持一对一文字聊天，不跨站、不通过外部邮件投递消息；附加邮箱别名不单独拥有好友身份。

- 支持申请、接受、拒绝、撤销申请、删除好友。
- 消息存入 D1，包含历史分页、未读数、断线后的消息补齐。
- WebSocket 推送变更通知；消息内容仍通过验证登录状态与好友关系的 HTTP 接口读取。
- 手机端默认展示好友列表，进入会话后可返回；消息草稿在页面内按好友分别保留。
- Enter 发送，Shift+Enter 换行。中文输入法确认候选词不会触发发送。每条消息最多 2000 字符。
- 删除好友会删除双方该段关系的聊天记录，之后不能继续读取或发送。重新加好友会建立新会话。

## 部署与数据库更新

1. 正常构建前端：在 `mail-vue` 执行 `pnpm install --frozen-lockfile` 和 `pnpm run build`。
2. 本变更已在四个 `mail-worker/wrangler*.toml` 配置中加入 `CHAT_NOTIFICATIONS` Durable Object 绑定、`ChatNotifications` 导出类，以及 `chat-notifications-v1` SQLite 类迁移。自行维护 Wrangler 配置的部署也需要合并这两节；保留自己已有的其他迁移。
3. 部署 Worker 后，按原有数据库更新流程调用 `/api/init/<jwt_secret>`，执行好友/消息表迁移。不要公开或记录实际密钥 URL。该初始化入口及其鉴权方式沿用项目现有行为。初始化可重复执行，不会清空聊天记录。
4. 反向代理需允许 `/api/chat/socket` WebSocket 升级，不能剥离 `Sec-WebSocket-Protocol` 头。浏览器在该头中携带现有登录令牌，服务端只回显 `cloud-mail-chat` 协议名。请勿记录完整协议头。
5. 使用 HTTPS 访问线上页面。生产构建使用同源 `/api`，开发模式使用 `.env.dev` 中的本地 Worker 地址。

无需增加 Resend、R2 或其他第三方聊天凭证。实际云端部署需要 Cloudflare 支持 SQLite Durable Objects 的环境。前端会显示实时连接状态，断线后自动重连，并每 15 秒核对数据以恢复丢失的通知；定时核对不替代 WebSocket 配置。

聊天接口不是端到端加密服务；D1 保存消息明文。登录验证沿用现有 JWT + KV 会话，并额外检查发送者、好友账号在 D1 中是否有效。已退出登录的旧连接只可能收到无内容的刷新信号，无法用失效令牌读取消息。

## 本地验证

使用 Node.js 24、pnpm 11，安装 `mail-worker` 依赖，构建前端后在 `mail-worker` 运行：

```sh
pnpm dev
```

确认配置使用本地 D1、KV 和 Durable Objects；通过项目的初始化入口完成本地迁移，并保持 `example.com` 本地注册可用。随后执行：

```sh
node --test test/chat.integration.mjs
node --test test/chat-schema.test.mjs
```

可通过 `CHAT_TEST_BASE_URL` 更改本地 API 地址，默认是 `http://127.0.0.1:8787/api/`。测试拒绝远程域名，会创建随机的本地测试账号及消息；最后移除测试好友关系并退出测试会话。账号保留在本地数据库，建议使用独立的本地持久化目录。

测试覆盖登录校验、好友双方确认、重复/交叉申请、WebSocket 身份校验与实际推送、消息去重/长度限制、第三方越权、历史分页、未读游标、拒绝/撤销/删除好友及重新建立关系后的历史隔离。原有 `pnpm test` 是远程部署命令，不用于这些测试。
