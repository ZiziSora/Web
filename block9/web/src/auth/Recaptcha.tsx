import { useEffect, useRef, useState } from 'react';
interface RecaptchaApi {
  render(container: HTMLElement, options: { sitekey: string; callback(token: string): void; 'expired-callback'(): void; 'error-callback'(): void }): number;
  reset(id: number): void;
}
declare global { interface Window { grecaptcha?: RecaptchaApi; block9RecaptchaReady?: () => void } }
let loader: Promise<RecaptchaApi> | null = null;
function load() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  return loader ??= new Promise<RecaptchaApi>((resolve, reject) => {
    const script = document.createElement('script');
    let timer: ReturnType<typeof setTimeout>;
    const fail = () => { clearTimeout(timer); loader = null; script.remove(); reject(new Error('Không tải được reCAPTCHA. Kiểm tra kết nối và thử lại.')); };
    window.block9RecaptchaReady = () => { clearTimeout(timer); if (window.grecaptcha) resolve(window.grecaptcha); else fail(); };
    script.src = 'https://www.google.com/recaptcha/api.js?onload=block9RecaptchaReady&render=explicit&hl=vi';
    script.async = true; script.defer = true; script.onerror = fail;
    timer = setTimeout(fail, 15000);
    document.head.append(script);
  });
}
export function Recaptcha({ resetKey, onChange }: { resetKey: number; onChange(token: string): void }) {
  const container = useRef<HTMLDivElement>(null), change = useRef(onChange);
  change.current = onChange;
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true, id: number | undefined, api: RecaptchaApi | undefined;
    const sitekey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!sitekey || /REPLACE_ME/.test(sitekey)) { setError('Chưa cấu hình site key reCAPTCHA.'); return; }
    setError(''); change.current('');
    const target = document.createElement('div'); container.current?.append(target);
    void load().then(value => {
      if (!active) return;
      api = value;
      id = value.render(target, { sitekey,
        callback: token => { if (active) { setError(''); change.current(token); } },
        'expired-callback': () => { if (active) { change.current(''); setError('Xác minh đã hết hạn. Vui lòng xác minh lại.'); } },
        'error-callback': () => { if (active) { change.current(''); setError('reCAPTCHA gặp lỗi. Vui lòng thử lại.'); } },
      });
    }).catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; if (id !== undefined) api?.reset(id); target.remove(); };
  }, [resetKey, attempt]);
  return <div className="field recaptcha-field"><span className="field-label">Xác minh bảo mật</span><div ref={container} />
    {error && <><p role="alert" className="field-error">{error}</p><button type="button" className="text-button" onClick={() => setAttempt(x => x + 1)}>Thử lại reCAPTCHA</button></>}
  </div>;
}
