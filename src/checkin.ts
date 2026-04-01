import type { Env, ResolvedTarget, CheckinResult, RunResult } from "./types";
import { parseTargets, pickTargets } from "./targets";

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

function stringifyBody(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function classifyCheckinState(responseOk: boolean, body: unknown): "already" | "success" | "failed" {
  if (!responseOk) return "failed";

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (obj.ok === false || obj.success === false) return "failed";
  }

  const bodyText = stringifyBody(body);

  if (ALREADY_PATTERNS.some((p) => p.test(bodyText))) return "already";
  if (SUCCESS_PATTERNS.some((p) => p.test(bodyText))) return "success";
  if (FAILURE_PATTERNS.some((p) => p.test(bodyText))) return "failed";

  return "success";
}

function getCookie(env: Env, target: ResolvedTarget): string {
  const value = env[target.cookieSecret];
  if (!value || !String(value).trim()) {
    throw new Error(`[${target.name}] Missing secret ${target.cookieSecret}`);
  }
  return String(value).trim();
}

async function runSingleCheckin(env: Env, target: ResolvedTarget): Promise<CheckinResult> {
  if (!target.name) throw new Error("Each target must provide name");
  if (!target.fullUrl) throw new Error(`[${target.name}] Missing url`);
  if (!target.newApiUser) throw new Error(`[${target.name}] Missing newApiUser`);

  const cookie = getCookie(env, target);

  const response = await fetch(target.fullUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "New-API-User": target.newApiUser,
      "Cache-Control": "no-store",
      "Origin": target.origin,
      "Referer": target.referer,
      "Cookie": cookie,
      "User-Agent": "Mozilla/5.0 (compatible; Cloudflare-Worker-Checkin/1.0)",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  let body: unknown;
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

export async function runCheckins(env: Env, targetName?: string): Promise<RunResult> {
  const allTargets = parseTargets(env);
  const targets = pickTargets(allTargets, targetName);

  if (targets.length === 0) {
    throw new Error(`Target not found: ${targetName}`);
  }

  const results = await Promise.all(
    targets.map(async (target): Promise<CheckinResult> => {
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

  const success = results.filter((r) => r.state === "success").length;
  const already = results.filter((r) => r.state === "already").length;
  const failed = results.filter((r) => r.state === "failed").length;
  return { ok: failed === 0, total: results.length, success, already, failed, results };
}
