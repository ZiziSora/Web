# The Table — block10

React CSR + Express + Prisma/PostgreSQL, phát triển từ block9. Thêm Settings, TOTP MFA và ba role. Block9 giữ nguyên.

## Chạy cục bộ

Node >=22.12, PostgreSQL, SMTP và Google reCAPTCHA **v2 checkbox**. Frontend http://localhost:5180, API http://localhost:3010/api.

Tạo `api/.env` và `web/.env` từ `.env.example`. Trên máy đã cấu hình block9, có thể chạy `python scripts/local-setup.py`: sao chép cấu hình dịch vụ sang file riêng của block10, đổi schema/port và sinh secret mới; không ghi đè file block10 đã tồn tại. Không commit `.env`.

- `DATABASE_URL`: schema **block10**; runtime/CLI chỉ chấp nhận block10 hoặc block10_test_<hex>.
- `SESSION_SECRET`, `AUTH_TOKEN_SECRET`, `JWT_SECRET`: ngẫu nhiên riêng biệt, mỗi secret ít nhất 32 byte.
- `MFA_ENCRYPTION_KEY`: 32 byte dạng 64 ký tự hex, riêng biệt; phải giữ ổn định và sao lưu cùng cấu hình. Secret Authenticator được mã hóa AES-256-GCM bằng khóa này.
- `PORT=3010`, `SPA_ORIGIN=http://localhost:5180`, `APP_BASE_URL=http://localhost:5180`, `VITE_API_BASE_URL=http://localhost:3010/api`.
- SMTP giữ các biến `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`; cổng 587 yêu cầu STARTTLS. reCAPTCHA dùng `RECAPTCHA_SECRET_KEY` ở API và `VITE_RECAPTCHA_SITE_KEY` ở web.
- Access token mặc định 600 giây, refresh/session 28800 giây, điều chỉnh bằng `ACCESS_TOKEN_TTL_SECONDS` và `REFRESH_TOKEN_TTL_SECONDS`.
- Production yêu cầu HTTPS, cookie Secure và frontend/API cùng site; cấu hình đúng `TRUST_PROXY_HOPS` nếu có reverse proxy.

Trong thư mục block10 (PowerShell dùng `npm.cmd` nếu execution policy chặn npm.ps1):

```sh
npm ci
npm run db:generate
npm run db:inspect
npm run db:push
npm run db:search:setup
npm run data:copy
npm run data:copy -- --apply
npm run admin:create -- trannguyenduythinhhvn@gmail.com
npm run dev
```

Lệnh sao chép dùng cùng database PostgreSQL, SELECT từ schema block9 và INSERT vào block10. Đích phải chưa có dữ liệu nghiệp vụ. Sao chép Dish/Chef/Ingredient và hai bảng liên kết trong một transaction, giữ ID, cập nhật sequence, đối chiếu số lượng. Không mang tài khoản, cookie, session, OTP, reset token sang block10. Không chạy seed sau khi sao chép; `npm run seed` chỉ dùng khi muốn dữ liệu mẫu mới.

Lệnh tạo admin cần terminal tương tác, nhập mật khẩu kín hai lần. Email mặc định là `trannguyenduythinhhvn@gmail.com`; từ chối email trùng, không ghi đè tài khoản. Tài khoản được tạo active mà không gửi thư kích hoạt; mật khẩu không có trong source, tham số lệnh hay log.

`kimngan21092006@gmail.com` đăng ký và kích hoạt email bình thường; admin vào **Quản trị → Tài khoản** tìm email rồi cấp editor. Không tự cấp editor chỉ dựa trên email.

## Quyền

| Chức năng | viewer | editor | admin |
|---|---|---|---|
| Thực đơn/chi tiết công khai | Xem | Xem | Xem |
| Món ăn | Xem | CRUD | CRUD |
| Danh sách đầu bếp/nguyên liệu trong quản lý | Không | Xem/chọn | CRUD |
| Cấp/thu hồi editor | Không | Không | Có |
| Settings bản thân | Có | Có | Có |

Đăng ký luôn tạo viewer, bỏ qua role do client gửi. Admin chỉ chuyển tài khoản active giữa viewer và editor; không thay đổi admin, xóa tài khoản hoặc tạo tài khoản qua trang này. Đổi role thu hồi mọi phiên của tài khoản đích. Backend trả 403 FORBIDDEN khi thiếu quyền, frontend có route guard và ẩn thao tác.

Viewer đăng nhập xong đến `/dishes`, editor/admin đến `/admin/dishes`. `/settings` dành cho mọi role; `/admin/users` chỉ admin.

## MFA và Settings

- Hiển thị email/role; đổi mật khẩu; bật/thay/tắt Authenticator và tạo lại recovery code.
- TOTP SHA1, 6 số, 30 giây, cửa sổ ±1 bước; secret 160 bit ngẫu nhiên. QR tạo cục bộ, không qua dịch vụ ngoài.
- Bật/thay chỉ hoàn tất sau mã đúng của secret mới; setup hết hạn sau 5 phút. Thay thiết bị giữ secret cũ cho tới lúc xác nhận thành công.
- Đăng nhập đúng password/reCAPTCHA khi đã bật MFA chỉ tạo cookie `block10.mfa` HttpOnly, hạn 5 phút; chưa có access/refresh grant. Xác minh OTP hoặc recovery code tại `/mfa` mới cấp grant.
- Sai 5 lần khóa xác minh 15 phút theo tài khoản, kể cả đăng nhập lại; rate limit được lưu trong PostgreSQL. 429 có Retry-After.
- Mỗi bước TOTP chỉ chấp nhận một lần trên toàn tài khoản; cập nhật và tiêu thụ recovery/challenge trong transaction Serializable để chống request đồng thời.
- Mỗi bộ có 10 recovery code, mỗi mã 128 bit ngẫu nhiên, lưu HMAC trong database. Hiện một lần sau thao tác, có sao chép/tải xuống. Tạo bộ mới vô hiệu hóa bộ cũ.
- Thao tác bảo mật yêu cầu mật khẩu hiện tại; nếu MFA đang bật còn yêu cầu OTP hoặc recovery code. Xác nhận setup mới yêu cầu mã từ secret mới, sau bước kiểm tra yếu tố cũ lúc bắt đầu setup.
- Đổi mật khẩu, bật/thay/tắt MFA hoặc tạo lại recovery code thu hồi mọi phiên. Kết quả vẫn cho lưu recovery code mới trước khi đăng nhập lại.
- Reset mật khẩu không tắt MFA. Chưa có chức năng admin/email bỏ qua MFA nếu mất cả ứng dụng và recovery code.

## API bổ sung

Giữ envelope `{ok:true,data}` / `{ok:false,error:{code,message,retryAfter?}}`. Mọi POST yêu cầu CSRF và kiểm tra origin; Settings/users yêu cầu Bearer.

| API dưới `/api/auth` | Hành vi |
|---|---|
| POST /login | Grant hiện có hoặc `{mfaRequired:true,expiresAt}` và cookie chờ |
| POST /mfa/verify | `{code}` → access/refresh grant sau tiêu thụ challenge |
| GET /settings | Email, role, mfaEnabled, recoveryRemaining |
| POST /settings/mfa/setup | `{password,code?}` → QR, secret mới, expiresAt |
| POST /settings/mfa/confirm | `{code}` của secret mới → recoveryCodes, thu hồi mọi phiên |
| POST /settings/mfa/disable | `{password,code}` → tắt MFA, thu hồi mọi phiên |
| POST /settings/mfa/recovery | `{password,code}` → bộ recovery mới, thu hồi mọi phiên |
| POST /settings/password | `{password,code?,newPassword,passwordConfirm}` → đổi mật khẩu, thu hồi mọi phiên |
| GET /users?q=email | Admin: tối đa 100 tài khoản theo email, gồm id/email/role/status |
| POST /users/:id/role | Admin: `{role:"viewer"|"editor"}` |

Access token chỉ ở bộ nhớ, refresh cookie HttpOnly xoay vòng; version tài khoản/phiên kiểm tra database mỗi request. Cookie/JWT/BroadcastChannel dùng namespace block10. Không log password/OTP/secret/token.

## Kiểm thử

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:security:browser
npm run test:preview
npm run test:db
```

API tests dùng MemoryAuthRepository, mailer và CAPTCHA fixture qua dependency injection. Browser tests dùng Chrome headless, hỗ trợ `CHROME_PATH`, mock widget Google chỉ trong fixture. Ảnh tại `artifacts/` (gitignored). Security browser suite kiểm tra Settings/MFA ở desktop 1440 và mobile 390, QR, recovery hiển thị sau logout, reload phiên chờ, đăng nhập recovery, tắt MFA.

DB integration chỉ dùng `AUTH_TEST_DATABASE_URL` do người chạy truyền riêng; không tự lấy database ứng dụng. Test tạo/drop schema `block10_test_<hex>` riêng. Thiếu biến sẽ SKIP. Các test giả lập không chứng minh SMTP/Google thật đã gửi/xác minh thành công.

Build không tự push schema, copy dữ liệu hoặc tạo admin. Không commit credential.

Kết quả kiểm tra triển khai: typecheck, build, 42 API/unit tests, toàn bộ browser suite, production preview và hai PostgreSQL integration tests đã qua. PostgreSQL integration gồm MFA/recovery cạnh tranh và khởi tạo ứng dụng lại.

`npm audit` hiện còn ba cảnh báo high thuộc chuỗi dependency công cụ `prisma → @prisma/config → effect` kế thừa từ nền tảng. Không chạy `audit fix --force` vì đề xuất hạ major Prisma, không tương thích cấu hình hiện tại.
