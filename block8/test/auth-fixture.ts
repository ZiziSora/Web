import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { AuthRepository, Table, Tables } from '../src/auth-store.js';
import type { AuthDependencies } from '../src/auth.js';
import type { RestaurantStore } from '../src/domain.js';

const empty = () => Object.fromEntries(['user','activationChallenge','passwordReset','captchaChallenge','authRateLimit','session'].map(key => [key, new Map()])) as { [K in Table]: Map<string, Tables[K]> };
export class MemoryAuthRepository implements AuthRepository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private state = { tables: empty() }, private inTransaction = false) {}
  async read<K extends Table>(table: K, id: string): Promise<Tables[K] | null> { return structuredClone(this.state.tables[table].get(id) ?? null); }
  async write<K extends Table>(table: K, value: Tables[K]) { this.state.tables[table].set(value.id, structuredClone(value)); }
  async remove(table: Table, id: string) { this.state.tables[table].delete(id); }
  async userByEmail(email: string) { return structuredClone([...this.state.tables.user.values()].find(row => row.email === email) ?? null); }
  async resetByHash(hash: string) { return structuredClone([...this.state.tables.passwordReset.values()].find(row => row.tokenHash === hash) ?? null); }
  async deleteSessions(userId: string) { for (const row of this.state.tables.session.values()) if (row.userId === userId) this.state.tables.session.delete(row.id); }
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
export async function authFixture(repository: AuthRepository = new MemoryAuthRepository()) {
  await repository.write('user', { id: 'active-user', email: credentials.email, passwordHash: await passwordHash, role: 'viewer', status: 'active', emailVerifiedAt: new Date(), createdAt: new Date(), authVersion: 0 });
  const emails: { kind: 'activation' | 'reset'; email: string; value: string }[] = [];
  let time = Date.now(); let captchaNumber = 0;
  const answers = new Map<string, string>();
  const deps: AuthDependencies = {
    repository, now: () => time,
    config: { sessionSecret: 'test-session-secret-32-bytes-long!!', tokenSecret: 'test-token-secret-different-32-bytes', baseUrl: 'http://localhost:3008', secure: false, trustProxyHops: 0 },
    mailer: { activation: async (email, value) => { emails.push({ kind: 'activation', email, value }); }, reset: async (email, value) => { emails.push({ kind: 'reset', email, value }); } },
    captcha: () => {
      const answer = String(++captchaNumber).padStart(6, '0');
      const image = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M${captchaNumber} 1L2 3"/></svg>`;
      answers.set(Buffer.from(image).toString('base64'), answer);
      return { answer, image };
    }, logger: { error: () => {} },
  };
  return { deps, repository, emails, advance: (ms: number) => { time += ms; }, captchaAnswer: (html: string) => answers.get(html.match(/data:image\/svg\+xml;base64,([^\"]+)/)![1])! };
}
export const csrfFrom = (html: string) => html.match(/name="_csrf" value="([^"]+)"/)![1];
export const captchaIdFrom = (html: string) => html.match(/name="captchaId" value="([^"]+)"/)![1];
export async function loginClient(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const login = await agent.get('/login').expect(200);
  await agent.post('/login').type('form').send({ ...credentials, _csrf: csrfFrom(login.text) }).expect(303);
  const page = await agent.get('/admin/dishes/new').expect(200);
  const csrf = csrfFrom(page.text);
  return {
    get: (url: string) => agent.get(url),
    post: (url: string) => agent.post(url).type('form').send({ _csrf: csrf }),
  };
}
export async function restaurantFixture(store: RestaurantStore, logger?: { error(message: string): void }) {
  const auth = await authFixture();
  const app = createApp(store, { auth: auth.deps, logger });
  return { app, auth, client: await loginClient(app) };
}
