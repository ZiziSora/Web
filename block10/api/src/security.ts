import { Router, type Request, type Response } from 'express';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import type { AuthRepository, User } from './auth-store.js';
import type { AuthConfig } from './auth-config.js';
import { authError, opaque, tokenSessions } from './token-sessions.js';
import { digest } from './auth-store.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Buffer) { let bits = ''; for (const b of bytes) bits += b.toString(2).padStart(8,'0'); return bits.match(/.{1,5}/g)!.map(x=>alphabet[parseInt(x.padEnd(5,'0'),2)]).join(''); }
export function totp(secret: string, step: number) {
  const bits = [...secret].map(x=>alphabet.indexOf(x).toString(2).padStart(5,'0')).join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(x=>parseInt(x,2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1',key).update(counter).digest(), offset = h[19]&15;
  return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
const same = (a: string,b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function securityRoutes(db: AuthRepository, config: AuthConfig, tokens: ReturnType<typeof tokenSessions>, now: ()=>number) {
  const router = Router(), key = Buffer.from(config.mfaEncryptionKey!, 'hex');
  router.use((req,_res,next)=>{req.body??={};next();});
  const encrypt = (secret: string) => { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm',key,iv); const body = Buffer.concat([c.update(secret,'utf8'),c.final()]); return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64'); };
  const decrypt = (secret: string) => { const b = Buffer.from(secret,'base64'), c = createDecipheriv('aes-256-gcm',key,b.subarray(0,12)); c.setAuthTag(b.subarray(12,28)); return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString(); };
  const read = async (tx: AuthRepository,id: string): Promise<any> => (await tx.read('securityState',id))?.data ?? {};
  const write = (tx: AuthRepository,id: string,data: any) => tx.write('securityState',{id,data});
  const credential = (id: string) => 'mfa:'+id;
  const hashCode = (id: string,code: string) => createHmac('sha256',config.tokenSecret).update(id+':'+code).digest('hex');
  const codes = (id: string) => { const values = Array.from({length:10},()=>randomBytes(16).toString('hex')); return {values,hashes:values.map(x=>hashCode(id,x))}; };
  const cookie = {httpOnly:true,secure:config.secure,sameSite:'lax' as const,path:'/api/auth',maxAge:300000};
  const pendingToken = (req: Request) => req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('block10.mfa='))?.slice(12) ?? '';
  const verify = (state: any, code: string, id: string) => {
    if (!state.secret) return false;
    if (/^\d{6}$/.test(code)) {
      const step = Math.floor(now()/30000);
      for (const n of [step,step-1,step+1]) if (n >= 0 && n > (state.lastStep ?? -1) && same(totp(decrypt(state.secret),n),code)) { state.lastStep=n; return true; }
    } else {
      const hash = hashCode(id,code), index = (state.recovery ?? []).indexOf(hash);
      if (index >= 0) { state.recovery.splice(index,1); return true; }
    }
    return false;
  };
  const check = async (tx: AuthRepository,user: User,body: any, requireFactor=true) => {
    const state = await read(tx,credential(user.id));
    if ((state.lockedUntil ?? 0)>now()) return {error:'RATE_LIMITED',retryAfter:Math.ceil((state.lockedUntil-now())/1000),state};
    if (state.lockedUntil) { state.attempts=0; state.lockedUntil=0; }
    const ok = body.password && await bcrypt.compare(String(body.password),user.passwordHash) && (!requireFactor || !state.secret || verify(state,String(body.code ?? ''),user.id));
    if (!ok) { state.attempts=(state.attempts ?? 0)+1; if(state.attempts>=5) state.lockedUntil=now()+900000; }
    else state.attempts=0;
    await write(tx,credential(user.id),state);
    return {error:ok ? '' : state.lockedUntil ? 'RATE_LIMITED' : 'VERIFICATION_FAILED',retryAfter:state.lockedUntil ? 900 : 0,state};
  };
  const failure = (res: Response,result: {error:string;retryAfter?:number}) => { if(result.retryAfter) res.setHeader('Retry-After',String(result.retryAfter)); return authError(res,result.retryAfter ? 429 : 400,result.error,'Xác thực không hợp lệ hoặc đang bị khóa.',{retryAfter:result.retryAfter ?? 0}); };
  const revoke = async(tx: AuthRepository,user: User) => { await tx.write('user',{...user,userVersion:user.userVersion+1}); await tx.revokeUserSessions(user.id,new Date(now())); await tx.remove('securityState','setup:'+user.id); };
  async function login(tx: AuthRepository,user: User,_req: Request,_res: Response) {
    const state = await read(tx,credential(user.id));
    if (!state.secret) return tokens.create(tx,user);
    const pending=opaque(); await write(tx,'login:'+digest(pending),{userId:user.id,version:user.userVersion,expires:now()+300000});
    return {pending};
  }
  const pending = (res: Response,value: string) => { tokens.clear(res); res.cookie('block10.mfa',value,cookie); return res.json({ok:true,data:{mfaRequired:true,expiresAt:now()+300000}}); };
  router.post('/mfa/cancel',async(req,res)=>{await db.atomic(tx=>tx.remove('securityState','login:'+digest(pendingToken(req))));res.clearCookie('block10.mfa',cookie);res.json({ok:true,data:null});});
  router.post('/mfa/verify',async(req,res)=>{
    const token=pendingToken(req);
    const result=await db.atomic(async tx=>{
      const challenge=await read(tx,'login:'+digest(token)), user=challenge.userId ? await tx.read('user',challenge.userId):null;
      if(!user || user.status!=='active' || challenge.expires<=now() || challenge.version!==user.userVersion) return {error:'MFA_EXPIRED'};
      const state=await read(tx,credential(user.id));
      if(state.lockedUntil>now()) return {error:'RATE_LIMITED',retryAfter:Math.ceil((state.lockedUntil-now())/1000)};
      if(state.lockedUntil) {state.attempts=0;state.lockedUntil=0;}
      if(!verify(state,String(req.body?.code ?? ''),user.id)) {state.attempts=(state.attempts??0)+1; if(state.attempts>=5)state.lockedUntil=now()+900000; await write(tx,credential(user.id),state);return {error:state.lockedUntil?'RATE_LIMITED':'VERIFICATION_FAILED',retryAfter:state.lockedUntil?900:0};}
      state.attempts=0; await write(tx,credential(user.id),state);await tx.remove('securityState','login:'+digest(token));
      return {grant:await tokens.create(tx,user)};
    });
    if(!result.grant)return failure(res,result as any);res.clearCookie('block10.mfa',cookie);return tokens.respond(res,result.grant);
  });
  router.use('/settings',tokens.requireLogin);
  router.get('/settings',async(_req,res)=>{const s=await read(db,credential(res.locals.currentUser.id));res.json({ok:true,data:{...res.locals.currentUser,mfaEnabled:!!s.secret,recoveryRemaining:s.recovery?.length??0}});});
  router.post('/settings/mfa/setup',async(req,res)=>{
    const result=await db.atomic(async tx=>{
      const user=(await tx.read('user',res.locals.currentUser.id))!; const checked=await check(tx,user,req.body);if(checked.error)return checked;
      const secret=base32(randomBytes(20));await write(tx,'setup:'+user.id,{secret:encrypt(secret),expires:now()+300000,version:user.userVersion,attempts:0});return {secret};
    });
    if(!('secret' in result))return failure(res,result);
    const uri=`otpauth://totp/${encodeURIComponent('The Table:'+res.locals.currentUser.email)}?secret=${result.secret}&issuer=The%20Table&algorithm=SHA1&digits=6&period=30`;
    res.json({ok:true,data:{secret:result.secret,qr:await QRCode.toDataURL(uri),expiresAt:now()+300000}});
  });
  router.post('/settings/mfa/confirm',async(req,res)=>{
    const result=await db.atomic(async tx=>{
      const user=(await tx.read('user',res.locals.currentUser.id))!, setup=await read(tx,'setup:'+user.id), old=await read(tx,credential(user.id));
      if(old.lockedUntil>now())return {error:'RATE_LIMITED',retryAfter:Math.ceil((old.lockedUntil-now())/1000)};
      if(old.lockedUntil){old.attempts=0;old.lockedUntil=0;}
      if(setup.version!==user.userVersion || !setup.secret || setup.expires<=now())return {error:'MFA_EXPIRED'};
      if(!verify(setup,String(req.body?.code??''),user.id)) {old.attempts=(old.lockedUntil?0:old.attempts??0)+1;old.lockedUntil=old.attempts>=5?now()+900000:0;await write(tx,credential(user.id),old);return {error:old.lockedUntil?'RATE_LIMITED':'VERIFICATION_FAILED',retryAfter:old.lockedUntil?900:0};}
      const recovery=codes(user.id);await write(tx,credential(user.id),{secret:setup.secret,lastStep:setup.lastStep,recovery:recovery.hashes,attempts:0});await revoke(tx,user);return {recoveryCodes:recovery.values};
    });
    if(!result.recoveryCodes)return failure(res,result as any);tokens.clear(res);return res.json({ok:true,data:result});
  });
  for(const action of ['disable','recovery','password']) router.post('/settings/'+(action==='password'?'password':'mfa/'+action),async(req,res)=>{
    if(action==='password' && (typeof req.body.newPassword!=='string' || [...req.body.newPassword].length<8 || Buffer.byteLength(req.body.newPassword)>72 || req.body.newPassword!==req.body.passwordConfirm))return failure(res,{error:'VALIDATION_FAILED'});
    const result=await db.atomic(async tx=>{
      let user=(await tx.read('user',res.locals.currentUser.id))!;const checked=await check(tx,user,req.body);if(checked.error)return checked;
      let recoveryCodes: string[]|undefined;
      if(action!=='password' && !checked.state.secret)return {error:'MFA_DISABLED'};
      if(action==='disable')await tx.remove('securityState',credential(user.id));
      if(action==='recovery'){const recovery=codes(user.id);checked.state.recovery=recovery.hashes;await write(tx,credential(user.id),checked.state);recoveryCodes=recovery.values;}
      if(action==='password') {user={...user,passwordHash:await bcrypt.hash(req.body.newPassword,12)};await tx.remove('passwordReset',user.id);}
      await revoke(tx,user);return {error:'',recoveryCodes};
    });
    if(result.error)return failure(res,result);tokens.clear(res);res.json({ok:true,data:{recoveryCodes:'recoveryCodes' in result ? result.recoveryCodes??[] : []}});
  });
  router.use('/users',tokens.requireLogin,(_req,res,next)=>{if(res.locals.currentUser.role!=='admin'){authError(res,403,'FORBIDDEN','Chỉ admin được quản lý editor.');return;}next();});
  router.get('/users',async(req,res)=>res.json({ok:true,data:await db.users(String(req.query.q??'').trim().toLowerCase())}));
  router.post('/users/:id/role',async(req,res)=>{
    if(!['viewer','editor'].includes(req.body?.role))return failure(res,{error:'VALIDATION_FAILED'});
    const ok=await db.atomic(async tx=>{const actor=await tx.read('user',res.locals.currentUser.id), user=await tx.read('user',String(req.params.id));if(actor?.role!=='admin'||!user||user.status!=='active'||user.role==='admin')return false;await tx.write('user',{...user,role:req.body.role,userVersion:user.userVersion+1});await tx.revokeUserSessions(user.id,new Date(now()));return true;});
    if(!ok)return authError(res,403,'FORBIDDEN','Không thể thay đổi role tài khoản này.');res.json({ok:true,data:null});
  });
  return {router,login,pending};
}
