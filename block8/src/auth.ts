import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import svgCaptcha from 'svg-captcha';
import session from 'express-session';
import { Router, type Request, type Response, type RequestHandler } from 'express';
import { digest, PersistentSessionStore, type AuthRepository, type User } from './auth-store.js';
import type { AuthConfig } from './auth-config.js';
import type { AuthMailer } from './auth-mail.js';

const MINUTE = 60000, HOUR = 3600000;
const text = (value: unknown) => typeof value === 'string' ? value : '';
export const normalizeEmail = (value: unknown) => text(value).trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validPassword = (value: unknown): value is string => typeof value === 'string' && [...value].length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
const equal = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const opaque = () => randomBytes(32).toString('hex');
export interface AuthDependencies {
  repository: AuthRepository; config: AuthConfig; mailer: AuthMailer; now?: () => number;
  captcha?: () => { answer: string; image: string }; logger?: { error(message: string): void };
}
export function createCaptcha() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const answer = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
  // The package's documented callable export is missing from its bundled .d.ts.
  const render = svgCaptcha as unknown as (answer: string, options: Parameters<typeof svgCaptcha.create>[0]) => string;
  return { answer, image: render(answer, { noise: 4, color: false, background: '#f5f0e7', width: 220, height: 70 }) };
}

export function authentication(deps: AuthDependencies) {
  const { repository: db, config, mailer } = deps;
  const now = deps.now ?? Date.now;
  const hmac = (...parts: string[]) => createHmac('sha256', config.tokenSecret).update(JSON.stringify(parts)).digest('hex');
  const key = (scope: string, value: string) => hmac('rate', scope, value);
  const wait = (until: Date | null) => until ? Math.max(0, Math.ceil((until.getTime() - now()) / 1000)) : 0;
  // A precomputed real bcrypt hash avoids the cheap "unknown account" branch.
  const dummyHash = bcrypt.hash(opaque(), 12);
  const sessionMiddleware = session({
    name: 'sid', secret: config.sessionSecret, store: new PersistentSessionStore(db, now),
    resave: false, saveUninitialized: false, rolling: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/', maxAge: 8 * HOUR },
  });
  const locals: RequestHandler = async (req, res, next) => {
    req.session.absoluteExpiresAt ??= now() + 8 * HOUR;
    req.session.cookie.maxAge = Math.max(0, req.session.absoluteExpiresAt - now());
    req.session.csrf ??= opaque();
    req.session.owner ??= opaque();
    res.locals.csrf = req.session.csrf;
    res.locals.currentUser = null;
    if (req.session.userId) {
      const user = await db.read('user', req.session.userId);
      if (user?.status === 'active' && user.authVersion === req.session.authVersion) res.locals.currentUser = { email: user.email };
      else {
        await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
        req.session.csrf = opaque(); req.session.owner = opaque(); res.locals.csrf = req.session.csrf;
        req.session.absoluteExpiresAt = now() + 8 * HOUR;
      }
    }
    next();
  };
  const requireLogin: RequestHandler = (_req, res, next) => {
    if (!res.locals.currentUser) { res.redirect(303, '/login'); return; }
    next();
  };
  const errorPage = (res: Response, status: number, message: string) => res.status(status).render('error', {
    status, pageTitle: status === 429 ? 'Vui lòng chờ' : 'Yêu cầu chưa hợp lệ',
    heading: status === 429 ? 'Bạn đã thử quá nhiều lần.' : 'Yêu cầu chưa hợp lệ.', message, retryUrl: '/login',
  });
  const limited = (res: Response, seconds: number) => {
    res.setHeader('Retry-After', String(Math.max(1, seconds)));
    return errorPage(res, 429, 'Vui lòng chờ trước khi thử lại.');
  };
  const csrf: RequestHandler = (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !equal(text(req.body?._csrf), req.session.csrf ?? opaque())) {
      errorPage(res, 403, 'Phiên biểu mẫu không hợp lệ. Vui lòng tải lại trang và thử lại.'); return;
    }
    next();
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
  const consumeCaptcha = (req: Request, purpose: string) => db.atomic(async tx => {
    const row = await tx.read('captchaChallenge', text(req.body?.captchaId));
    if (!row || row.owner !== req.session.owner || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() <= now()) return false;
    row.usedAt = new Date(now()); await tx.write('captchaChallenge', row);
    return equal(row.answerHash, hmac('captcha', row.id, row.owner, purpose, text(req.body?.captcha).trim().toUpperCase()));
  });
  const captchaForm = async (req: Request, purpose: string) => {
    const seconds = await db.atomic(tx => rate(tx, 'captcha:ip', req.ip ?? '', 60, MINUTE));
    if (seconds) return { seconds, id: '', image: '' };
    const value = (deps.captcha ?? createCaptcha)(); const id = opaque();
    await db.write('captchaChallenge', {
      id, owner: req.session.owner!, purpose, answerHash: hmac('captcha', id, req.session.owner!, purpose, value.answer.toUpperCase()),
      expiresAt: new Date(now() + 5 * MINUTE), usedAt: null,
    });
    // Only paths from the server-side renderer reach the image. No answer or SVG text node is sent.
    return { seconds: 0, id, image: 'data:image/svg+xml;base64,' + Buffer.from(value.image).toString('base64') };
  };
  const form = async (req: Request, res: Response, mode: string, message = '', status = 200, forceCaptcha = false) => {
    const email = normalizeEmail(req.body?.email ?? req.query.email);
    const state = mode === 'login' ? await loginState(db, email) : null;
    const needsCaptcha = mode === 'register' || (mode === 'login' && (forceCaptcha || (state?.count ?? 0) >= 3));
    const captcha = needsCaptcha ? await captchaForm(req, mode) : null;
    if (captcha?.seconds) return limited(res, captcha.seconds);
    return res.status(status).render('auth/form', { mode, email, message, captcha, messageTone: status >= 400 ? 'error' : (req.query.status === 'reset' || req.query.status === 'activated') ? 'success' : 'info', pageTitle: ({ login: 'Đăng nhập', register: 'Đăng ký', activate: 'Kích hoạt email', forgot: 'Quên mật khẩu', reset: 'Đặt lại mật khẩu' } as Record<string, string>)[mode] });
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
  router.get('/login', (req, res) => form(req, res, 'login', req.query.status === 'reset' ? 'Đã đổi mật khẩu. Vui lòng đăng nhập.' : req.query.status === 'activated' ? 'Đã kích hoạt. Vui lòng đăng nhập.' : ''));
  router.get('/register', (req, res) => form(req, res, 'register'));
  router.get('/activate', (req, res) => form(req, res, 'activate', 'Nếu thông tin phù hợp, mã kích hoạt đã được gửi qua email.'));
  router.get('/forgot', (req, res) => form(req, res, 'forgot'));
  router.post('/register', async (req, res) => {
    const seconds = await db.atomic(tx => rate(tx, 'register:ip', req.ip ?? '', 10, HOUR));
    if (seconds) return limited(res, seconds);
    if (!await consumeCaptcha(req, 'register')) return form(req, res, 'register', 'CAPTCHA không hợp lệ hoặc đã hết hạn.', 400);
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return form(req, res, 'register', 'Vui lòng nhập địa chỉ email hợp lệ.', 400);
    if (!validPassword(req.body?.password)) return form(req, res, 'register', typeof req.body?.password === 'string' && [...req.body.password].length >= 8 ? 'Mật khẩu quá dài. Vui lòng chọn mật khẩu ngắn hơn.' : 'Mật khẩu cần ít nhất 8 ký tự.', 400);
    if (req.body?.passwordConfirm !== req.body.password) return form(req, res, 'register', 'Mật khẩu nhập lại không khớp.', 400);
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const created = await db.atomic(async tx => {
      if (await tx.userByEmail(email)) return false;
      const user: User = { id: opaque(), email, passwordHash, status: 'pending', role: 'viewer', emailVerifiedAt: null, authVersion: 0, createdAt: new Date(now()) };
      await tx.write('user', user); return true;
    });
    if (created) await issueOtp(req, email);
    return res.redirect(303, '/activate?email=' + encodeURIComponent(email));
  });
  router.post('/activate/resend', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    // This cooldown is applied to unknown and existing emails alike.
    const cooldown = await db.atomic(tx => rate(tx, 'otp:cooldown', email, 1, MINUTE));
    if (cooldown) return limited(res, cooldown);
    const seconds = await issueOtp(req, email);
    if (seconds) return limited(res, seconds);
    return res.redirect(303, '/activate?email=' + encodeURIComponent(email));
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
    if (!result.ok) return form(req, res, 'activate', 'Mã kích hoạt không hợp lệ hoặc đã hết hạn.', 400);
    return res.redirect(303, '/login?status=activated');
  });
  router.post('/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const seconds = await db.atomic(async tx => Math.max(await rate(tx, 'login:ip', req.ip ?? '', 60, 15 * MINUTE), wait((await loginState(tx, email)).lockedUntil)));
    if (seconds) return limited(res, seconds);
    const state = await loginState(db, email);
    if (state.count >= 3 && !await consumeCaptcha(req, 'login')) return form(req, res, 'login', 'Vui lòng nhập CAPTCHA hợp lệ.', 400, true);
    const user = await db.userByEmail(email);
    const matches = validPassword(req.body?.password) && await bcrypt.compare(req.body.password, user?.passwordHash ?? await dummyHash);
    if (!matches || user?.status !== 'active') {
      const seconds = await db.atomic(async tx => {
        const row = await loginState(tx, email); row.count++;
        if (row.count >= 10 && !wait(row.lockedUntil)) row.lockedUntil = new Date(now() + 15 * MINUTE);
        await tx.write('authRateLimit', row); return wait(row.lockedUntil);
      });
      if (seconds) return limited(res, seconds);
      return form(req, res, 'login', 'Email hoặc mật khẩu không hợp lệ.', 400);
    }
    // Recheck after bcrypt: reset/lock can race the slow password comparison.
    const allowed = await db.atomic(async tx => {
      const current = await tx.read('user', user.id);
      const row = await loginState(tx, email);
      if (wait(row.lockedUntil)) return { seconds: wait(row.lockedUntil), ok: false };
      if (!current || current.status !== 'active' || current.authVersion !== user.authVersion || current.passwordHash !== user.passwordHash) return { seconds: 0, ok: false };
      await tx.remove('authRateLimit', row.id); return { seconds: 0, ok: true };
    });
    if (allowed.seconds) return limited(res, allowed.seconds);
    if (!allowed.ok) return form(req, res, 'login', 'Email hoặc mật khẩu không hợp lệ.', 400);
    await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id; req.session.authVersion = user.authVersion;
    req.session.absoluteExpiresAt = now() + 8 * HOUR;
    req.session.csrf = opaque(); req.session.owner = opaque();
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return res.redirect(303, '/admin/dishes');
  });
  router.post('/logout', async (req, res) => {
    await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('sid', { httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/' });
    return res.redirect(303, '/login');
  });
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
    return form(req, res, 'forgot', 'Nếu thông tin phù hợp, email hướng dẫn đặt lại mật khẩu sẽ được gửi.');
  });
  router.get('/reset', async (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    const token = text(req.query.token);
    const hash = /^[a-f0-9]{64}$/.test(token) ? digest(token) : '';
    const row = hash ? await db.resetByHash(hash) : null;
    req.session.resetHash = row && !row.usedAt && row.expiresAt.getTime() > now() ? hash : undefined;
    if (!req.session.resetHash) return errorPage(res, 400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    return form(req, res, 'reset');
  });
  router.post('/reset', async (req, res) => {
    const seconds = await db.atomic(tx => rate(tx, 'reset:ip', req.ip ?? '', 20, HOUR));
    if (seconds) return limited(res, seconds);
    if (!validPassword(req.body?.password)) return form(req, res, 'reset', typeof req.body?.password === 'string' && [...req.body.password].length >= 8 ? 'Mật khẩu quá dài. Vui lòng chọn mật khẩu ngắn hơn.' : 'Mật khẩu cần ít nhất 8 ký tự.', 400);
    if (req.body?.passwordConfirm !== req.body.password) return form(req, res, 'reset', 'Mật khẩu nhập lại không khớp.', 400);
    const hash = req.session.resetHash ?? '';
    const candidate = hash ? await db.resetByHash(hash) : null;
    if (!candidate || candidate.usedAt || candidate.expiresAt.getTime() <= now()) return errorPage(res, 400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const ok = await db.atomic(async tx => {
      const row = await tx.resetByHash(hash);
      const user = row ? await tx.read('user', row.userId) : null;
      if (!row || !user || user.status !== 'active' || row.usedAt || row.expiresAt.getTime() <= now()) return false;
      await tx.write('passwordReset', { ...row, usedAt: new Date(now()) });
      await tx.write('user', { ...user, passwordHash, authVersion: user.authVersion + 1 });
      await tx.deleteSessions(user.id); return true;
    });
    if (!ok) return errorPage(res, 400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('sid', { httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/' });
    return res.redirect(303, '/login?status=reset');
  });
  return { sessionMiddleware, locals, requireLogin, csrf, router };
}

declare module 'express-session' { interface SessionData { resetHash?: string } }
