const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

const ALREADY_PATTERNS = [
  /already/i,
  /已(?:经)?签到/,
  /重复签到/,
  /today.*checked/i,
  /check(?:-| )?in.*already/i,
];

const SUCCESS_PATTERNS = [
  /签到成功/,
  /check(?:-| )?in.*success/i,
  /success/i,
  /claim(?:ed)?/i,
];

const FAILURE_PATTERNS = [
  /\bfailed?\b/i,
  /\berror\b/i,
  /unauthorized/i,
  /invalid/i,
  /expired/i,
  /未登录/,
  /失效/,
  /过期/,
  /失败/,
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function stringifyBody(body) {
  if (body === null || body === undefined) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  try {
    return JSON.stringify(body);
  } catch (_) {
    return String(body);
  }
}

function classifyCheckinState(responseOk, body) {
  if (!responseOk) {
    return "failed";
  }

  if (body && typeof body === "object") {
    if (body.ok === false || body.success === false) {
      return "failed";
    }
  }

  const bodyText = stringifyBody(body);

  if (ALREADY_PATTERNS.some((pattern) => pattern.test(bodyText))) {
    return "already";
  }
  if (SUCCESS_PATTERNS.some((pattern) => pattern.test(bodyText))) {
    return "success";
  }
  if (FAILURE_PATTERNS.some((pattern) => pattern.test(bodyText))) {
    return "failed";
  }

  return "success";
}

function getStateLabel(state) {
  if (state === "already") {
    return "已经签到过";
  }
  if (state === "success") {
    return "签到成功";
  }
  return "签到失败";
}

function getExtraCookieFromSecret(env, target) {
  if (!target.extraCookieSecret) {
    return "";
  }
  const cookieValue = env[target.extraCookieSecret];
  if (!cookieValue || !String(cookieValue).trim()) {
    throw new Error(
      `[${target.name}] Missing secret ${target.extraCookieSecret} for extra cookies`,
    );
  }
  return String(cookieValue).trim();
}

function buildCookieHeader(env, target, sessionValue) {
  const parts = [];
  if (target.cookiePrefix && String(target.cookiePrefix).trim()) {
    parts.push(String(target.cookiePrefix).trim());
  }
  const extraCookie = getExtraCookieFromSecret(env, target);
  if (extraCookie) {
    parts.push(extraCookie);
  }
  parts.push(`session=${sessionValue}`);
  return parts.join("; ");
}

function pickFailureReason(item) {
  if (item.error) {
    return String(item.error);
  }
  if (!item.body) {
    return "";
  }
  if (typeof item.body === "string") {
    return item.body;
  }
  const fields = ["message", "msg", "error", "detail", "reason"];
  for (const field of fields) {
    if (typeof item.body[field] === "string" && item.body[field].trim()) {
      return item.body[field];
    }
  }
  return stringifyBody(item.body);
}

function truncateText(text, maxLength = 180) {
  if (!text) {
    return "";
  }
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildTelegramReport(result, title = "[CF Checkin] 定时签到结果") {
  const lines = [
    title,
    `时间(UTC): ${new Date().toISOString()}`,
    `总计 ${result.total} | 成功 ${result.success} | 失败 ${result.failed}`,
    "",
  ];

  for (const item of result.results) {
    const label = getStateLabel(item.state);
    if (item.state === "failed") {
      const reason = truncateText(pickFailureReason(item));
      lines.push(
        reason
          ? `- ${item.target}: ${label} (${reason})`
          : `- ${item.target}: ${label}`,
      );
      continue;
    }
    lines.push(`- ${item.target}: ${label}`);
  }

  return lines.join("\n");
}

function isTruthyValue(value) {
  if (!value) {
    return false;
  }
  const normalized = String(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function shouldNotifyFromRequest(url) {
  return isTruthyValue(url.searchParams.get("notify"));
}

async function sendTelegramReport(env, messageText) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return {
      sent: false,
      reason: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Telegram sendMessage failed with ${response.status}: ${errorBody}`,
    );
  }

  return { sent: true };
}

function isPlaceholder(value) {
  if (!value) {
    return true;
  }
  return String(value).toUpperCase().includes("REPLACE");
}

function parseTargets(env) {
  if (env.CHECKIN_TARGETS && String(env.CHECKIN_TARGETS).trim()) {
    let parsed;
    try {
      parsed = JSON.parse(env.CHECKIN_TARGETS);
    } catch (error) {
      throw new Error(`CHECKIN_TARGETS is not valid JSON: ${error}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("CHECKIN_TARGETS must be a non-empty JSON array");
    }
    return parsed;
  }

  // Backward-compatible fallback for legacy single-target config.
  return [
    {
      name: "default",
      url: env.CHECKIN_URL || "https://api.dkjsiogu.me/api/user/claim_quota",
      origin: env.ORIGIN || "https://api.dkjsiogu.me",
      referer: env.REFERER || "https://api.dkjsiogu.me/console/personal",
      newApiUser: env.NEW_API_USER,
      sessionSecret: "SESSION_COOKIE",
    },
  ];
}

function pickTargets(allTargets, targetName) {
  if (!targetName) {
    return allTargets;
  }
  return allTargets.filter((item) => item.name === targetName);
}

function getSessionCookie(env, target) {
  if (!target.sessionSecret) {
    throw new Error(`[${target.name}] Missing sessionSecret in target config`);
  }
  const sessionValue = env[target.sessionSecret];
  if (!sessionValue) {
    throw new Error(`[${target.name}] Missing secret ${target.sessionSecret}`);
  }
  return sessionValue;
}

async function runSingleCheckin(env, target) {
  if (!target.name) {
    throw new Error("Each target must provide name");
  }
  if (!target.url) {
    throw new Error(`[${target.name}] Missing url`);
  }
  if (!target.origin) {
    throw new Error(`[${target.name}] Missing origin`);
  }
  if (!target.referer) {
    throw new Error(`[${target.name}] Missing referer`);
  }
  if (isPlaceholder(target.newApiUser)) {
    throw new Error(`[${target.name}] Missing valid newApiUser`);
  }

  const sessionCookie = getSessionCookie(env, target);

  const headers = new Headers({
    Accept: "application/json, text/plain, */*",
    "New-API-User": String(target.newApiUser),
    "Cache-Control": "no-store",
    Origin: target.origin,
    Referer: target.referer,
    Cookie: buildCookieHeader(env, target, sessionCookie),
    "User-Agent": "Mozilla/5.0 (compatible; Cloudflare-Worker-Checkin/1.0)",
  });

  const response = await fetch(target.url, {
    method: "POST",
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  const state = classifyCheckinState(response.ok, body);

  return {
    target: target.name,
    ok: state !== "failed",
    state,
    status: response.status,
    requestedAt: new Date().toISOString(),
    body,
  };
}

async function runCheckins(env, targetName) {
  const allTargets = parseTargets(env);
  const targets = pickTargets(allTargets, targetName);

  if (targets.length === 0) {
    throw new Error(`Target not found: ${targetName}`);
  }

  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        return await runSingleCheckin(env, target);
      } catch (error) {
        return {
          target: target.name || "unknown",
          ok: false,
          state: "failed",
          status: 0,
          requestedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const success = results.filter((item) => item.ok).length;
  const failed = results.length - success;
  return {
    ok: failed === 0,
    total: results.length,
    success,
    failed,
    results,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/health") {
      try {
        const targets = parseTargets(env).map((item) => item.name);
        return jsonResponse({
          ok: true,
          service: "multi-checkin-worker",
          targets,
          telegramConfigured: Boolean(
            env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID,
          ),
        });
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
      }
    }

    if (pathname === "/run" && request.method === "POST") {
      try {
        const result = await runCheckins(env);
        const responseBody = { ...result };

        if (shouldNotifyFromRequest(url)) {
          try {
            const telegramMessage = buildTelegramReport(
              result,
              "[CF Checkin] 手动触发结果",
            );
            const telegramResult = await sendTelegramReport(env, telegramMessage);
            responseBody.telegram = {
              ok: true,
              ...telegramResult,
            };
          } catch (error) {
            responseBody.telegram = {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }

        return jsonResponse(responseBody, result.ok ? 200 : 502);
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
      }
    }

    if (pathname.startsWith("/run/") && request.method === "POST") {
      const targetName = decodeURIComponent(pathname.replace("/run/", ""));
      try {
        const result = await runCheckins(env, targetName);
        const responseBody = { ...result };

        if (shouldNotifyFromRequest(url)) {
          try {
            const telegramMessage = buildTelegramReport(
              result,
              "[CF Checkin] 手动触发结果",
            );
            const telegramResult = await sendTelegramReport(env, telegramMessage);
            responseBody.telegram = {
              ok: true,
              ...telegramResult,
            };
          } catch (error) {
            responseBody.telegram = {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }

        return jsonResponse(responseBody, result.ok ? 200 : 502);
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
      }
    }

    if (pathname === "/notify-test" && request.method === "POST") {
      try {
        const sampleMessage = [
          "[CF Checkin] Telegram 测试消息",
          `时间(UTC): ${new Date().toISOString()}`,
          "如果你能看到这条消息，说明 Bot Token 与 Chat ID 配置生效。",
        ].join("\n");
        const telegramResult = await sendTelegramReport(env, sampleMessage);
        return jsonResponse({
          ok: true,
          telegram: telegramResult,
        });
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          const result = await runCheckins(env);
          console.log("Scheduled checkin result:", JSON.stringify(result));

          try {
            const telegramMessage = buildTelegramReport(result);
            const telegramResult = await sendTelegramReport(env, telegramMessage);
            if (telegramResult.sent) {
              console.log("Scheduled checkin telegram report sent");
            } else {
              console.warn(
                "Scheduled checkin telegram report skipped:",
                telegramResult.reason,
              );
            }
          } catch (error) {
            console.error("Scheduled telegram report failed:", error);
          }
        } catch (error) {
          console.error("Scheduled checkin failed:", error);
        }
      })(),
    );
  },
};
