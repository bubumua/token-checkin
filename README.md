# Cloudflare 多站点定时签到 Worker

这个 Worker 支持多个签到目标，并会在定时触发时全部执行。

当前签到目标配置在 `src/targets.json` 中。

## 1. 准备

在本目录执行：

```bash
npm install
```

## 2. 配置变量

编辑 `src/targets.json`，每个目标只需 4 个字段：

```json
{
  "name": "站点标识",
  "url": "https://example.com",
  "newApiUser": "12345",
  "cookieSecret": "COOKIE_EXAMPLE"
}
```

- `url`：站点基础 URL（不含路径）
- `newApiUser`：从浏览器请求中获取的 `New-API-User` 值
- `cookieSecret`：Wrangler secret 名称
- 签到路径默认为 `/api/user/checkin`，如需覆盖可加 `"checkinPath": "/api/user/claim_quota"`

在 `.dev.vars` 中维护对应 secret：

```bash
# 值 = 从浏览器 DevTools 复制的完整 Cookie 字符串
# 例如："session=xxx" 或 "session=xxx; cf_clearance=yyy"
COOKIE_DKJSIOGU=session=xxx
COOKIE_DUCKCODING=session=xxx
TELEGRAM_BOT_TOKEN=123456:abc
TELEGRAM_CHAT_ID=-1002222744081
```

然后批量同步到 Cloudflare：

```bash
npm run sync-secrets
```

脚本会：

- 从 `.dev.vars` 读取值
- 从 `src/targets.json` 收集需要的 `cookieSecret`
- 检查 `wrangler` 登录状态，必要时执行 `npx wrangler login`
- 同步 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`

如需先检查将同步哪些 secret，可执行：

```bash
pwsh -NoProfile -File scripts/sync-secrets.ps1 -DryRun
```

如果你仍想手动逐个设置，也可以继续使用 `src/targets.json` 里的 `cookieSecret` 名称：

```bash
# 例如：
npx wrangler secret put COOKIE_DKJSIOGU
npx wrangler secret put COOKIE_DUCKCODING
npx wrangler secret put COOKIE_DUCKCODING_LATEST
npx wrangler secret put COOKIE_ZHANSI
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

`TELEGRAM_CHAT_ID` 示例：`-1002222744081`。

## 3. 部署

```bash
npm run sync-secrets
npm run deploy
```

## 4. 验证

手动触发全部目标：

```bash
curl -X POST "https://<你的worker域名>/run"
```

手动触发单个目标：

```bash
curl -X POST "https://<你的worker域名>/run/dkjsiogu"
```

手动触发并同步发送 Telegram 汇总（用于排查通知链路）：

```bash
curl -X POST "https://<你的worker域名>/run?notify=1"
```

仅测试 Telegram 发送（不执行签到）：

```bash
curl -X POST "https://<你的worker域名>/notify-test"
```

健康检查：

```bash
curl "https://<你的worker域名>/health"
```

查看日志：

```bash
npm run tail
```

## 5. Telegram 通知

- 定时任务每次执行后，会自动发送签到汇总到 Telegram 频道。
- 消息包含每个站点状态：`已经签到过` / `签到成功` / `签到失败`。
- 若未配置 `TELEGRAM_BOT_TOKEN` 或 `TELEGRAM_CHAT_ID`，Worker 会跳过发送并在日志中提示。
- `GET /health` 会返回 `telegramConfigured` 字段，用于快速确认 TG 变量是否存在。

## 6. 注意事项

- Cookie secret 值直接从浏览器 DevTools 的 `Cookie:` 请求头复制即可。
- 如某站点需要 `cf_clearance`，把它和 `session` 一起写入同一个 secret，用 `;` 分隔。
- 更新 Cookie 后，优先修改 `.dev.vars`，再执行 `npm run sync-secrets`。
- 若某站点是按北京时间 00:00 刷新，建议把 `cron` 调整到 UTC 对应时刻附近并保留冗余重试频率。
