import nodemailer from 'nodemailer';
export interface AuthMailer {
  activation(email: string, otp: string): Promise<void>;
  reset(email: string, link: string): Promise<void>;
}
export function smtpMailer(env: NodeJS.ProcessEnv = process.env): AuthMailer {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'])
    if (!env[key] || /REPLACE_ME/.test(env[key]!)) throw new Error(`Thiếu cấu hình ${key}.`);
  const port = Number(env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !['true', 'false'].includes(env.SMTP_SECURE ?? 'false')) throw new Error('Cấu hình SMTP không hợp lệ.');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === 'true', requireTLS: env.SMTP_SECURE !== 'true',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const send = async (to: string, subject: string, text: string) => {
    await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
  };
  return {
    activation: (email, otp) => send(email, 'The Table — Kích hoạt tài khoản', `Mã kích hoạt của bạn: ${otp}\nMã có hạn 10 phút và chỉ dùng một lần.`),
    reset: (email, link) => send(email, 'The Table — Đặt lại mật khẩu', `Đặt lại mật khẩu tại: ${link}\nLiên kết có hạn 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`),
  };
}
