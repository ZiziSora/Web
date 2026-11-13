import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { Router, type Request, type Response, type RequestHandler } from 'express';
import { digest, PersistentSessionStore, type AuthRepository, type User } from './auth-store.js';
import type { AuthConfig } from './auth-config.js';
import type { AuthMailer } from './auth-mail.js';
import { CaptchaUnavailable, type CaptchaVerifier } from './recaptcha.js';
import { authError, opaque, tokenSessions } from './token-sessions.js';

const MINUTE = 60000, HOUR = 3600000;
// Anonymous form state has a separate fixed lifetime from login/refresh tokens.
const ANONYMOUS_SESSION_MS = 8 * HOUR;
const text = (value: unknown) => typeof value === 'string' ? value : '';
export const normalizeEmail = (value: unknown) => text(value).trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validPassword = (value: unknown): value is string => typeof value === 'string' && [...value].length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
const equal = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export interface AuthDependencies {
  repository: AuthRepository; config: AuthConfig; mailer: AuthMailer; captcha: CaptchaVerifier;
  now?: () => number; logger?: { error(message: string): void };
}
export function authentication(deps: AuthDependencies) {
  const { repository: db, config, mailer } = deps;
  const now = deps.now ?? Date.now;
  const tokens = tokenSessions(db, config, now);
  const hmac = (...parts: string[]) => createHmac('sha256', config.tokenSecret).update(JSON.stringify(parts)).digest('hex');
  const key = (scope: string, value: string) => hmac('rate', scope, value);
  const wait = (until: Date | null) => until ? Math.max(0, Math.ceil((until.getTime() - now()) / 1000)) : 0;
  const dummyHash = bcrypt.hash(opaque(), 12);
  const sessionMiddleware = session({
    name: 'block9.anon', secret: config.sessionSecret, store: new PersistentSessionStore(db, now),
    resave: false, saveUninitialized: false, rolling: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/', maxAge: ANONYMOUS_SESSION_MS },
  });
  const initialize: RequestHandler = (req, _res, next) => {
    // Only the bootstrap endpoint creates anonymous sessions. Public reads and
    // unauthorized API calls do not race to overwrite the browser's cookie.
    if (req.path === '/api/auth/csrf') {
      req.session.absoluteExpiresAt ??= now() + ANONYMOUS_SESSION_MS;
      req.session.csrf ??= opaque();
    }
    if (req.session.absoluteExpiresAt) req.session.cookie.maxAge = Math.max(0, req.session.absoluteExpiresAt - now());
    next();
  };
  const csrf: RequestHandler = (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      && (!req.session?.csrf || !equal(text(req.headers['x-csrf-token']), req.session.csrf))) {
      authError(res, 403, 'CSRF_INVALID', 'Phiên biểu mẫu không hợp lệ. Vui lòng tải lại trang.'); return;
    }
    next();
  };
  const success = (res: Response, data: unknown = null) => res.json({ ok: true, data });
  const invalid = (res: Response, message: string, fields: Record<string, string> = {}) => authError(res, 400, 'VALIDATION_FAILED', message, { fields });
  const limited = (res: Response, seconds: number) => {
    res.setHeader('Retry-After', String(Math.max(1, seconds)));
    return authError(res, 429, 'RATE_LIMITED', 'Bạn đã thử quá nhiều lần. Vui lòng chờ.', { retryAfter: Math.max(1, seconds) });
  };
  const captcha = async (req: Request, res: Response) => {
    try {
      if (await deps.captcha.verify(text(req.body?.recaptchaToken))) return true;
      authError(res, 400, 'CAPTCHA_REQUIRED', 'Vui lòng xác minh reCAPTCHA hợp lệ.', { captchaRequired: true });
    } catch (error) {
      if (!(error instanceof CaptchaUnavailable)) throw error;
      authError(res, 503, 'CAPTCHA_UNAVAILABLE', 'Không thể xác minh reCAPTCHA. Vui lòng thử lại.', { captchaRequired: true });
    }
    return false;
  };
  // Caller supplies a serializable transaction, so concurrent requests share one counter.
  const rate = async (tx: AuthRepository, scope: string, value: string, maximum: number, window: number) => {
    const id = key(scope, value);
    let row = await tx.read('authRateLimit', id);
    if (!row || now() - row.windowStart.getTime() >= window) row = { id, count: 0, windowStart: new Date(now()), lockedUntil: null };
    const seconds = wait(row.lockedUntil);
    if (seconds) return seconds;
    if (row.count >= maximum) return Math.max(1, Math.ceil((row.windowStart.getTime() + window - now()) / 1000));
    row.count++; await tx.write('authRateLimit', row); return 0;
  };
  const limits = (req: Request, scope: string, email: string, emailMax: number, ipMax: number) => db.atomic(async tx => {
    const a = await rate(tx, scope + ':email', email, emailMax, HOUR);
    const b = await rate(tx, scope + ':ip', req.ip ?? '', ipMax, HOUR);
    return Math.max(a, b);
  });
  const loginState = async (tx: AuthRepository, email: string) => {
    const id = key('login:fail', email);
    let row = await tx.read('authRateLimit', id);
    if (!row || (!wait(row.lockedUntil) && now() - row.windowStart.getTime() >= 15 * MINUTE))
      row = { id, count: 0, windowStart: new Date(now()), lockedUntil: null };
    return row;
  };
  const safeMail = async (send: () => Promise<void>) => {
    try { await send(); } catch { (deps.logger ?? console).error('Không thể gửi email xác thực. Kiểm tra cấu hình SMTP.'); }
  };
  const issueOtp = async (req: Request, email: string) => {
    const seconds = await limits(req, 'otp:send', email, 5, 20);
    if (seconds) return seconds;
    let otp = String(randomInt(1000000)).padStart(6, '0');
    const result = await db.atomic(async tx => {
      const user = await tx.userByEmail(email);
      if (!user || user.status !== 'pending') return { seconds: 0, send: false };
      const old = await tx.read('activationChallenge', user.id);
      const seconds = old ? Math.max(wait(old.lockedUntil), Math.ceil((old.lastSentAt.getTime() + MINUTE - now()) / 1000)) : 0;
      if (seconds > 0) return { seconds, send: false };
      while (old && equal(old.otpHash, hmac('activation', user.id, otp))) otp = String(randomInt(1000000)).padStart(6, '0');
      await tx.write('activationChallenge', {
        id: user.id, userId: user.id, purpose: 'activation', otpHash: hmac('activation', user.id, otp),
        expiresAt: new Date(now() + 10 * MINUTE), lastSentAt: new Date(now()), attempts: old?.attempts ?? 0,
        lockedUntil: old?.lockedUntil ?? null, usedAt: null,
      });
      return { seconds: 0, send: true };
    });
    if (result.send) await safeMail(() => mailer.activation(email, otp));
    return result.seconds;
  };
  const router = Router();
  router.get('/csrf', async (req, res) => {
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return success(res, { csrfToken: req.session.csrf });
  });
  router.get('/me', tokens.requireLogin, (_req, res) => success(res, res.locals.currentUser));
  router.post('/register', async (req, res) => {
    const seconds = await db.atomic(tx => rate(tx, 'register:ip', req.ip ?? '', 10, HOUR));
    if (seconds) return limited(res, seconds);
    if (!await captcha(req, res)) return;
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return invalid(res, 'Vui lòng nhập địa chỉ email hợp lệ.', { email: 'Email không hợp lệ.' });
    if (!validPassword(req.body?.password)) return invalid(res, 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.', { password: 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.' });
    if (req.body?.passwordConfirm !== req.body.password) return invalid(res, 'Mật khẩu nhập lại không khớp.', { passwordConfirm: 'Mật khẩu nhập lại không khớp.' });
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const created = await db.atomic(async tx => {
      if (await tx.userByEmail(email)) return false;
      const user: User = { id: opaque(), email, passwordHash, status: 'pending', role: 'viewer', emailVerifiedAt: null, userVersion: 0, createdAt: new Date(now()) };
      await tx.write('user', user); return true;
    });
    if (created) await issueOtp(req, email);
    return success(res, { next: '/activate?email=' + encodeURIComponent(email), message: 'Nếu thông tin phù hợp, mã kích hoạt đã được gửi qua email.' });
  });
  router.post('/activate/resend', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const cooldown = await db.atomic(tx => rate(tx, 'otp:cooldown', email, 1, MINUTE));
    if (cooldown) return limited(res, cooldown);
    const seconds = await issueOtp(req, email);
    if (seconds) return limited(res, seconds);
    return success(res, { message: 'Nếu thông tin phù hợp, mã kích hoạt đã được gửi qua email.', retryAfter: 60 });
  });
  router.post('/activate', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const seconds = await db.atomic(tx => rate(tx, 'otp:verify:ip', req.ip ?? '', 60, 15 * MINUTE));
    if (seconds) return limited(res, seconds);
    const result = await db.atomic(async tx => {
      const user = await tx.userByEmail(email);
      const row = user ? await tx.read('activationChallenge', user.id) : null;
      if (!user || !row || user.status !== 'pending') return { ok: false, seconds: 0 };
      if (wait(row.lockedUntil)) return { ok: false, seconds: wait(row.lockedUntil) };
      if (row.lockedUntil && row.lockedUntil.getTime() <= now()) { row.attempts = 0; row.lockedUntil = null; }
      const ok = row.purpose === 'activation' && !row.usedAt && row.expiresAt.getTime() > now() && /^\d{6}$/.test(text(req.body?.otp)) && equal(row.otpHash, hmac('activation', user.id, text(req.body?.otp)));
      if (!ok) {
        row.attempts++;
        if (row.attempts >= 5) row.lockedUntil = new Date(now() + 15 * MINUTE);
        await tx.write('activationChallenge', row); return { ok: false, seconds: wait(row.lockedUntil) };
      }
      row.usedAt = new Date(now()); await tx.write('activationChallenge', row);
      await tx.write('user', { ...user, status: 'active', emailVerifiedAt: new Date(now()) });
      return { ok: true, seconds: 0 };
    });
    if (result.seconds) return limited(res, result.seconds);
    if (!result.ok) return invalid(res, 'Mã kích hoạt không hợp lệ hoặc đã hết hạn.', { otp: 'Mã không hợp lệ hoặc đã hết hạn.' });
    return success(res, { next: '/login?status=activated' });
  });
  router.post('/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const seconds = await db.atomic(async tx => Math.max(await rate(tx, 'login:ip', req.ip ?? '', 60, 15 * MINUTE), wait((await loginState(tx, email)).lockedUntil)));
    if (seconds) return limited(res, seconds);
    const state = await loginState(db, email);
    if (state.count >= 3 && !await captcha(req, res)) return;
    const user = await db.userByEmail(email);
    const matches = validPassword(req.body?.password) && await bcrypt.compare(req.body.password, user?.passwordHash ?? await dummyHash);
    if (!matches || user?.status !== 'active') {
      const result = await db.atomic(async tx => {
        const row = await loginState(tx, email); row.count++;
        if (row.count >= 10 && !wait(row.lockedUntil)) row.lockedUntil = new Date(now() + 15 * MINUTE);
        await tx.write('authRateLimit', row); return { seconds: wait(row.lockedUntil), captchaRequired: row.count >= 3 };
      });
      if (result.seconds) return limited(res, result.seconds);
      return authError(res, 400, 'LOGIN_FAILED', 'Email hoặc mật khẩu không hợp lệ.', { captchaRequired: result.captchaRequired });
    }
    const result = await db.atomic(async tx => {
      const current = await tx.read('user', user.id);
      const row = await loginState(tx, email);
      if (wait(row.lockedUntil)) return { seconds: wait(row.lockedUntil), grant: null };
      if (!current || current.status !== 'active' || current.userVersion !== user.userVersion || current.passwordHash !== user.passwordHash) return { seconds: 0, grant: null };
      await tx.remove('authRateLimit', row.id);
      return { seconds: 0, grant: await tokens.create(tx, current) };
    });
    if (result.seconds) return limited(res, result.seconds);
    if (!result.grant) return authError(res, 400, 'LOGIN_FAILED', 'Email hoặc mật khẩu không hợp lệ.');
    return tokens.respond(res, result.grant);
  });
  router.post('/refresh', async (req, res) => {
    const seconds = await db.atomic(tx => rate(tx, 'refresh:ip', req.ip ?? '', 120, MINUTE));
    if (seconds) return limited(res, seconds);
    return tokens.refresh(req, res);
  });
  router.post('/logout', tokens.logout);
  router.post('/forgot', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const seconds = await limits(req, 'forgot', email, 5, 20);
    if (seconds) return limited(res, seconds);
    const token = opaque();
    const send = await db.atomic(async tx => {
      const user = await tx.userByEmail(email);
      if (!user || user.status !== 'active') return false;
      await tx.write('passwordReset', { id: user.id, userId: user.id, tokenHash: digest(token), expiresAt: new Date(now() + 30 * MINUTE), usedAt: null });
      return true;
    });
    if (send) await safeMail(() => mailer.reset(email, config.baseUrl + '/reset?token=' + token));
    return success(res, { message: 'Nếu thông tin phù hợp, email hướng dẫn đặt lại mật khẩu sẽ được gửi.' });
  });
  router.post('/reset/prepare', async (req, res) => {
    const token = text(req.body?.token);
    const hash = token ? (/^[a-f0-9]{64}$/.test(token) ? digest(token) : '') : req.session.resetHash ?? '';
    const row = hash ? await db.resetByHash(hash) : null;
    if (!row || row.usedAt || row.expiresAt.getTime() <= now()) {
      req.session.resetHash = undefined;
      return invalid(res, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
    req.session.resetHash = hash;
    return success(res);
  });
  router.post('/reset', async (req, res) => {
    const seconds = await db.atomic(tx => rate(tx, 'reset:ip', req.ip ?? '', 20, HOUR));
    if (seconds) return limited(res, seconds);
    if (!validPassword(req.body?.password)) return invalid(res, 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.', { password: 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.' });
    if (req.body?.passwordConfirm !== req.body.password) return invalid(res, 'Mật khẩu nhập lại không khớp.', { passwordConfirm: 'Mật khẩu nhập lại không khớp.' });
    const hash = req.session.resetHash ?? '';
    const candidate = hash ? await db.resetByHash(hash) : null;
    if (!candidate || candidate.usedAt || candidate.expiresAt.getTime() <= now()) return invalid(res, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const ok = await db.atomic(async tx => {
      const row = await tx.resetByHash(hash);
      const user = row ? await tx.read('user', row.userId) : null;
      if (!row || !user || user.status !== 'active' || row.usedAt || row.expiresAt.getTime() <= now()) return false;
      await tx.write('passwordReset', { ...row, usedAt: new Date(now()) });
      await tx.write('user', { ...user, passwordHash, userVersion: user.userVersion + 1 });
      await tx.revokeUserSessions(user.id, new Date(now())); return true;
    });
    if (!ok) return invalid(res, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    req.session.resetHash = undefined;
    tokens.clear(res);
    return success(res, { next: '/login?status=reset' });
  });
  return { sessionMiddleware, initialize, csrf, router, requireLogin: tokens.requireLogin };
}
