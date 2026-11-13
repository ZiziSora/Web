import bcrypt from 'bcrypt';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import type { AuthRepository, Table, Tables } from '../src/auth-store.js';
import type { AuthDependencies } from '../src/auth.js';

const empty = () => Object.fromEntries(['user', 'activationChallenge', 'passwordReset', 'authSession', 'refreshToken', 'authRateLimit', 'session'].map(key => [key, new Map()])) as { [K in Table]: Map<string, Tables[K]> };
export class MemoryAuthRepository implements AuthRepository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private state = { tables: empty() }, private inTransaction = false) {}
  async read<K extends Table>(table: K, id: string): Promise<Tables[K] | null> { return structuredClone(this.state.tables[table].get(id) ?? null); }
  async write<K extends Table>(table: K, value: Tables[K]) { this.state.tables[table].set(value.id, structuredClone(value)); }
  async remove(table: Table, id: string) { this.state.tables[table].delete(id); }
  async userByEmail(email: string) { return structuredClone([...this.state.tables.user.values()].find(row => row.email === email) ?? null); }
  async resetByHash(hash: string) { return structuredClone([...this.state.tables.passwordReset.values()].find(row => row.tokenHash === hash) ?? null); }
  async identity(id: string) {
    const session = await this.read('authSession', id), user = session ? await this.read('user', session.userId) : null;
    return session && user ? { session, user } : null;
  }
  async revokeSession(id: string, at: Date) {
    const row = await this.read('authSession', id);
    if (row && !row.revokedAt) await this.write('authSession', { ...row, sessionVersion: row.sessionVersion + 1, revokedAt: at });
    for (const token of this.state.tables.refreshToken.values()) if (token.sessionId === id && !token.revokedAt) await this.write('refreshToken', { ...token, revokedAt: at });
  }
  async revokeUserSessions(userId: string, at: Date) {
    for (const row of this.state.tables.authSession.values()) if (row.userId === userId) await this.revokeSession(row.id, at);
  }
  async atomic<T>(work: (tx: AuthRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return work(this);
    const result = this.tail.then(async () => {
      const snapshot = structuredClone(this.state.tables);
      try { return await work(new MemoryAuthRepository(this.state, true)); }
      catch (error) { this.state.tables = snapshot; throw error; }
    });
    this.tail = result.catch(() => {}); return result;
  }
}
export const credentials = { email: 'active@example.com', password: 'Password8!' };
const passwordHash = bcrypt.hash(credentials.password, 12);
export async function authFixture(repository: AuthRepository = new MemoryAuthRepository(), origin = 'http://localhost:5179') {
  await repository.write('user', { id: 'active-user', email: credentials.email, passwordHash: await passwordHash, role: 'viewer', status: 'active', emailVerifiedAt: new Date(), createdAt: new Date(), userVersion: 0 });
  const emails: { kind: 'activation' | 'reset'; email: string; value: string }[] = [];
  let time = Date.now(); const captchaTokens = new Set<string>();
  const deps: AuthDependencies = {
    repository, now: () => time,
    config: { sessionSecret: 'test-session-secret-32-bytes-long!!', tokenSecret: 'test-token-secret-different-32-bytes', jwtSecret: 'test-jwt-secret-different-32-bytes!!', baseUrl: origin, secure: false, trustProxyHops: 0 },
    mailer: { activation: async (email, value) => { emails.push({ kind: 'activation', email, value }); }, reset: async (email, value) => { emails.push({ kind: 'reset', email, value }); } },
    captcha: { verify: async token => captchaTokens.delete(token) }, logger: { error: () => {} },
  };
  return { deps, repository, emails, advance: (ms: number) => { time += ms; },
    captcha: () => { const token = randomBytes(24).toString('hex'); captchaTokens.add(token); return token; } };
}
export async function loginClient(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.data.csrfToken as string;
  const result = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send(credentials).expect(200);
  const access = result.body.data.accessToken as string;
  return {
    get: (url: string) => agent.get(url).set('Authorization', 'Bearer ' + access),
    post: (url: string) => agent.post(url).set('Authorization', 'Bearer ' + access).set('X-CSRF-Token', csrf),
    patch: (url: string) => agent.patch(url).set('Authorization', 'Bearer ' + access).set('X-CSRF-Token', csrf),
    delete: (url: string) => agent.delete(url).set('Authorization', 'Bearer ' + access).set('X-CSRF-Token', csrf),
    options: (url: string) => agent.options(url),
  };
}
