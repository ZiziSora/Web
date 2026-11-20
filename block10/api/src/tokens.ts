import { SignJWT, jwtVerify, errors } from 'jose';
import type { AuthSession, User } from './auth-store.js';

export const ISSUER = 'the-table-block10';
export const AUDIENCE = 'the-table-block10-api';
export interface AccessClaims { sub: string; sid: string; userVersion: number; sessionVersion: number; exp: number }

export function accessTokens(secret: string, now: () => number, ttlMs: number) {
  const key = new TextEncoder().encode(secret);
  return {
    async issue(user: User, session: AuthSession) {
      const issuedAt = Math.floor(now() / 1000);
      const expiresAt = Math.floor(Math.min(now() + ttlMs, session.expiresAt.getTime()) / 1000);
      const accessToken = await new SignJWT({ sid: session.id, userVersion: user.userVersion, sessionVersion: session.sessionVersion })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(user.id).setIssuer(ISSUER).setAudience(AUDIENCE)
        .setIssuedAt(issuedAt).setExpirationTime(expiresAt).sign(key);
      return { accessToken, expiresAt: expiresAt * 1000, user: { id: user.id, email: user.email, role: user.role } };
    },
    async verify(token: string): Promise<{ claims: AccessClaims; expired: boolean }> {
      // Check all signed claims before reporting expiration. The caller still checks
      // current database versions before allowing the client to attempt refresh.
      let payload;
      try { ({ payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'], typ: 'JWT', issuer: ISSUER, audience: AUDIENCE,
        currentDate: new Date(now()), requiredClaims: ['sub', 'sid', 'iat', 'exp', 'userVersion', 'sessionVersion'],
      })); } catch (error) {
        if (!(error instanceof errors.JWTExpired)) throw error;
        payload = error.payload;
      }
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string'
        || !Number.isSafeInteger(payload.userVersion) || !Number.isSafeInteger(payload.sessionVersion)
        || Number(payload.userVersion) < 0 || Number(payload.sessionVersion) < 0
        || typeof payload.iat !== 'number' || typeof payload.exp !== 'number'
        || payload.iat > Math.floor(now() / 1000) || payload.exp <= payload.iat || payload.exp - payload.iat > ttlMs / 1000
        || (typeof payload.nbf === 'number' && payload.nbf > now() / 1000)) throw new Error('Invalid access claims');
      return { claims: payload as unknown as AccessClaims, expired: payload.exp <= now() / 1000 };
    },
  };
}
