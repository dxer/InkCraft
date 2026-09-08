import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSettings, setSetting } from "./settings";

const COOKIE_NAME = "inkcraft_session";
const PW_SETTING_KEY = "auth.access_password";
// 会话签名密钥与口令一样存 DB；仓库公开，密钥绝不能硬编码在源码里
const SESSION_SECRET_KEY = "auth.session_secret";

/**
 * 访问口令解析：环境变量 ACCESS_PASSWORD 优先（docker-compose 老用户不受影响），
 * 否则读取数据库首次设置的访问口令。
 */
export function getAccessPassword(): string | null {
  const fromEnv = process.env.ACCESS_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  const pw = getSettings()[PW_SETTING_KEY] || "";
  return pw.trim() || null;
}

/** 首次设置访问口令（仅 env 未配置时可用），写入 DB 持久化 */
export function setAccessPassword(password: string): void {
  setSetting(PW_SETTING_KEY, password);
}

/** 是否已配置访问口令（env 或 DB） */
export function isAuthConfigured(): boolean {
  return getAccessPassword() !== null;
}

export function isAuthRequired(): boolean {
  return true;
}

/**
 * 会话签名密钥：首次使用时生成 32 字节随机值落库，之后稳定复用。
 * better-sqlite3 读写全同步，进程内「查→无则生成→写」不会出现并发竞争。
 */
function getSessionSecret(): string {
  const existing = getSettings()[SESSION_SECRET_KEY];
  if (existing) return existing;
  const secret = randomBytes(32).toString("hex");
  setSetting(SESSION_SECRET_KEY, secret);
  return secret;
}

/** 会话最大年龄：与登录 Cookie maxAge 保持一致，超龄强制重登 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * 会话 Token：ink_<签发秒级时间戳>.<HMAC-SHA256(服务端私有密钥, 口令.时间戳)>。
 * 不用自研弱哈希——盐公开且输出仅 32 位时，攻击者可离线枚举弱口令伪造 Cookie，
 * 完全绕过登录限流；HMAC 密钥不出服务端，离线枚举不可行。
 * 时间戳参与签名并受最大年龄约束：token 即使泄漏也无法永久重放。
 * 口令变更后派生值随之变化，旧会话全部自动失效。
 */
export function generateSessionToken(password: string, issuedAtMs = Date.now()): string {
  const iat = Math.floor(issuedAtMs / 1000);
  const sig = createHmac("sha256", getSessionSecret())
    .update(`${password}.${iat}`)
    .digest("hex");
  return `ink_${iat}.${sig}`;
}

/**
 * 会话校验：未配置口令时不产生有效会话（登录页/系统会用「配置模式」引导建口令）。
 * 注意：历史语义「无口令则所有请求视为已认证」已移除——未配置口令时同样要求登录态。
 */
export function verifySessionToken(token: string | undefined): boolean {
  const password = getAccessPassword();
  if (!password || !token) return false;
  const m = /^ink_(\d+)\.([0-9a-f]{64})$/.exec(token);
  if (!m) return false;
  const iat = Number(m[1]);
  const now = Math.floor(Date.now() / 1000);
  // 超过最大年龄强制重登；签发时间来自未来超过 1 分钟视为伪造（容忍少量时钟偏差）
  if (now - iat > SESSION_MAX_AGE_SECONDS || iat - now > 60) return false;
  const expected = Buffer.from(generateSessionToken(password, iat * 1000));
  // timingSafeEqual 要求等长；格式校验已保证长度一致
  return timingSafeEqual(Buffer.from(token), expected);
}

/**
 * Cookie Secure 标记：直连 HTTPS（request.url 为 https）时为 true；纯 HTTP 部署为
 * false（否则浏览器拒收 Cookie，登录成功也会无限跳回登录页）。
 * 反代场景须设 TRUST_PROXY=true 才采信 X-Forwarded-Proto——直连部署时代理头可被
 * 请求方伪造，盲目采信会误加 Secure 导致 HTTP 下无法登录。可用 COOKIE_SECURE=true/false
 * 强制覆盖。
 */
export function isSecureRequest(request: Request): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  if (process.env.TRUST_PROXY === "true") {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto) return proto === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
