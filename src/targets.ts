import type { TargetConfig, ResolvedTarget, Env } from "./types";
import defaultTargets from "./targets.json";

const DEFAULT_CHECKIN_PATH = "/api/user/checkin";

export function resolveTarget(config: TargetConfig): ResolvedTarget {
  const base = config.url.replace(/\/+$/, "");
  const path = config.checkinPath || DEFAULT_CHECKIN_PATH;
  return {
    name: config.name,
    fullUrl: `${base}${path}`,
    origin: base,
    referer: `${base}/console/personal`,
    newApiUser: config.newApiUser,
    cookieSecret: config.cookieSecret,
  };
}

export function parseTargets(env: Env): ResolvedTarget[] {
  if (env.CHECKIN_TARGETS && String(env.CHECKIN_TARGETS).trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(env.CHECKIN_TARGETS);
    } catch (error) {
      throw new Error(`CHECKIN_TARGETS is not valid JSON: ${error}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("CHECKIN_TARGETS must be a non-empty JSON array");
    }
    return (parsed as TargetConfig[])
    .filter((t) => t.enable !== false)
    .map(resolveTarget);
  }

  if (Array.isArray(defaultTargets) && defaultTargets.length > 0) {
    return (defaultTargets as TargetConfig[])
      .filter((t) => t.enable !== false)
      .map(resolveTarget);
  }

  throw new Error("No targets configured: set CHECKIN_TARGETS or provide src/targets.json");
}

export function pickTargets(allTargets: ResolvedTarget[], targetName?: string): ResolvedTarget[] {
  if (!targetName) return allTargets;
  return allTargets.filter((t) => t.name === targetName);
}
