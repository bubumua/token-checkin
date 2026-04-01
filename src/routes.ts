import type { Env } from "./types";
import { parseTargets } from "./targets";
import { runCheckins } from "./checkin";
import { buildTelegramReport, sendTelegramReport } from "./telegram";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: JSON_HEADERS });
}

function shouldNotify(url: URL): boolean {
  const v = url.searchParams.get("notify");
  if (!v) return false;
  return ["1", "true", "yes"].includes(v.toLowerCase());
}

async function handleHealth(env: Env): Promise<Response> {
  try {
    const targets = parseTargets(env).map((t) => t.name);
    return jsonResponse({
      ok: true,
      service: "multi-checkin-worker",
      targets,
      telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

async function handleRun(env: Env, url: URL, targetName?: string): Promise<Response> {
  try {
    const result = await runCheckins(env, targetName);
    const responseBody: Record<string, unknown> = { ...result };

    if (shouldNotify(url)) {
      try {
        const msg = buildTelegramReport(result, "[CF Checkin] 手动触发结果");
        const tgResult = await sendTelegramReport(env, msg);
        responseBody.telegram = { ok: true, ...tgResult };
      } catch (error) {
        responseBody.telegram = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    return jsonResponse(responseBody, result.ok ? 200 : 502);
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

async function handleNotifyTest(env: Env): Promise<Response> {
  try {
    const msg = [
      "[CF Checkin] Telegram 测试消息",
      `时间(UTC): ${new Date().toISOString()}`,
      "如果你能看到这条消息，说明 Bot Token 与 Chat ID 配置生效。",
    ].join("\n");
    const tgResult = await sendTelegramReport(env, msg);
    return jsonResponse({ ok: true, telegram: tgResult });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/health") return handleHealth(env);

  if (pathname === "/run" && request.method === "POST") return handleRun(env, url);

  if (pathname.startsWith("/run/") && request.method === "POST") {
    const targetName = decodeURIComponent(pathname.slice("/run/".length));
    return handleRun(env, url, targetName);
  }

  if (pathname === "/notify-test" && request.method === "POST") return handleNotifyTest(env);

  return new Response("Not Found", { status: 404 });
}
