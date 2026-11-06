export interface AuthConfig {
  sessionSecret: string; tokenSecret: string; baseUrl: string; secure: boolean; trustProxyHops: number;
}
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  for (const key of ['SESSION_SECRET', 'AUTH_TOKEN_SECRET']) {
    if (!env[key] || Buffer.byteLength(env[key]!) < 32 || /CHANGE_ME|REPLACE_ME/.test(env[key]!))
      throw new Error(`${key} cần giá trị ngẫu nhiên riêng, tối thiểu 32 byte.`);
  }
  if (env.SESSION_SECRET === env.AUTH_TOKEN_SECRET) throw new Error('Hai secret phải có giá trị khác nhau.');
  let url: URL;
  try { url = new URL(env.APP_BASE_URL ?? ''); } catch { throw new Error('APP_BASE_URL không hợp lệ.'); }
  const secure = env.NODE_ENV === 'production';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (secure && url.protocol !== 'https:'))
    throw new Error('APP_BASE_URL phải là origin HTTP(S); production yêu cầu HTTPS.');
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) throw new Error('TRUST_PROXY_HOPS không hợp lệ.');
  return { sessionSecret: env.SESSION_SECRET!, tokenSecret: env.AUTH_TOKEN_SECRET!, baseUrl: url.origin, secure, trustProxyHops };
}
