# ACL4SSR Rule Manager

一个自托管的 ACL4SSR/subconverter 规则管理与订阅转换平台。

它的定位是：你只把本平台生成的订阅地址填到 Clash/Mihomo 客户端里，平台每次被客户端请求时都会读取最新数据库规则、最新订阅源和上游 ACL4SSR 配置，然后调用内部 subconverter 输出最终 YAML。

## 核心能力

- 多 Profile：每个 Profile 独立维护订阅源、规则、输出参数和公开订阅 token。
- 多订阅源合并：支持多个机场订阅 URL，也支持 `vmess://`、`vless://`、`ss://`、`ssr://`、`trojan://` 单条节点或批量节点粘贴。
- 自定义规则管理：支持 `DOMAIN`、`DOMAIN-SUFFIX`、`DOMAIN-KEYWORD`、`IP-CIDR`、`IP-CIDR6`、`PROCESS-NAME`、`GEOIP`、`FINAL`、`MATCH`。
- 批量导入 Clash 规则块：可以识别 `#PT`、`#AI`、`#MCP` 这类分类注释。
- 规则冲突诊断：规则页面会直接提示“异组冲突”“同策略重复”“未命中上游”等状态。
- 动态订阅转换：保留 subconverter 的 URL 订阅转换方式，本平台只负责动态生成配置和过滤版 ruleset；内置 subconverter 使用支持 AnyTLS/Hysteria2 等协议的社区分支。
- 节点过滤：可在设置页或订阅源页填写节点排除正则，例如 `官网|到期时间|剩余流量`，生成时会写入动态配置并传给 subconverter。
- 流量/到期来源指定：可指定某个机场订阅 URL 作为最终订阅响应头 `subscription-userinfo` 的来源。
- Docker Compose 部署：`rule-manager` 对外提供 Web 和订阅地址，`subconverter` 只在内部 Docker 网络访问。

## 规则处理模式

### 置顶覆盖

手工规则放在最终规则最前面，上游原规则仍然保留。

Clash/Mihomo 是从上往下匹配，命中第一条就停止，所以你的规则会优先生效。这是默认推荐模式，最稳。

### 过滤上游

手工规则放在最终规则最前面，同时平台会生成过滤版上游 ruleset，把被你覆盖的上游规则移除。

适合你明确想消除重复规则，或者上游策略组和你设置的策略组不同的情况。

### 仅诊断

规则只参与冲突扫描，不会写入最终订阅配置。

适合临时观察某条规则在 ACL4SSR 上游里是否已经存在。

## 冲突诊断怎么看

规则页面的“冲突”列会显示上游首个命中的规则来源。

例如：

```text
同策略重复
上游已按同策略覆盖
上游策略：🚀 节点选择
来源文件：ProxyGFWlist.list
```

这表示：你的规则已经被上游 `ProxyGFWlist.list` 覆盖，而且上游策略组也是 `🚀 节点选择`。它不是冲突，只是重复覆盖。

如果显示“异组冲突”，表示上游首个命中的策略组和你手工设置的策略组不同。此时可以继续用“置顶覆盖”，也可以切到“过滤上游”让最终配置更干净。

## 默认内置规则

首次启动且数据库为空时，系统会自动创建一个 `主力配置` Profile，并导入当前项目内置的手工维护规则，包括：

- Lucky
- PT
- Other
- WJTJYY.TOP
- AI
- MCP
- AV 刮削

这些规则会保存在 SQLite 数据库里，后续可以直接在 Web 页面增删改查。已有数据库不会被种子脚本覆盖。

## Docker Compose 部署

### 1. 准备环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

按需修改：

```env
APP_BASE_URL=http://你的服务器IP或域名:8080
ADMIN_PASSWORD=你的管理密码
AUTH_SECRET=至少16位随机字符串
DATABASE_URL=file:/data/app.db
SUBCONVERTER_URL=http://subconverter:25500
ACL4SSR_BASE_CONFIG_URL=https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_Google.ini
DEFAULT_PROFILE_TOKEN=
```

说明：

- `ADMIN_PASSWORD` 是 Web 登录密码。
- `APP_BASE_URL` 会影响订阅地址和过滤版 ruleset 地址，部署到服务器后建议改成公网可访问地址。
- `DEFAULT_PROFILE_TOKEN` 留空会自动随机生成；如果想固定订阅 token，可以手动填写。

### 2. 启动服务

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://localhost:8080
```

默认情况下，如果没有设置 `.env`，管理员密码是：

```text
change-me
```

正式部署建议一定修改 `ADMIN_PASSWORD` 和 `AUTH_SECRET`。

### 3. 检查健康状态

```bash
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
```

`/health/ready` 会检查：

- SQLite 数据库是否可访问
- 内部 subconverter 是否可访问
- ACL4SSR 上游规则是否可缓存

## 客户端订阅地址

在 Web 顶部可以复制当前 Profile 的订阅地址，格式如下：

```text
http://localhost:8080/sub/:profileToken?target=clash
```

常用地址：

```text
GET /sub/:profileToken?target=clash
GET /config/:profileToken.ini
GET /rulesets/:profileToken/:rulesetName.list
GET /health/live
GET /health/ready
```

当前核心输出以 Clash/Mihomo YAML 为主。其他 `subconverter` 支持的 target 可以透传，但自定义规则是否能被目标格式安全表达，需要按目标客户端能力判断。

## 发布 Docker 镜像

本项目可以直接构建成一个 `rule-manager` 镜像，另一个服务使用支持 AnyTLS 的 `asdlokj1qpi23/subconverter:latest`。

### 构建本地镜像

```bash
docker build -t acl4ssr-rule-manager:latest .
```

### 推送到 Docker Hub

把下面的 `你的用户名` 替换成 Docker Hub 用户名：

```bash
docker login
docker tag acl4ssr-rule-manager:latest 你的用户名/acl4ssr-rule-manager:latest
docker push 你的用户名/acl4ssr-rule-manager:latest
```

### 推送到 GHCR

把下面的 `你的GitHub用户名` 替换成 GitHub 用户名或组织名：

```bash
docker login ghcr.io
docker tag acl4ssr-rule-manager:latest ghcr.io/你的GitHub用户名/acl4ssr-rule-manager:latest
docker push ghcr.io/你的GitHub用户名/acl4ssr-rule-manager:latest
```

### 使用已发布镜像部署

如果服务器不想现场构建，可以使用下面这种 Compose 片段：

```yaml
services:
  rule-manager:
    image: 你的用户名/acl4ssr-rule-manager:latest
    container_name: acl4ssr-rule-manager
    restart: unless-stopped
    ports:
      - "8080:3000"
    environment:
      APP_BASE_URL: ${APP_BASE_URL:-http://localhost:8080}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-change-me}
      AUTH_SECRET: ${AUTH_SECRET:-replace-with-a-random-string-at-least-16-chars}
      DATABASE_URL: ${DATABASE_URL:-file:/data/app.db}
      SUBCONVERTER_URL: ${SUBCONVERTER_URL:-http://subconverter:25500}
      ACL4SSR_BASE_CONFIG_URL: ${ACL4SSR_BASE_CONFIG_URL:-https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_Google.ini}
      DEFAULT_PROFILE_TOKEN: ${DEFAULT_PROFILE_TOKEN:-}
    volumes:
      - data:/data
    depends_on:
      - subconverter

  subconverter:
    image: asdlokj1qpi23/subconverter:latest
    container_name: acl4ssr-subconverter
    restart: unless-stopped
    expose:
      - "25500"

volumes:
  data:
```

## 数据持久化

SQLite 数据库、上游缓存和日志目录都挂载在 Docker volume `data` 里：

```text
/data/app.db
/data/cache
/data/logs
```

重建镜像或升级容器不会删除规则。只有删除 Docker volume 才会清空数据。

## 本地开发

安装依赖：

```bash
npm install
```

初始化本地数据库：

```powershell
$env:DATABASE_URL="file:./dev.db"
npm run seed
```

启动开发服务：

```bash
npm run dev
```

常用检查：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 转换流程

1. 客户端请求 `/sub/:profileToken?target=clash`。
2. 平台读取当前 Profile、启用的订阅源、自定义规则和规则模式。
3. 启用订阅源按排序拼成 `source1|source2|source3`，先由 `/nodes/:profileToken` 调用 subconverter 转成 `mixed` 纯节点源，避免机场 Clash 订阅自带规则覆盖 ACL4SSR 规则；若 `mixed` 无输出（如 AnyTLS 订阅），则回退为直接拉取并解码原始订阅节点链接。
4. 平台生成动态外部配置 `/config/:profileToken.ini`：
   - 手工规则按策略组生成 `/custom-rulesets/:profileToken/:rulesetName.list`，并排在上游规则之前。
   - `过滤上游` 规则会把对应上游 ruleset URL 替换成本平台的过滤版地址。
5. 平台调用内部 `SUBCONVERTER_URL/sub?...`，其中 `url=` 指向本平台 `/nodes/:profileToken`，`config=` 指向本平台 `/config/:profileToken.ini`。
6. 返回最终 Clash/Mihomo YAML。

上游 ACL4SSR ruleset 会缓存，但每次订阅请求都会读取数据库里的最新自定义规则和订阅源。

## 常见问题

### ACL4SSR 上游每天更新后，我的规则会不会丢？

不会。上游规则是动态读取和缓存的，你的规则存在本平台 SQLite 数据库里。每次生成订阅时，平台都会把你的规则重新置顶合并进去。

### subconverter 会直接暴露公网吗？

不会。Compose 里 `subconverter` 只使用 `expose: 25500`，只在 Docker 内部网络可访问。

### 多机场订阅怎么合并？

在“订阅源”页面添加多个机场订阅 URL，启用后按排序合并。平台会用 `|` 拼接后先转成 `mixed` 纯节点源，再进入最终配置生成。

### 能显示机场流量和到期时间吗？

可以。平台会读取机场订阅 URL 响应头里的 `subscription-userinfo`，在“订阅源”表格里展示已用流量、总流量和到期时间。点击“刷新元信息”可以强制重新读取。

如果一个 Profile 同时维护多个订阅源，可以在“订阅源”或“设置”页的“流量/到期来源”中指定某个机场订阅 URL。指定后，客户端请求 `/sub/:profileToken` 时返回的 `subscription-userinfo` 响应头只使用这个订阅源；未指定时会自动汇总所有启用的机场订阅源。

### 直链节点怎么输入？

订阅源类型选择“单条节点直链”或“批量节点”，填入 `vmess://`、`vless://`、`ss://`、`ssr://`、`trojan://` 等内容即可。

### 如何过滤机场里不想要的节点？

在“订阅源”页面右侧的“节点名称过滤”里填写“排除正则”；“设置”页也有同一个入口，“生成预览”页面会显示当前过滤状态。例如：

```text
官网|到期时间|剩余流量|距离下次重置剩余|永久地址
```

生成订阅时平台会把它写入动态外部配置，并在实际调用 subconverter 时作为 `exclude=` 参数传入：

```ini
exclude_remarks=官网|到期时间|剩余流量|距离下次重置剩余|永久地址
```

subconverter 会过滤节点名称中命中这些关键词的节点。修改过滤词后，客户端需要重新更新订阅。
