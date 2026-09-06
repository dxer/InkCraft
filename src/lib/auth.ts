const COOKIE_NAME = "inkcraft_session";

export function getAccessPassword(): string | null {
  return process.env.ACCESS_PASSWORD?.trim() || null;
}

export function isAuthRequired(): boolean {
  return getAccessPassword() !== null;
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

export function verifySessionToken(token: string | undefined): boolean {
  const password = getAccessPassword();
  if (!password) return true;
  if (!token) return false;
  return token === generateSessionToken(password);
}

export { COOKIE_NAME };
