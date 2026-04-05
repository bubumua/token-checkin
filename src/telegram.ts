import type { RunResult, CheckinResult, TelegramResult, Env } from "./types";

function stringifyBody(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function pickFailureReason(item: CheckinResult): string {
  if (item.error) return String(item.error);
  if (!item.body) return "";
  if (typeof item.body === "string") return item.body;

  const obj = item.body as Record<string, unknown>;
  const fields = ["message", "msg", "error", "detail", "reason"];
  for (const field of fields) {
    if (typeof obj[field] === "string" && (obj[field] as string).trim()) {
      return obj[field] as string;
    }
  }
  return stringifyBody(item.body);
}

function truncateText(text: string, maxLength = 180): string {
  if (!text) return "";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function buildTelegramReport(result: RunResult, title = "[CF Checkin] 定时签到结果"): string {
  const lines = [
    title,
    `时间(UTC): ${new Date().toISOString()}`,
    `总计 ${result.total} | 成功 ${result.success} | 已签失败 ${result.already} | 未配Cookie失败 ${result.missingCookieFailed} | 其他失败 ${result.otherFailed}`,
  ];

  const successItems = result.results.filter((r) => r.state === "success");
  const alreadyItems = result.results.filter((r) => r.state === "already");
  const missingCookieItems = result.results.filter((r) => r.failureCategory === "missing_cookie");
  const otherFailedItems = result.results.filter((r) => r.state === "failed" && r.failureCategory !== "missing_cookie");

  if (successItems.length > 0) {
    lines.push("", `✅ 签到成功 (${successItems.length})`);
    for (const item of successItems) {
      lines.push(`  ${item.target}`);
    }
  }

  if (alreadyItems.length > 0) {
    lines.push("", `⏭ 已经签到因此失败 (${alreadyItems.length})`);
    for (const item of alreadyItems) {
      lines.push(`  ${item.target}`);
    }
  }

  if (missingCookieItems.length > 0) {
    lines.push("", `🔒 未配置Cookie失败 (${missingCookieItems.length})`);
    for (const item of missingCookieItems) {
      const reason = truncateText(pickFailureReason(item));
      lines.push(reason ? `  ${item.target}: ${reason}` : `  ${item.target}`);
    }
  }

  if (otherFailedItems.length > 0) {
    lines.push("", `❌ 其他原因失败 (${otherFailedItems.length})`);
    for (const item of otherFailedItems) {
      const reason = truncateText(pickFailureReason(item));
      lines.push(reason ? `  ${item.target}: ${reason}` : `  ${item.target}`);
    }
  }

  return lines.join("\n");
}

export async function sendTelegramReport(env: Env, messageText: string): Promise<TelegramResult> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { sent: false, reason: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      chat_id: chatId,
      text: messageText,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Telegram sendMessage failed with ${response.status}: ${errorBody}`);
  }

  return { sent: true };
}
