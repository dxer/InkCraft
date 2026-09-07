const COOKIE_NAME = "inkcraft_session";
const PW_SETTING_KEY = "auth.access_password";
// 静态 import：settings 顶层无 db 副作用（getDb 惰性），用于读取/写入库内访问口令
import { getSettings, setSetting } from "./settings";

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
 * 会话校验：未配置口令时不产生有效会话（登录页/系统会用「配置模式」引导建口令）。
 * 注意：历史语义「无口令则所有请求视为已认证」已移除——未配置口令时同样要求登录态。
 */
export function verifySessionToken(token: string | undefined): boolean {
 const password = getAccessPassword();
 if (!password || !token) return false;
 return token === generateSessionToken(password);
}

export function generateSessionToken(password: string): string {
 // 简易稳定 Token 生成（兼容 Node.js 与 Next.js Middleware）
 let hash = 0;
 const str = `inkcraft_${password}_session_salt_2026`;
 for (let i = 0; i < str.length; i++) {
  hash = (hash << 5) - hash + str.charCodeAt(i);
  hash |= 0;
 }
 return `ink_${Math.abs(hash).toString(36)}`;
}

export { COOKIE_NAME };
