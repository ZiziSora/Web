import { useEffect, useState, useId, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Copy, Download, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, LogIn, Mail, QrCode, RefreshCw, Search, Settings, ShieldCheck, ShieldOff, Smartphone, UserRound, UserRoundCheck, UserRoundMinus, Users, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { clearAuth, ensureCsrf, getAccessToken, refreshAccess, verifyMfa, submitAuth } from '../auth/state';
import { authRequest } from '../api/transport';
import { ApiError } from '../api/errors';
import { ActionTooltip } from '../components/ActionTooltip';

async function request<T = any>(path: string, body?: unknown): Promise<T> {
  const send = async () => authRequest<T>(path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + getAccessToken(), ...(body === undefined ? {} : { 'X-CSRF-Token': await ensureCsrf() }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try { return await send(); } catch (e) {
    if (e instanceof ApiError && e.code === 'ACCESS_EXPIRED') { await refreshAccess(); return send(); }
    if (e instanceof ApiError && e.status === 401) clearAuth(true);
    throw e;
  }
}

function Action({ icon: Icon, loading, disabled, children, danger = false }: { icon: LucideIcon; loading: boolean; disabled: boolean; children: string; danger?: boolean }) {
  return <button type="submit" className={'button' + (danger ? ' button-danger' : '')} disabled={disabled} aria-busy={loading}>
    {loading ? <LoaderCircle className="icon-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}{children}
  </button>;
}

function RoleBadge({ role }: { role: string }) {
  return <span className="status-badge role-badge"><UserRound aria-hidden="true" />{role}</span>;
}

export function RoleGate({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? <Outlet /> : <section className="container admin-content access-denied">
    <div className="section-icon"><ShieldOff aria-hidden="true" /></div><h1>Không có quyền truy cập</h1>
    <Link className="button secondary" to="/dishes"><ArrowLeft aria-hidden="true" />Về thực đơn</Link>
  </section>;
}

function Password({ name = 'password', label = 'Mật khẩu hiện tại' }: { name?: string; label?: string }) {
  const id = useId(), [visible, setVisible] = useState(false);
  const hint = `${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`;
  return <div className="field"><label htmlFor={id}>{label}</label><div className="auth-input">
    <LockKeyhole aria-hidden="true" /><input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={name === 'password' ? 'current-password' : 'new-password'} required />
    <ActionTooltip label={hint}><button className="auth-password-toggle icon-button" type="button" aria-label={hint} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </button></ActionTooltip>
  </div></div>;
}

export function SecurityPage({ challenge = false }: { challenge?: boolean }) {
  const { user, status } = useAuth(), navigate = useNavigate();
  const [info, setInfo] = useState<any>(null), [setup, setSetup] = useState<any>(null), [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState(''), [pending, setPending] = useState<string | null>(null), [wait, setWait] = useState(0), [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = pending !== null;
  useEffect(() => { if (!challenge && user) request('/settings').then(setInfo).catch(e => setError(e.message)); }, [challenge, user?.id]);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function submit(e: FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault(); if (busy) return;
    setPending(action); setError(''); const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (challenge) { navigate(await verifyMfa(String(body.code)), { replace: true }); return; }
      const data = await request('/settings/' + action, body);
      if (action === 'mfa/setup') { setSetup(data); return; }
      setCodes(data.recoveryCodes ?? []); setCopied(false); setSetup(null); setDone(true); clearAuth(true);
    } catch (e) { setError((e as Error).message); if (e instanceof ApiError) setWait(e.retryAfter ?? 0); }
    finally { setPending(null); }
  }

  async function copyCodes() {
    setCopied(false); setError('');
    try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); }
    catch { setError('Không sao chép được. Hãy tải mã xuống.'); }
  }

  const factor = <div className="field"><label>Mã Authenticator hoặc recovery code<input name="code" autoComplete="one-time-code" required /></label></div>;
  const confirm = <><Password />{info?.mfaEnabled && factor}</>;
  const disabled = busy || wait > 0;
  if (!challenge && !done && !user && status !== 'loading') return <Navigate to="/login" replace />;
  return <section className="container admin-content security-content">
    <div className="page-heading"><div className="section-icon">{challenge ? <ShieldCheck aria-hidden="true" /> : <Settings aria-hidden="true" />}</div>
      <div><p className="eyebrow">THE TABLE / TÀI KHOẢN</p><h1>{challenge ? 'Xác thực hai yếu tố' : 'Cài đặt tài khoản'}</h1></div>
    </div>
    {error && <p className="notice error" role="alert">{error}{wait > 0 && ` Thử lại sau ${wait} giây.`}</p>}
    {done ? <div className="table-panel security-card recovery-result">
      <div className="card-heading"><div className="section-icon success"><CheckCircle2 aria-hidden="true" /></div><h2>Đã cập nhật bảo mật</h2></div>
      <p>Mọi phiên đã đăng xuất. Vui lòng đăng nhập lại.</p>
      {codes.length > 0 && <><p className="security-hint">Lưu các mã này ngay. Mỗi mã chỉ dùng một lần và không thể xem lại sau khi rời trang.</p>
        <pre className="recovery-codes" aria-label="Recovery code">{codes.join('\n')}</pre>
        <div className="security-actions"><button className="button secondary" type="button" onClick={() => void copyCodes()}><Copy aria-hidden="true" />Sao chép mã</button>
          <a className="button secondary" download="the-table-recovery.txt" href={'data:text/plain;charset=utf-8,' + encodeURIComponent(codes.join('\n'))}><Download aria-hidden="true" />Tải mã xuống</a></div>
        <p className="copy-status" role="status">{copied && <><Check aria-hidden="true" />Đã sao chép mã.</>}</p>
      </>}
      <Link className="button" to="/login"><LogIn aria-hidden="true" />Đăng nhập lại</Link>
    </div> : challenge ? <form className="table-panel security-card mfa-challenge" aria-busy={busy} onSubmit={e => void submit(e, 'verify')}>
      <div className="card-heading"><Smartphone aria-hidden="true" /><h2>Xác minh đăng nhập</h2></div>
      <p>Nhập mã từ ứng dụng hoặc một recovery code chưa dùng. Phiên chờ có hạn 5 phút.</p>{factor}
      <div className="security-actions"><Action icon={ShieldCheck} loading={pending === 'verify'} disabled={disabled}>Xác minh</Action>
        <button className="button secondary" type="button" disabled={busy} onClick={() => {
          setPending('cancel'); void submitAuth('/mfa/cancel').then(() => navigate('/login', { replace: true })).catch(e => setError(e.message)).finally(() => setPending(null));
        }}>{pending === 'cancel' ? <LoaderCircle className="icon-spin" aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}Đăng nhập lại / Hủy</button></div>
    </form> : <>
      <div className="table-panel security-card account-card"><div className="card-heading"><UserRound aria-hidden="true" /><h2>Thông tin tài khoản</h2></div>
        <div className="account-details"><span className="account-address"><Mail aria-hidden="true" />{user?.email}</span>{user && <RoleBadge role={user.role} />}</div>
      </div>
      {!info ? <p className="security-loading" role="status"><LoaderCircle className="icon-spin" aria-hidden="true" />Đang tải cài đặt…</p> : <>
        <div className="table-panel security-card">
          <div className="card-heading"><div className="section-icon"><ShieldCheck aria-hidden="true" /></div><div><h2>Xác thực hai yếu tố</h2><p>Thêm một lớp bảo vệ với ứng dụng Authenticator.</p></div></div>
          <div className="mfa-status"><span className={'status-badge ' + (info.mfaEnabled ? 'status-active' : 'status-neutral')}>
            {info.mfaEnabled ? <ShieldCheck aria-hidden="true" /> : <ShieldOff aria-hidden="true" />}<span>{info.mfaEnabled ? 'Đang bật' : 'Chưa bật'}</span>
          </span>{info.mfaEnabled && <span className="muted">Còn {info.recoveryRemaining} recovery code</span>}</div>
          {setup ? <form className="security-form" aria-busy={pending === 'mfa/confirm'} onSubmit={e => void submit(e, 'mfa/confirm')}>
            <div className="mfa-setup"><div className="qr-frame"><img src={setup.qr} width="240" height="240" alt="QR thiết lập Authenticator" /></div><div>
              <h3><QrCode aria-hidden="true" />Quét mã bằng Authenticator</h3><p>Secret nhập tay:</p><code className="security-secret">{setup.secret}</code>
              <p className="security-hint">Thiết lập hết hạn sau 5 phút. Nhập mã của secret mới để xác nhận.</p></div></div>{factor}
            <div className="security-actions"><Action icon={ShieldCheck} loading={pending === 'mfa/confirm'} disabled={disabled}>Xác nhận bật MFA</Action>
              <button className="button secondary" type="button" disabled={busy} onClick={() => setSetup(null)}><X aria-hidden="true" />Hủy</button></div>
          </form> : <form className="security-form" aria-busy={pending === 'mfa/setup'} onSubmit={e => void submit(e, 'mfa/setup')}>
            {confirm}<Action icon={info.mfaEnabled ? RefreshCw : Smartphone} loading={pending === 'mfa/setup'} disabled={disabled}>{info.mfaEnabled ? 'Thay Authenticator' : 'Bật MFA'}</Action>
          </form>}
          {info.mfaEnabled && !setup && <div className="security-options">{(['recovery', 'disable'] as const).map(action => <form className={'security-form' + (action === 'disable' ? ' security-danger' : '')} key={action} aria-busy={pending === 'mfa/' + action} onSubmit={e => void submit(e, 'mfa/' + action)}>
            <h3>{action === 'recovery' ? <KeyRound aria-hidden="true" /> : <ShieldOff aria-hidden="true" />}{action === 'recovery' ? 'Tạo lại recovery code' : 'Tắt MFA'}</h3>
            <p className="security-hint">{action === 'recovery' ? 'Bộ mã cũ sẽ mất hiệu lực.' : 'Tài khoản sẽ đăng nhập bằng mật khẩu.'}</p>
            <Password label="Mật khẩu xác nhận" /><div className="field"><label>Mã xác thực<input name="code" required autoComplete="one-time-code" /></label></div>
            <Action icon={action === 'recovery' ? RefreshCw : ShieldOff} danger={action === 'disable'} loading={pending === 'mfa/' + action} disabled={disabled}>{action === 'recovery' ? 'Xác nhận tạo lại' : 'Xác nhận tắt MFA'}</Action>
          </form>)}</div>}
        </div>
        <form className="table-panel security-card" aria-busy={pending === 'password'} onSubmit={e => void submit(e, 'password')}>
          <div className="card-heading"><div className="section-icon"><LockKeyhole aria-hidden="true" /></div><div><h2>Đổi mật khẩu</h2><p>Cập nhật mật khẩu để bảo vệ tài khoản.</p></div></div>
          {confirm}<Password name="newPassword" label="Mật khẩu mới" /><Password name="passwordConfirm" label="Nhập lại mật khẩu mới" />
          <p className="security-hint">Ít nhất 8 ký tự, tối đa 72 byte UTF-8. Mọi phiên sẽ đăng xuất.</p>
          <Action icon={KeyRound} loading={pending === 'password'} disabled={disabled}>Đổi mật khẩu</Action>
        </form>
      </>}
    </>}
  </section>;
}

type UserSummary = { id: string; email: string; role: string; status: string };
export function UsersPage() {
  const [query, setQuery] = useState(''), [users, setUsers] = useState<UserSummary[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState<string | null>(null), [loaded, setLoaded] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try { setUsers(await request('/users?q=' + encodeURIComponent(query))); setLoaded(true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function change(id: string, role: string) {
    setBusy(true); setChanging(id); setError('');
    try { await request('/users/' + id + '/role', { role }); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); setChanging(null); }
  }
  return <section className="container admin-content users-content">
    <div className="page-heading"><div className="section-icon"><Users aria-hidden="true" /></div><div><p className="eyebrow">THE TABLE / QUẢN TRỊ</p><h1>Quản lý editor</h1></div></div>
    <p className="muted">Tìm tài khoản đã kích hoạt để cấp hoặc thu hồi quyền editor. Hiển thị tối đa 100 kết quả.</p>
    <form className="users-search" role="search" aria-label="Tìm tài khoản" onSubmit={e => { e.preventDefault(); if (!busy) void load(); }}>
      <label className="field"><span>Email</span><span className="auth-input"><Search aria-hidden="true" /><input type="search" placeholder="Nhập email cần tìm…" value={query} onChange={e => setQuery(e.target.value)} /></span></label>
      <button className="button" disabled={busy}>{busy && !changing ? <LoaderCircle className="icon-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}Tìm kiếm</button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="table-panel"><div className="table-caption">Danh sách tài khoản<span className="count-pill">{users.length}</span></div><div className="table-scroll">
      <table className="resource-table users-table" aria-busy={busy}><thead><tr><th scope="col">Email</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{users.map(u => <tr key={u.id}><th scope="row" className="user-email">{u.email}</th><td data-label="Vai trò"><RoleBadge role={u.role} /></td>
          <td data-label="Trạng thái"><span className={'status-badge ' + (u.status === 'active' ? 'status-active' : 'status-neutral')}>{u.status === 'active' && <CheckCircle2 aria-hidden="true" />}{u.status}</span></td>
          <td data-label="Thao tác">{u.role !== 'admin' && u.status === 'active' ? <button className={'button secondary role-action' + (u.role === 'editor' ? ' role-revoke' : '')} disabled={busy} aria-busy={changing === u.id} onClick={() => void change(u.id, u.role === 'editor' ? 'viewer' : 'editor')}>
            {changing === u.id ? <LoaderCircle className="icon-spin" aria-hidden="true" /> : u.role === 'editor' ? <UserRoundMinus aria-hidden="true" /> : <UserRoundCheck aria-hidden="true" />}{u.role === 'editor' ? 'Thu hồi editor' : 'Cấp editor'}
          </button> : <span className="muted">{u.role === 'admin' ? 'Quản trị viên' : 'Chưa kích hoạt'}</span>}</td>
        </tr>)}</tbody></table>
      {loaded && !users.length && <p className="users-empty" role="status"><Search aria-hidden="true" />Không tìm thấy tài khoản phù hợp.</p>}
    </div></div>
  </section>;
}
