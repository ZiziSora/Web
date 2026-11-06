import type { PrismaClient } from './generated/prisma/client.js';
import session, { type SessionData } from 'express-session';
import { createHash } from 'node:crypto';

export interface User {
  id: string; email: string; passwordHash: string; role: string;
  status: string; emailVerifiedAt: Date | null; authVersion: number; createdAt: Date;
}
export interface Activation {
  id: string; userId: string; purpose: string; otpHash: string; expiresAt: Date;
  attempts: number; lockedUntil: Date | null; lastSentAt: Date; usedAt: Date | null;
}
export interface Reset { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }
export interface Captcha { id: string; owner: string; purpose: string; answerHash: string; expiresAt: Date; usedAt: Date | null }
export interface Rate { id: string; count: number; windowStart: Date; lockedUntil: Date | null }
export interface StoredSession { id: string; userId: string | null; data: SessionData; expiresAt: Date }
export interface Tables { user: User; activationChallenge: Activation; passwordReset: Reset; captchaChallenge: Captcha; authRateLimit: Rate; session: StoredSession }
export type Table = keyof Tables;
export interface AuthRepository {
  read<K extends Table>(table: K, id: string): Promise<Tables[K] | null>;
  write<K extends Table>(table: K, value: Tables[K]): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  userByEmail(email: string): Promise<User | null>;
  resetByHash(hash: string): Promise<Reset | null>;
  deleteSessions(userId: string): Promise<void>;
  atomic<T>(work: (tx: AuthRepository) => Promise<T>): Promise<T>;
}

// The narrow delegate adapter preserves typed records without exposing Prisma to services/tests.
interface Delegate<T> {
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  upsert(args: { where: { id: string }; create: T; update: Omit<T, 'id'> }): Promise<unknown>;
  deleteMany(args: { where: { id: string } }): Promise<unknown>;
}
export class PrismaAuthRepository implements AuthRepository {
  constructor(private db: PrismaClient, private transaction = false) {}
  private delegate<K extends Table>(table: K) { return this.db[table] as unknown as Delegate<Tables[K]>; }
  read<K extends Table>(table: K, id: string) { return this.delegate(table).findUnique({ where: { id } }); }
  async write<K extends Table>(table: K, value: Tables[K]) {
    // JSON round-trip removes undefined fields and Cookie prototypes before persisting a session.
    const record = table === 'session' ? { ...value, data: JSON.parse(JSON.stringify((value as StoredSession).data)) } : value;
    const { id, ...update } = record;
    await this.delegate(table).upsert({ where: { id }, create: record as Tables[K], update: update as Omit<Tables[K], 'id'> });
  }
  async remove(table: Table, id: string) { await this.delegate(table).deleteMany({ where: { id } }); }
  userByEmail(email: string) { return this.db.user.findUnique({ where: { email } }); }
  resetByHash(tokenHash: string) { return this.db.passwordReset.findUnique({ where: { tokenHash } }); }
  async deleteSessions(userId: string) { await this.db.session.deleteMany({ where: { userId } }); }
  async atomic<T>(work: (tx: AuthRepository) => Promise<T>): Promise<T> {
    if (this.transaction) return work(this);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(tx => work(new PrismaAuthRepository(tx as PrismaClient, true)), {
          isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (attempt >= 4 || !['P2034', 'P2002'].includes(code ?? '')) throw error;
      }
    }
  }
}

declare module 'express-session' {
  interface SessionData { csrf?: string; owner?: string; userId?: string; authVersion?: number; absoluteExpiresAt?: number }
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export class PersistentSessionStore extends session.Store {
  constructor(private repository: AuthRepository, private now: () => number = Date.now) { super(); }
  get(sid: string, callback: (err?: unknown, data?: SessionData | null) => void) {
    void this.repository.read('session', digest(sid)).then(row => {
      callback(null, row && row.expiresAt.getTime() > this.now() ? row.data : null);
    }).catch(callback);
  }
  set(sid: string, data: SessionData, callback: (err?: unknown) => void = () => {}) {
    void this.repository.atomic(async tx => {
      // A concurrent response must not recreate a session destroyed by logout/regenerate.
      const revoked = await tx.read('authRateLimit', 'revoked:' + digest(sid));
      if (revoked?.lockedUntil && revoked.lockedUntil.getTime() > this.now()) return;
      if (data.userId) {
        const user = await tx.read('user', data.userId);
        if (!user || user.status !== 'active' || user.authVersion !== data.authVersion) return;
      }
      await tx.write('session', {
        id: digest(sid), userId: data.userId ?? null, data,
        expiresAt: new Date(data.absoluteExpiresAt ?? data.cookie.expires ?? this.now() + 8 * 3600000),
      });
    }).then(() => callback()).catch(callback);
  }
  destroy(sid: string, callback: (err?: unknown) => void = () => {}) {
    void this.repository.atomic(async tx => {
      await tx.remove('session', digest(sid));
      await tx.write('authRateLimit', { id: 'revoked:' + digest(sid), count: 0, windowStart: new Date(this.now()), lockedUntil: new Date(this.now() + 8 * 3600000) });
    }).then(() => callback()).catch(callback);
  }
  // Expiry is fixed, not extended by reads/touch.
  touch(_sid: string, _data: SessionData, callback: (err?: unknown) => void = () => {}) { callback(); }
}
