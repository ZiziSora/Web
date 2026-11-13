import { randomBytes } from 'node:crypto';
import type { Request, Response, RequestHandler } from 'express';
import { digest, type AuthRepository, type User, type AuthSession } from './auth-store.js';
import type { AuthConfig } from './auth-config.js';
import { accessTokens } from './tokens.js';

export const opaque = () => randomBytes(32).toString('hex');
export const publicUser = (user: User) => ({ id: user.id, email: user.email, role: user.role });
export function authError(res: Response, status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ ok: false, error: { code, message, ...extra } });
}
export function tokenSessions(repository: AuthRepository, config: AuthConfig, now: () => number) {
  const jwt = accessTokens(config.jwtSecret, now, config.accessTokenTtlMs);
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.secure, path: '/api/auth' };
  const refreshCookie = (req: Request) => {
    const value = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('block9.refresh='))?.slice('block9.refresh='.length) ?? '';
    return /^[a-f0-9]{64}$/.test(value) ? value : '';
  };
  const active = (identity: { user: User; session: AuthSession } | null) => identity && identity.user.status === 'active'
    && !identity.session.revokedAt && identity.session.expiresAt.getTime() > now();
  async function create(tx: AuthRepository, user: User) {
    const session: AuthSession = { id: opaque(), userId: user.id, sessionVersion: 0, createdAt: new Date(now()), expiresAt: new Date(now() + config.refreshTokenTtlMs), revokedAt: null };
    const refreshToken = opaque();
    await tx.write('authSession', session);
    await tx.write('refreshToken', { id: digest(refreshToken), sessionId: session.id, createdAt: new Date(now()), expiresAt: session.expiresAt, usedAt: null, revokedAt: null, replacedBy: null });
    return { user, session, refreshToken };
  }
  async function respond(res: Response, grant: Awaited<ReturnType<typeof create>>) {
    const data = await jwt.issue(grant.user, grant.session);
    res.cookie('block9.refresh', grant.refreshToken, { ...cookieOptions, maxAge: Math.max(0, grant.session.expiresAt.getTime() - now()) });
    return res.json({ ok: true, data });
  }
  const clear = (res: Response) => res.clearCookie('block9.refresh', cookieOptions);
  const requireLogin: RequestHandler = async (req, res, next) => {
    let verified: Awaited<ReturnType<typeof jwt.verify>>;
    try {
      const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
      if (!match) throw new Error();
      verified = await jwt.verify(match[1]);
    } catch { authError(res, 401, 'ACCESS_INVALID', 'Vui lòng đăng nhập để tiếp tục.'); return; }
    const { claims, expired } = verified;
    // This query is intentionally uncached. Logout/password reset affects the
    // next authorization check, including for a copied, otherwise-valid JWT.
    const identity = await repository.identity(claims.sid);
    if (!active(identity) || identity!.user.id !== claims.sub || identity!.user.userVersion !== claims.userVersion
      || identity!.session.sessionVersion !== claims.sessionVersion) {
      authError(res, 401, 'SESSION_REVOKED', 'Phiên đăng nhập đã hết hiệu lực.'); return;
    }
    if (expired) { authError(res, 401, 'ACCESS_EXPIRED', 'Access token đã hết hạn.'); return; }
    res.locals.currentUser = publicUser(identity!.user);
    res.locals.authSessionId = claims.sid;
    next();
  };
  async function refresh(req: Request, res: Response) {
    const token = refreshCookie(req);
    if (!token) { clear(res); return authError(res, 401, 'REFRESH_INVALID', 'Vui lòng đăng nhập.'); }
    const result = await repository.atomic(async tx => {
      const row = await tx.read('refreshToken', digest(token));
      if (!row || row.expiresAt.getTime() <= now()) return null;
      const identity = await tx.identity(row.sessionId);
      if (row.usedAt) {
        await tx.revokeSession(row.sessionId, new Date(now()));
        return null;
      }
      if (row.revokedAt || !active(identity)) return null;
      const refreshToken = opaque(), replacementId = digest(refreshToken);
      await tx.write('refreshToken', { ...row, usedAt: new Date(now()), replacedBy: replacementId });
      await tx.write('refreshToken', { id: replacementId, sessionId: row.sessionId, createdAt: new Date(now()), expiresAt: row.expiresAt, usedAt: null, revokedAt: null, replacedBy: null });
      return { ...identity!, refreshToken };
    });
    if (!result) { clear(res); return authError(res, 401, 'REFRESH_INVALID', 'Phiên đăng nhập đã hết hiệu lực.'); }
    return respond(res, result);
  }
  async function logout(req: Request, res: Response) {
    const token = refreshCookie(req);
    if (token) await repository.atomic(async tx => {
      const row = await tx.read('refreshToken', digest(token));
      if (row) await tx.revokeSession(row.sessionId, new Date(now()));
    });
    clear(res);
    return res.json({ ok: true, data: null });
  }
  return { create, respond, clear, requireLogin, refresh, logout };
}
