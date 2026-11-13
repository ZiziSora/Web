import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LogIn, Mail, ShieldCheck, UserPlus, LockKeyhole } from 'lucide-react';
import { ApiError } from '../api/errors';
import { clearAuth, login, submitAuth } from '../auth/state';
import { useAuth } from '../auth/useAuth';
import { Recaptcha } from '../auth/Recaptcha';

type Mode = 'login' | 'register' | 'activate' | 'forgot' | 'reset';
const titles = { login: 'Đăng nhập', register: 'Tạo tài khoản', activate: 'Kích hoạt email', forgot: 'Quên mật khẩu', reset: 'Đặt lại mật khẩu' };
const buttons = { login: 'Đăng nhập', register: 'Tạo tài khoản', activate: 'Kích hoạt', forgot: 'Gửi hướng dẫn', reset: 'Đổi mật khẩu' };
const icons = { login: LogIn, register: UserPlus, activate: ShieldCheck, forgot: Mail, reset: KeyRound };
function PasswordField({ confirm = false, loginMode = false, newPassword = false, error = '' }: { confirm?: boolean; loginMode?: boolean; newPassword?: boolean; error?: string }) {
  const [visible, setVisible] = useState(false), id = confirm ? 'passwordConfirm' : 'password';
  return <div className="field"><div className="auth-label-row"><label htmlFor={id}>{confirm ? 'Nhập lại mật khẩu' : 'Mật khẩu'}{!confirm && newPassword ? ' mới' : ''}</label>{loginMode && <Link to="/forgot">Quên mật khẩu?</Link>}</div>
    <div className="auth-input"><LockKeyhole aria-hidden="true" /><input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={loginMode ? 'current-password' : 'new-password'} required aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} />
      <button className="auth-password-toggle" type="button" aria-label={(visible ? 'Ẩn' : 'Hiện') + (confirm ? ' mật khẩu nhập lại' : ' mật khẩu')} aria-pressed={visible} onClick={() => setVisible(x => !x)}>{visible ? <EyeOff /> : <Eye />}</button></div>
    {error && <p id={id + '-error'} className="field-error">{error}</p>}
    {!confirm && !loginMode && <p className="field-hint">Tối thiểu 8 ký tự, tối đa 72 byte UTF-8.</p>}
  </div>;
}
export function AuthPage({ mode }: { mode: Mode }) {
  const loc = useLocation(), navigate = useNavigate(), auth = useAuth(), Icon = icons[mode];
  const [email, setEmail] = useState(() => new URLSearchParams(loc.search).get('email') ?? '');
  const [error, setError] = useState<ApiError | null>(null), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [captchaRequired, setCaptchaRequired] = useState(mode === 'register');
  const [recaptchaToken, setRecaptchaToken] = useState(''), [resetKey, setResetKey] = useState(0);
  const [cooldown, setCooldown] = useState(mode === 'activate' && loc.state?.sent ? 60 : 0), [retryAfter, setRetryAfter] = useState(0);
  const [prepared, setPrepared] = useState(mode !== 'reset');
  const alive = useRef(true), sending = useRef(false), rawResetToken = useRef(new URLSearchParams(loc.search).get('token'));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { document.title = 'The Table · ' + titles[mode]; }, [mode]);
  useEffect(() => {
    if (mode !== 'reset') return;
    let active = true;
    void submitAuth('/reset/prepare', rawResetToken.current ? { token: rawResetToken.current } : {}).then(() => {
      if (!active) return;
      rawResetToken.current = null; setPrepared(true); navigate('/reset', { replace: true });
    }).catch(e => { if (active) { setError(e); rawResetToken.current = null; navigate('/reset', { replace: true }); } });
    return () => { active = false; };
  }, [mode, navigate]);
  useEffect(() => {
    if (!cooldown && !retryAfter) return;
    const timer = setInterval(() => { setCooldown(x => Math.max(0, x - 1)); setRetryAfter(x => Math.max(0, x - 1)); }, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0, retryAfter > 0]);
  const fail = (e: unknown) => {
    const value = e instanceof ApiError ? e : new ApiError('Không thể xử lý yêu cầu. Vui lòng thử lại.');
    setError(value); if (value.captchaRequired) setCaptchaRequired(true);
    if (value.retryAfter) setRetryAfter(value.retryAfter);
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
    if (['register', 'reset'].includes(mode) && values.password !== values.passwordConfirm) { setError(new ApiError('Mật khẩu nhập lại không khớp.', 'VALIDATION_FAILED', { passwordConfirm: 'Mật khẩu nhập lại không khớp.' })); return; }
    sending.current = true; setBusy(true); setError(null); setMessage('');
    try {
      if (mode === 'login') { await login({ ...values, recaptchaToken }); if (alive.current) navigate('/admin/dishes', { replace: true }); }
      else {
        const result = await submitAuth<{ next?: string; message?: string }>('/' + mode, { ...values, recaptchaToken });
        if (!alive.current) return;
        if (mode === 'reset') clearAuth(true);
        if (result.next) navigate(result.next, { replace: mode === 'reset', state: { sent: mode === 'register' } });
        else setMessage(result.message ?? 'Đã xử lý yêu cầu.');
      }
    } catch (e) { if (alive.current) fail(e); }
    finally { sending.current = false; if (alive.current) { setBusy(false); setRecaptchaToken(''); setResetKey(x => x + 1); } }
  }
  async function resend() {
    if (sending.current || cooldown || !email) return;
    sending.current = true; setBusy(true); setError(null);
    try {
      const result = await submitAuth<{ message: string; retryAfter: number }>('/activate/resend', { email });
      if (alive.current) { setMessage(result.message); setCooldown(result.retryAfter); }
    } catch (e) { if (alive.current) fail(e); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  const status = new URLSearchParams(loc.search).get('status');
  const notice = message || (mode === 'login' && status === 'activated' ? 'Đã kích hoạt. Vui lòng đăng nhập.' : mode === 'login' && status === 'reset' ? 'Đã đổi mật khẩu. Vui lòng đăng nhập.' : mode === 'activate' ? 'Nhập mã kích hoạt đã được gửi qua email.' : '');
  return <section className="container auth-page"><div className="auth-panel"><div className="auth-heading-icon"><Icon aria-hidden="true" /></div><h1>{titles[mode]}</h1>
    {auth.user && mode === 'login' && <p className="auth-notice" role="status">Bạn đang đăng nhập với {auth.user.email}. <Link to="/admin">Đến quản trị</Link></p>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {error && <p className="auth-notice auth-notice--error" role="alert">{error.message}{retryAfter > 0 && ` Thử lại sau ${retryAfter} giây.`}</p>}
    <form className="auth-form" onSubmit={submit} aria-busy={busy}>
      {mode !== 'reset' && <div className="field"><label htmlFor="email">Email</label><div className="auth-input"><Mail aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="ban@example.com" required value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!error?.fields.email} /></div>{error?.fields.email && <p className="field-error">{error.fields.email}</p>}</div>}
      {['login', 'register', 'reset'].includes(mode) && <PasswordField loginMode={mode === 'login'} newPassword={mode === 'reset'} error={error?.fields.password} />}
      {['register', 'reset'].includes(mode) && <PasswordField confirm error={error?.fields.passwordConfirm} />}
      {mode === 'activate' && <div className="field"><label htmlFor="otp">Mã kích hoạt</label><div className="auth-input"><ShieldCheck aria-hidden="true" /><input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required /></div><p className="field-hint">Mã gồm 6 chữ số, có hiệu lực 10 phút.</p></div>}
      {captchaRequired && <Recaptcha resetKey={resetKey} onChange={setRecaptchaToken} />}
      <button className="button primary auth-submit" type="submit" disabled={busy || retryAfter > 0 || !prepared || (captchaRequired && !recaptchaToken)}>{busy ? 'Đang xử lý…' : !prepared && !error ? 'Đang kiểm tra liên kết…' : buttons[mode]}<ArrowRight aria-hidden="true" /></button>
    </form>
    {mode === 'activate' && <div className="auth-resend-form"><h2>Chưa nhận được mã?</h2><p className="field-hint">Gửi lại đến email đã nhập phía trên.</p><button type="button" className="button secondary" disabled={busy || cooldown > 0 || retryAfter > 0 || !email} onClick={() => void resend()}>{cooldown ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}</button></div>}
    <nav className="auth-links" aria-label="Tài khoản">{mode === 'login' ? <><p>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p><Link to="/activate">Kích hoạt tài khoản</Link></> : mode === 'register' ? <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p> : <Link to="/login"><ArrowLeft aria-hidden="true" /> Quay lại đăng nhập</Link>}</nav>
  </div></section>;
}
