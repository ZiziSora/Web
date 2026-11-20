import { useEffect, useState, useId, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { clearAuth, ensureCsrf, getAccessToken, refreshAccess, verifyMfa, submitAuth } from '../auth/state';
import { authRequest } from '../api/transport';
import { ApiError } from '../api/errors';

async function request<T=any>(path: string, body?: unknown): Promise<T> {
  const send = async()=>authRequest<T>(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+getAccessToken(),...(body===undefined?{}:{'X-CSRF-Token':await ensureCsrf()})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{return await send();}catch(e){if(e instanceof ApiError && e.code==='ACCESS_EXPIRED'){await refreshAccess();return send();}if(e instanceof ApiError && e.status===401)clearAuth(true);throw e;}
}
export function RoleGate({roles}:{roles:string[]}) {const {user}=useAuth();return user && roles.includes(user.role)?<Outlet/>:<section className="container admin-content"><h1>Không có quyền truy cập</h1><Link to="/dishes">Về thực đơn</Link></section>;}
function Password({name='password',label='Mật khẩu hiện tại'}:{name?:string;label?:string}) {const id=useId();return <div className="field"><label htmlFor={id}>{label}</label><input id={id} name={name} type="password" autoComplete={name==='password'?'current-password':'new-password'} required /></div>;}
export function SecurityPage({challenge=false}:{challenge?:boolean}) {
 const {user,status}=useAuth(), navigate=useNavigate();
 const [info,setInfo]=useState<any>(null),[setup,setSetup]=useState<any>(null),[codes,setCodes]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[wait,setWait]=useState(0),[done,setDone]=useState(false);
 useEffect(()=>{if(!challenge&&user)request('/settings').then(setInfo).catch(e=>setError(e.message));},[challenge,user?.id]);
 useEffect(()=>{if(wait<=0)return;const t=setTimeout(()=>setWait(wait-1),1000);return()=>clearTimeout(t);},[wait]);
 async function submit(e:FormEvent<HTMLFormElement>,action:string){e.preventDefault();if(busy)return;setBusy(true);setError('');const body=Object.fromEntries(new FormData(e.currentTarget));
  try{if(challenge){navigate(await verifyMfa(String(body.code)),{replace:true});return;}
   const data=await request('/settings/'+action,body);
   if(action==='mfa/setup'){setSetup(data);return;}
   setCodes(data.recoveryCodes??[]);setSetup(null);setDone(true);clearAuth(true);
  }catch(e){setError((e as Error).message);if(e instanceof ApiError)setWait(e.retryAfter??0);}finally{setBusy(false);}}
 const factor=<div className="field"><label>Mã Authenticator hoặc recovery code<input name="code" autoComplete="one-time-code" required /></label></div>;
 const confirm=<><Password/>{info?.mfaEnabled&&factor}</>;
 if(!challenge&&!done&&!user&&status!=='loading')return <Navigate to="/login" replace/>;
 return <section className="container admin-content security-content"><h1>{challenge?'Xác thực hai yếu tố':'Cài đặt tài khoản'}</h1>
 {error&&<p className="notice error" role="alert">{error}{wait>0&&` Thử lại sau ${wait} giây.`}</p>}
 {done?<div className="table-panel"><h2>Đã cập nhật bảo mật</h2><p>Mọi phiên đã đăng xuất. Vui lòng đăng nhập lại.</p>{codes.length>0&&<><p>Lưu các mã này ngay. Mỗi mã chỉ dùng một lần và không thể xem lại sau khi rời trang.</p><pre>{codes.join('\n')}</pre><button type="button" onClick={()=>void navigator.clipboard.writeText(codes.join('\n')).catch(()=>setError('Không sao chép được. Hãy tải mã xuống.'))}>Sao chép mã</button> <a download="the-table-recovery.txt" href={'data:text/plain;charset=utf-8,'+encodeURIComponent(codes.join('\n'))}>Tải mã xuống</a></>}<p><Link to="/login">Đăng nhập lại</Link></p></div>:
 challenge?<form className="table-panel" onSubmit={e=>void submit(e,'')}><p>Nhập mã từ ứng dụng hoặc một recovery code chưa dùng. Phiên chờ có hạn 5 phút.</p>{factor}<button className="button" disabled={busy||wait>0}>Xác minh</button><p><button type="button" disabled={busy} onClick={()=>{setBusy(true);void submitAuth('/mfa/cancel').then(()=>navigate('/login',{replace:true})).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Đăng nhập lại / Hủy</button></p></form>:
 <><p>{user?.email} · {user?.role}</p>{!info?<p>Đang tải cài đặt…</p>:<>
 <div className="table-panel"><h2>Xác thực hai yếu tố</h2><p>{info.mfaEnabled?`Đang bật · Còn ${info.recoveryRemaining} recovery code`:'Chưa bật'}</p>
 {setup?<form onSubmit={e=>void submit(e,'mfa/confirm')}><img src={setup.qr} width="240" height="240" alt="QR thiết lập Authenticator"/><p>Secret nhập tay: <code className="security-secret">{setup.secret}</code></p><p>Thiết lập hết hạn sau 5 phút. Nhập mã của secret mới để xác nhận.</p>{factor}<button className="button" disabled={busy||wait>0}>Xác nhận bật MFA</button><button type="button" disabled={busy} onClick={()=>setSetup(null)}>Hủy</button></form>:<form onSubmit={e=>void submit(e,'mfa/setup')}>{confirm}<button className="button" disabled={busy||wait>0}>{info.mfaEnabled?'Thay Authenticator':'Bật MFA'}</button></form>}
 {info.mfaEnabled&&!setup&&<>{(['recovery','disable'] as const).map(action=><form key={action} onSubmit={e=>void submit(e,'mfa/'+action)}><h3>{action==='recovery'?'Tạo lại recovery code':'Tắt MFA'}</h3><p>{action==='recovery'?'Bộ mã cũ sẽ mất hiệu lực.':'Tài khoản sẽ đăng nhập bằng mật khẩu.'}</p><div className="field"><label>Mật khẩu xác nhận<input name="password" type="password" autoComplete="current-password" required /></label></div><div className="field"><label>Mã xác thực<input name="code" required autoComplete="one-time-code" /></label></div><button className="button secondary" disabled={busy||wait>0}>Xác nhận {action==='recovery'?'tạo lại':'tắt MFA'}</button></form>)}</>}
 </div><form className="table-panel" onSubmit={e=>void submit(e,'password')}><h2>Đổi mật khẩu</h2>{confirm}<Password name="newPassword" label="Mật khẩu mới"/><Password name="passwordConfirm" label="Nhập lại mật khẩu mới"/><p>Ít nhất 8 ký tự, tối đa 72 byte UTF-8. Mọi phiên sẽ đăng xuất.</p><button className="button" disabled={busy||wait>0}>Đổi mật khẩu</button></form></>}</>}
 </section>;
}
export function UsersPage(){const [query,setQuery]=useState(''),[users,setUsers]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{setUsers(await request('/users?q='+encodeURIComponent(query)));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 async function change(id:string,role:string){setBusy(true);try{await request('/users/'+id+'/role',{role});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="container admin-content"><h1>Quản lý editor</h1><p>Tìm tài khoản đã kích hoạt để cấp hoặc thu hồi quyền editor. Hiển thị tối đa 100 kết quả.</p><form onSubmit={e=>{e.preventDefault();void load();}}><label>Email <input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="button" disabled={busy}>Tìm kiếm</button></form>{error&&<p role="alert">{error}</p>}<div className="table-panel table-scroll"><table className="resource-table"><thead><tr><th>Email</th><th>Role</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.email}</td><td>{u.role}</td><td>{u.status}</td><td>{u.role!=='admin'&&u.status==='active'&&<button disabled={busy} onClick={()=>void change(u.id,u.role==='editor'?'viewer':'editor')}>{u.role==='editor'?'Thu hồi editor':'Cấp editor'}</button>}</td></tr>)}</tbody></table></div></section>;
}
