export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 600;
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 28800;

function ttlMs(env: NodeJS.ProcessEnv, key: string, fallback: number) {
  const value = (env[key] ?? String(fallback)).trim();
  const seconds = Number(value);
  const milliseconds = seconds * 1000;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(seconds) || seconds <= 0
    || !Number.isSafeInteger(milliseconds) || !Number.isFinite(new Date(Date.now() + milliseconds).getTime()))
    throw new Error(`${key} phải là số nguyên dương tính bằng giây, trong giới hạn thời gian hợp lệ.`);
  return milliseconds;
}

export interface AuthConfig {
  accessTokenTtlMs: number; refreshTokenTtlMs: number;
  sessionSecret: string; tokenSecret: string; jwtSecret: string; baseUrl: string; secure: boolean; trustProxyHops: number;
}
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  for (const key of ['SESSION_SECRET', 'AUTH_TOKEN_SECRET', 'JWT_SECRET']) {
    if (!env[key] || Buffer.byteLength(env[key]!) < 32 || /CHANGE_ME|REPLACE_ME/.test(env[key]!))
      throw new Error(`${key} cần giá trị ngẫu nhiên riêng, tối thiểu 32 byte.`);
  }
  if (new Set([env.SESSION_SECRET, env.AUTH_TOKEN_SECRET, env.JWT_SECRET]).size !== 3) throw new Error('Ba secret phải có giá trị khác nhau.');
  let url: URL;
  try { url = new URL(env.APP_BASE_URL ?? ''); } catch { throw new Error('APP_BASE_URL không hợp lệ.'); }
  const secure = env.NODE_ENV === 'production';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (secure && url.protocol !== 'https:'))
    throw new Error('APP_BASE_URL phải là origin HTTP(S); production yêu cầu HTTPS.');
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) throw new Error('TRUST_PROXY_HOPS không hợp lệ.');
  const accessTokenTtlMs = ttlMs(env, 'ACCESS_TOKEN_TTL_SECONDS', DEFAULT_ACCESS_TOKEN_TTL_SECONDS);
  const refreshTokenTtlMs = ttlMs(env, 'REFRESH_TOKEN_TTL_SECONDS', DEFAULT_REFRESH_TOKEN_TTL_SECONDS);
  return { accessTokenTtlMs, refreshTokenTtlMs, sessionSecret: env.SESSION_SECRET!, tokenSecret: env.AUTH_TOKEN_SECRET!, jwtSecret: env.JWT_SECRET!, baseUrl: url.origin, secure, trustProxyHops };
}
