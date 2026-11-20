export interface CaptchaVerifier { verify(token: string): Promise<boolean> }
export class CaptchaUnavailable extends Error {}

export function googleRecaptcha(secret: string, hostname: string, request: typeof fetch = fetch): CaptchaVerifier {
  if (!secret || /REPLACE_ME|CHANGE_ME/.test(secret)) throw new Error('Thiếu RECAPTCHA_SECRET_KEY.');
  return {
    async verify(token) {
      if (!token || token.length > 8192) return false;
      try {
        const response = await request('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST', body: new URLSearchParams({ secret, response: token }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new CaptchaUnavailable();
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('success' in body) || typeof body.success !== 'boolean') throw new CaptchaUnavailable();
        const data = body as { success: boolean; hostname?: string; 'error-codes'?: string[] };
        if (data['error-codes']?.some(code => ['invalid-input-secret', 'missing-input-secret', 'bad-request'].includes(code))) throw new CaptchaUnavailable();
        return data.success && data.hostname === hostname;
      } catch { throw new CaptchaUnavailable('Không thể xác minh reCAPTCHA. Vui lòng thử lại.'); }
    },
  };
}
