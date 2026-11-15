# monitor

文档：[monitor-document.pages.dev](https://monitor-document.pages.dev)，安装、配置、反向代理与主题开发都在这里。

主题站：[monitor-themes.pages.dev](https://monitor-themes.pages.dev)，在线预览各个公开页主题，复制地址即可在面板安装。

## 默认主题：HEX

默认内置 [BaeKey/monitor-theme-hex](https://github.com/BaeKey/monitor-theme-hex) 的 HEX，保留 `hex` 主题标识和配置。
主题源码仍在独立仓库维护；`web-theme.pin` 固定提交和源码 SHA-256，构建时从该提交编译，不复制源码进本仓库。
已有数据库选择的其他主题保持不变；新部署或没有有效外置主题时使用内置 HEX。

修改 HEX 后，将修改推送至主题仓库，再在本仓库执行：

```sh
./scripts/update-theme.sh          # 锁定 HEX main 最新提交；也可指定提交/分支/标签
./scripts/theme.sh                 # npm ci + 构建主题并校验
# 将更新后的 web-theme.pin 提交并合并到 main
```

初次从源码构建需要 Node.js 24+、npm、curl、tar、shasum。主题的许可证与 NOTICE 随构建保留在 `target/theme/`。
主题仓库的提交不会自动改变已发布镜像；需要更新 pin 并重新构建，避免同一 hub 提交隐式使用不同主题。

当前锁定的 HEX 已支持根路径及多层子路径公开页，API、WebSocket、资源和导航跟随 hub 注入的路径前缀。
本仓库锁定主题仓库已发布的 `v1.2.8` 提交，不依赖可变分支；该版本也移除了手机端版本查询、更新提醒和升级入口。
费用、到期等显示开关同时约束列表、表格、详情和相关提醒；手机可跟随通用或独立配置。

## Docker 镜像发布

每次推送 `main` 或手动运行 `main` 的 release 工作流，都会先执行完整 CI，再构建并发布 Linux amd64/arm64 多架构镜像：

- `ghcr.io/baekey/monitor:latest`
- `ghcr.io/baekey/monitor:main`
- `ghcr.io/baekey/monitor:sha-<完整提交号>`（用于固定版本或回滚）

只有 `v*` 标签创建 GitHub 二进制 Release；普通 `main` 更新不创建版本 Release。
GHCR 使用仓库 `GITHUB_TOKEN` 的 `packages:write` 权限，无需配置额外密钥。
未配置 Docker Hub 凭据时只发布 GHCR，不会推送到 Docker Hub。

```sh
docker pull ghcr.io/baekey/monitor:latest
# Compose 部署：使用新镜像重建容器，原有数据卷和配置保持不变。
docker compose pull && docker compose up -d
```

仅拉取镜像不会更新已运行的容器；需要重建容器。首次发布后请确认 GitHub Packages 中镜像可见性为 Public，才能匿名拉取。

## 特性

- 实时监控：秒级实时数据展示
- 轻量高效：Rust 语言构建，低资源占用，极简高效
- 自托管：完全掌控数据隐私，部署简单
- 通知：节点掉线、流量、到期与登录，推送到 Telegram 或自定义 Webhook

## 组成

| 仓库 | 说明 |
|---|---|
| [monitor](https://github.com/monitor-probe/monitor) | hub：后台、API、公开页宿主 |
| [agent](https://github.com/monitor-probe/agent) | Linux agent |
| [monitor-theme-default](https://github.com/monitor-probe/monitor-theme-default) | 内置默认主题 |
| [themes](https://github.com/monitor-probe/themes) | 主题站：收录第三方主题，提供在线预览 |

```
agent (Linux)  ──WebSocket / JSON-RPC 2.0──▶  hub (axum + SQLite)  ──▶  后台 + 状态页
```

## 子路径部署（hub 与管理后台）

例如将后台部署到 `https://example.com/monitor/admin/`，启动时指定完整的公开地址：

```sh
monitor-hub --listen 127.0.0.1:28080 --site https://example.com/monitor
# 使用安装器时也可传入：sudo sh install-hub.sh --site https://example.com/monitor
```

支持多层子路径，`--site` 末尾斜杠可省略；不要包含查询参数或 URL 片段。
**反向代理必须去掉 `/monitor` 前缀**，hub 内部仍使用 `/admin/`、`/api/` 等原有路由。
不设置子路径时保持原有部署方式。前端无须为不同子路径重新构建。

### Caddy

```caddyfile
example.com {
    redir /monitor /monitor/ 308
    handle_path /monitor/* {
        reverse_proxy 127.0.0.1:28080
    }
}
```

### nginx

以下放入已配置 TLS 的 `server` 中。`map` 放在 `http` 中，以同时支持普通请求和 agent / 后台 WebSocket：

```nginx
# http 中
map $http_upgrade $monitor_connection {
    default upgrade;
    ''      close;
}

# TLS server 中
location = /monitor {
    return 308 /monitor/$is_args$args;
}
location /monitor/ {
    # 尾斜杠不能省略：用 / 替换 /monitor/。
    proxy_pass http://127.0.0.1:28080/;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $monitor_connection;
    client_max_body_size 8m;
    proxy_read_timeout 300s;
}
```

后台生成的 agent 安装命令和 GitHub OAuth 回调地址都会包含子路径。
GitHub OAuth App 的 **Authorization callback URL** 应填写
`https://example.com/monitor/api/auth/github/callback`。
现有根路径 agent 连接方式不变；迁移到子路径时需要把 agent 的服务器地址同步改为带子路径的 URL。

本分支的 hub、管理后台与当前内置 HEX 均支持子路径。
第三方主题仍需自身使用兼容子路径的资源、API、WebSocket 和导航地址；
不兼容的主题需要单独适配，不能仅靠反向代理修复。

## 仅使用 SSO 登录

在后台「安全」中完整配置 GitHub Client ID、Client Secret 和允许登录的用户名，
先确认 GitHub 登录可用，再关闭「允许密码登录」并保存。
关闭后登录页仅显示 GitHub SSO 入口，密码登录 API 也会拒绝请求（不是只隐藏表单）。
默认仍允许密码登录；现有登录会话不会因为关闭入口而自动退出，可在会话列表中主动撤销。
仅 SSO 模式下不能清空必要的 GitHub 配置，须先重新启用密码登录，或在同次保存中启用。
修改应急密码不会自动启用已关闭的入口。

如果 SSO 故障，在服务器上执行以下命令恢复密码登录并生成新密码（同时登出全部会话）：

```sh
monitor-hub --db /实际路径/monitor.db --reset-password
# 安装器部署也可使用：sudo sh install-hub.sh --reset-password
```

必须使用当前 hub 的数据库路径；无需删除 SSO 配置或重启 hub。
