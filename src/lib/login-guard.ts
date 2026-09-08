import { getDb } from "./db";

/**
 * 登录失败限流与审计：
 * - 单 IP 15 分钟窗口内最多 8 次失败；全局 15 分钟窗口内最多 100 次。
 *   全局上限用于兜底——直连部署时 x-forwarded-for 可被伪造，轮换 XFF 即可绕过单 IP 限制。
 * - 每次失败落库 auth_login_failures（保留最近 50 条），供设置页展示最近失败记录。
 * - ponytail: 限流计数在单进程内存，Docker 单容器场景够用；多副本部署时换成共享计数（Redis/DB）。
 */

export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const RATE_MAX_FAILS = 8;
export const RATE_GLOBAL_MAX_FAILS = 100;

const failAtByIp = new Map<string, number[]>();
const globalFails: number[] = [];

/** 仅 TRUST_PROXY=true（反代部署）时采信代理头；直连公网时这些头可被伪造 */
export function clientIp(request: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const fwd = request.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "unknown";
}

/** 过滤出窗口内的失败记录（就地更新传入数组，避免 Map/全局列表无限增长） */
function activeFails(list: number[], now: number): number[] {
  const alive = list.filter((t) => now - t < RATE_WINDOW_MS);
  list.length = 0;
  list.push(...alive);
  return alive;
}

export function isLoginLocked(ip: string): boolean {
  const now = Date.now();
  // 不可信来源统一归入 "unknown"，无法区分个体，跳过单 IP 桶（否则全体共享 8 次会被打穿）
  if (ip !== "unknown") {
    const fails = activeFails(failAtByIp.get(ip) || [], now);
    if (fails.length > 0) failAtByIp.set(ip, fails);
    else failAtByIp.delete(ip);
    if (fails.length >= RATE_MAX_FAILS) return true;
  }
  activeFails(globalFails, now);
  return globalFails.length >= RATE_GLOBAL_MAX_FAILS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const fails = failAtByIp.get(ip) || [];
  fails.push(now);
  failAtByIp.set(ip, fails);
  globalFails.push(now);

  // 审计落库（保留最近 50 条，插入时顺带裁剪）
  try {
    const db = getDb();
    db.prepare("INSERT INTO auth_login_failures (ip) VALUES (?)").run(ip);
    db.prepare(
      "DELETE FROM auth_login_failures WHERE id NOT IN (SELECT id FROM auth_login_failures ORDER BY id DESC LIMIT 50)",
    ).run();
  } catch {
    // 审计写库失败不影响限流主流程
  }
}

export function resetLoginFailures(ip: string): void {
  failAtByIp.delete(ip);
}

export interface LoginFailure {
  ip: string;
  at: string;
}

/** 最近登录失败记录（新→旧），供设置页安全面板展示 */
export function listRecentLoginFailures(limit = 10): LoginFailure[] {
  const rows = getDb()
    .prepare("SELECT ip, created_at FROM auth_login_failures ORDER BY id DESC LIMIT ?")
    .all(limit) as { ip: string; created_at: string }[];
  return rows.map((r) => ({ ip: r.ip, at: r.created_at }));
}
