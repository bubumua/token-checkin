export interface TargetConfig {
  name: string;
  url: string;
  newApiUser: string;
  cookieSecret: string;
  checkinPath?: string;
  enable?: boolean;
}

export interface ResolvedTarget {
  name: string;
  fullUrl: string;
  origin: string;
  referer: string;
  newApiUser: string;
  cookieSecret: string;
}

export interface Env {
  CHECKIN_TARGETS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  [key: string]: string | undefined;
}

export interface CheckinResult {
  target: string;
  ok: boolean;
  state: "already" | "success" | "failed";
  failureCategory?: "missing_cookie" | "other";
  status: number;
  requestedAt: string;
  body?: unknown;
  error?: string;
}

export interface RunResult {
  ok: boolean;
  total: number;
  success: number;
  already: number;
  failed: number;
  missingCookieFailed: number;
  otherFailed: number;
  results: CheckinResult[];
}

export interface TelegramResult {
  sent: boolean;
  reason?: string;
}
