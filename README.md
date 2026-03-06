# Cloudflare 多站点定时签到 Worker

这个 Worker 支持多个签到目标，并会在定时触发时全部执行。

当前示例已包含：

- `dkjsiogu`: `POST https://api.dkjsiogu.me/api/user/claim_quota`
- `duckcoding`: `POST https://free.duckcoding.com/api/user/checkin`
- `linuxdoapi`: `POST https://linuxdoapi.223384.xyz/api/user/checkin`
- `hotaruapi`: `POST https://hotaruapi.com/api/user/checkin`
- `zhansi`: `POST https://ai.zhansi.top/api/user/checkin`

## 1. 准备

在本目录执行：

```bash
npm install
```

## 2. 配置变量

编辑 `wrangler.json`：

- `CHECKIN_TARGETS` 中每个目标都要包含：
  - `name`
  - `url`
  - `origin`
  - `referer`
  - `newApiUser`
  - `sessionSecret`
- `crons` 为 UTC 时区表达式

设置各站点 secret（不要写进代码）：

```bash
npx wrangler secret put SESSION_COOKIE_DKJSIOGU
npx wrangler secret put SESSION_COOKIE_DUCKCODING
npx wrangler secret put SESSION_COOKIE_LINUXDOAPI
npx wrangler secret put SESSION_COOKIE_HOTARUAPI
npx wrangler secret put EXTRA_COOKIE_HOTARUAPI
npx wrangler secret put SESSION_COOKIE_ZHANSI
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

输入时只粘贴 `session` 的值本体（不要带 `session=`）。
`EXTRA_COOKIE_HOTARUAPI` 填除 `session` 外的 Cookie 字符串，例如：`cf_clearance=xxxx`。
如果后续该站还要求其他 Cookie，可按 `k1=v1; k2=v2` 一起填到 `EXTRA_COOKIE_HOTARUAPI`。
`TELEGRAM_CHAT_ID` 示例：`-1002222744081`。

## 3. 部署

```bash
npx wrangler login
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
curl -X POST "https://<你的worker域名>/run/duckcoding"
curl -X POST "https://<你的worker域名>/run/linuxdoapi"
curl -X POST "https://<你的worker域名>/run/hotaruapi"
curl -X POST "https://<你的worker域名>/run/zhansi"
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

## 6. Telegram 通知

- 定时任务每次执行后，会自动发送签到汇总到 Telegram 频道。
- 消息包含每个站点状态：`已经签到过` / `签到成功` / `签到失败`。
- 若未配置 `TELEGRAM_BOT_TOKEN` 或 `TELEGRAM_CHAT_ID`，Worker 会跳过发送并在日志中提示。
- `GET /health` 会返回 `telegramConfigured` 字段，用于快速确认 TG 变量是否存在。

## 5. 注意事项

- 你抓包得到的 `session` 视为已暴露，建议先让旧会话失效并换新值。
- `hotaruapi` 的 `cf_clearance` 可能会过期；若签到失败，优先更新 `EXTRA_COOKIE_HOTARUAPI`。
- 若某站点是按北京时间 00:00 刷新，建议把 `cron` 调整到 UTC 对应时刻附近并保留冗余重试频率（比如每小时一次）。
