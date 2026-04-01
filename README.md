# Cloudflare 多站点定时签到 Worker

这个 Worker 支持多个签到目标，并会在定时触发时全部执行。

当前已包含 34 个签到目标，配置在 `src/targets.json` 中。

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

设置各站点 secret：

```bash
# 值 = 从浏览器 DevTools 复制的完整 Cookie 字符串
# 例如："session=xxx" 或 "session=xxx; cf_clearance=yyy"
npx wrangler secret put COOKIE_DKJSIOGU
npx wrangler secret put COOKIE_DUCKCODING
npx wrangler secret put COOKIE_LINUXDOAPI
npx wrangler secret put COOKIE_HOTARUAPI
npx wrangler secret put COOKIE_ZHANSI
npx wrangler secret put COOKIE_ZZHDSGSSS
npx wrangler secret put COOKIE_STEPHECURRY
npx wrangler secret put COOKIE_CHENGMO
npx wrangler secret put COOKIE_NIH
npx wrangler secret put COOKIE_HUAN666
npx wrangler secret put COOKIE_AIAPI3W
npx wrangler secret put COOKIE_API925214
npx wrangler secret put COOKIE_IDONTKNOWAPI
npx wrangler secret put COOKIE_ZENSCALEAI
npx wrangler secret put COOKIE_42API
npx wrangler secret put COOKIE_COULSON
npx wrangler secret put COOKIE_APIKEY_WELFARE
npx wrangler secret put COOKIE_DEV88
npx wrangler secret put COOKIE_THATAPI
npx wrangler secret put COOKIE_ELYSIVER
npx wrangler secret put COOKIE_AIDROUTER
npx wrangler secret put COOKIE_DAIJU
npx wrangler secret put COOKIE_MOAPI
npx wrangler secret put COOKIE_LINUXDOEDURS
npx wrangler secret put COOKIE_OPENAI_API_TEST_US_CI
npx wrangler secret put COOKIE_LAOXI
npx wrangler secret put COOKIE_YYBBWAN
npx wrangler secret put COOKIE_SUIMI
npx wrangler secret put COOKIE_DGBMC
npx wrangler secret put COOKIE_MARYDOWN
npx wrangler secret put COOKIE_DUDU
npx wrangler secret put COOKIE_ZHENHAOJI
npx wrangler secret put COOKIE_ARKAPI
npx wrangler secret put COOKIE_JOVERNA
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

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
- 若签到失败，优先更新对应的 `COOKIE_*` secret。
- 若某站点是按北京时间 00:00 刷新，建议把 `cron` 调整到 UTC 对应时刻附近并保留冗余重试频率。
