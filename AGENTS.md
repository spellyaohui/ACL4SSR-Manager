# ACL4SSR-Manager 智能体规则

## 项目定位

- 本项目是 Next.js + Prisma + SQLite 的 ACL4SSR/subconverter 规则管理平台。
- 生产部署默认使用 Docker Compose，服务目录通常为 `/opt/acl4ssr-rule-manager`，数据在 Docker volume `data` 中。
- `acl4ssr-rule-manager` 对外提供 Web/API/订阅地址，`acl4ssr-subconverter` 只在 Docker 内部网络访问。

## 本地验证

- 修改 TypeScript、Prisma、前端页面、Docker 或订阅生成逻辑后，默认执行：
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- 修改 Prisma schema 后先执行 `npx prisma generate`。
- 旧 SQLite 自动补列逻辑在 `prisma/seed.ts` 的 `ensureSchema()` 中维护；新增字段时必须同步更新这里，保证容器启动可迁移旧数据。

## 订阅与过滤规则

- 流量/到期时间来自机场订阅 URL 的 `subscription-userinfo` 响应头。
- Profile 的 `subscriptionInfoSourceId` 用于指定哪个 `SUBSCRIPTION` 源负责 `/sub/:token` 响应头中的流量和到期时间；未指定时才汇总所有启用的机场订阅源。
- 节点名称过滤配置保存在 `Profile.nodeExcludeRegex`。
- 动态 config 中保留 `exclude_remarks=`，但调用 subconverter `/sub` 时必须传 `exclude=`，否则说明节点可能不会被过滤。
- 修改过滤逻辑后，要抓取最终 `/sub/:token?target=clash` YAML，扫描命中的节点名称，不只看预览 URL。

## 远程操作

- Windows PowerShell 下执行 SSH/SCP 时遵守非交互约定：
  - 使用 `-T -o BatchMode=yes -o ConnectTimeout=10`
  - 已知主机优先 `-o StrictHostKeyChecking=yes`，首次连接可用 `accept-new`
  - 复杂远端命令放入 here-string 后通过 `ssh ... 'sh -s'` 执行
  - 不把复杂命令嵌套进双引号
- 远程修改前先确认容器、目录和配置文件；涉及 `.env` 必须先备份。
- 用户明确说由他重启时，只同步文件和给出重启说明，不主动重启服务。

## GitHub 上传与 Release

- 上传 GitHub 必须先阅读 `Docs/GitHub上传规则.md`，并按本项目规则执行。
- 默认分支是 `main`，远端是 `origin`。
- 每次提交前必须创建或更新 `Docs/版本更新说明_YYYY-MM-DD.md`。
- 影响功能、部署、页面入口或使用方式时必须同步更新 `README.md`。
- 前端或服务端源码变更必须先通过本地验证命令。
- 禁止使用 `git add .` 或 `git add -A`；必须白名单 staging。
- 不上传 `.env`、密钥、真实订阅 URL、数据库文件、临时包、构建缓存或本地验证产物。
- 提交、Release 标题和说明统一使用中文。
- 推送后使用统一发布脚本：
  - `pwsh .\scripts\create-github-release.ps1`
- 发布完成后记录 commit hash、Release 链接和最终 `git status`。
