# 基础加密与传输保护

本版采用 Cloudflare 托管存储加密和 HTTPS/WSS，不引入应用层正文密钥或改写历史消息。

- Cloudflare D1 的数据库、元数据及备份由平台自动加密，使用 AES-256，GCM 为首选模式。R2 的对象及元数据同样自动加密。密钥由 Cloudflare 管理，既有数据不需要由应用迁移。
- 此保护针对底层存储，不会将 SQL 查询结果变成密文。拥有数据库访问权限的人仍可能读取或导出明文，应用和有权管理员也仍能读取正文。它不是应用层字段加密，也不是端到端加密。
- Worker 公网 HTTP 请求跳转 HTTPS，保留请求方法；localhost 开发继续使用 HTTP。HTTPS 响应设置 HSTS，不强制其他子域名。
- 生产聊天通知在 HTTPS 页面使用 WSS。WebSocket 升级响应保留原始句柄。
- API、管理员删除记录接口及通过 Worker 访问的附件响应设置 private/no-store，禁止浏览器及 CDN 缓存解密后的响应。该规则不追溯删除已下载的文件或以前的缓存副本，也不覆盖绕过 Worker 的第三方存储 URL。
- 若后台改用第三方 S3 存储，应由该存储服务配置静态加密及 HTTPS，不能根据 Cloudflare D1/R2 的说明推断第三方配置。
- 消息归属、停用状态和管理员查看已删除消息的访问校验继续执行；站内发信范围见 internal-direct-messaging.md。使用 Google 云翻译仍会将所选正文交给 Google。

官方说明：

- https://developers.cloudflare.com/d1/reference/data-security/
- https://developers.cloudflare.com/r2/reference/data-security/

验证：`transport-security.test.mjs` 检查 HTTPS 跳转、开发例外、敏感响应缓存策略、正文/状态/CORS 保留和 WebSocket 句柄保留。`check-deployment.py` 在部署时检查线上 HSTS 和 API no-store。聊天集成测试验证实际 WebSocket、发送、双向删除及管理员归档权限。
