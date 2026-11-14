# monitor

文档：[monitor-document.pages.dev](https://monitor-document.pages.dev)，安装、配置、反向代理与主题开发都在这里。

主题站：[monitor-themes.pages.dev](https://monitor-themes.pages.dev)，在线预览各个公开页主题，复制地址即可在面板安装。

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

本次仅适配 hub 和内置管理后台，**未修改内置或第三方公开页主题**。
公开页能否在子路径下完整运行仍取决于主题自身是否使用兼容子路径的资源、API、WebSocket 和导航地址；
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
