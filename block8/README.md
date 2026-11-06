# The Table — block8 (SSR)

Bản SSR của `block7`, chạy độc lập bằng Express 5, EJS, TypeScript, Prisma 7 và PostgreSQL. Server trả HTML đã chứa thực đơn, bảng quản trị và form; JavaScript chỉ bổ sung tương tác. Cả ba danh sách đều tìm/sort/phân trang tại server, 6 mục mỗi trang.

## Chạy ứng dụng

Yêu cầu Node.js >=22.12 và npm. Chạy các lệnh trong `block8`:

```sh
npm ci
cp .env.example .env
# Tự điền DATABASE_URL, APP_BASE_URL, hai secret riêng và SMTP theo phần Authentication bên dưới.
npm run db:generate
npm run db:inspect
```

`DATABASE_URL` dùng cùng máy chủ PostgreSQL cũng được, nhưng schema nghiệp vụ phải là **block8**. Ví dụ template: `postgresql://USER:PASSWORD@HOST:5432/postgres?schema=block8`. Nếu thiếu query `schema`, mọi entrypoint tự bổ sung `block8`. Cấu hình từ chối `public`, `block7` và schema ngoài phạm vi; integration test được phép dùng `block8_test_<hex>`. Giữ các query kết nối khác như `sslmode` khi thêm `schema`. Không đưa `.env` vào Git.

Sau khi kiểm tra schema trống hoặc tương thích:

```sh
npm run db:push
npm run db:search:setup
npm run seed
npm run dev
```

Mở **http://localhost:3008/dishes**. Biến `PORT` đổi cổng. Không dùng `--accept-data-loss` hoặc reset để vượt cảnh báo schema.

Startup/build không tự sửa schema hoặc seed. Setup search bật `unaccent`/`pg_trgm` nếu chưa có (cần quyền tạo extension), giữ vị trí extension hiện có, tạo function/trigger/index trong schema đích và backfill riêng cột tìm kiếm. Chạy lại setup sau khi tạo lại bảng. Seed tạo 1.000 món, 20 đầu bếp, 20 nguyên liệu; chạy lại bỏ qua tên mẫu đã tồn tại, giữ giá và quan hệ người dùng đã sửa. Đầu bếp/nguyên liệu hiện có được tính vào ngưỡng 20, không bị xóa khi vượt ngưỡng. Đổi tên món mẫu rồi seed lại có thể tạo thêm món mang tên mẫu cũ.

Production:

```sh
npm run build
npm start
```

Khi chạy production, giữ `views/`, `public/`, `.env`, dependencies và `dist/` cùng thư mục dự án. Không phụ thuộc source của các block khác.

## SSR và các đường dẫn

| Method | Đường dẫn | Hành vi |
| --- | --- | --- |
| GET | `/`, `/admin` | Chuyển tới danh sách tương ứng |
| GET | `/dishes` | Thực đơn sách, tìm kiếm và bộ lọc |
| GET | `/dishes/:id` | Chi tiết món và quan hệ |
| GET | `/admin/{resource}` | Bảng quản trị, tìm/sort/phân trang server |
| GET | `/admin/{resource}/new` | Form tạo |
| POST | `/admin/{resource}` | Tạo rồi redirect 303 |
| GET | `/admin/{resource}/:id/edit` | Form sửa |
| PATCH | `/admin/{resource}/:id` | Sửa rồi redirect 303 |
| GET | `/admin/{resource}/:id/delete` | Xác nhận xóa, không ghi dữ liệu |
| DELETE | `/admin/{resource}/:id` | Xóa rồi redirect 303 |

`resource` là `dishes`, `chefs`, `ingredients`. Browser gửi form POST với `_method=PATCH` hoặc `_method=DELETE`; không override qua GET, query hoặc header. Không có REST API JSON cho frontend.

Validation trả 400, giữ nội dung và checkbox đã chọn, kể cả ID quan hệ vừa bị xóa. ID/URL/bản ghi không tồn tại trả 404; lỗi hệ thống trả trang 500 thân thiện, có link thử lại, không lộ chuỗi kết nối. Thành công dùng POST → 303 → GET nên reload trang đích không lặp ghi. Thông báo thành công lấy từ mã cố định trên URL.

Giữ quy tắc của block7: giá Decimal(12,2), văn bản trim/giới hạn độ dài, quan hệ nhiều–nhiều; xóa đầu bếp hoặc món chỉ gỡ liên kết liên quan. Nguyên liệu đang được dùng không được xóa; kiểm tra lại trong transaction lúc ghi. Trang xóa dùng token có chữ ký gắn tài nguyên/ID, hết hạn 30 phút và hết hiệu lực khi restart. Toàn bộ /admin yêu cầu đăng nhập tài khoản active; thực đơn /dishes vẫn công khai.

## Tìm kiếm, URL và JavaScript bổ trợ

Ví dụ: `/admin/dishes?q=nam&category=Vườn+xanh&minPrice=50000&available=true&sort=price-asc&page=2`.

- `q`, `sort`, `page`, `category`, `minPrice`, `maxPrice`, `available` nằm trên URL. Link phân trang/chip giữ các điều kiện còn lại; form đổi điều kiện bắt đầu ở trang 1. Trang sai định dạng về 1; trang vượt cuối chuyển hướng tới trang hợp lệ. Điều kiện tìm/lọc sai trả 400.
- Thực đơn tìm full-text trên tên (trọng số A) và mô tả (B), cấu hình `simple`; không có kết quả thì tìm fuzzy tên, ngưỡng similarity >=0.3, có nhãn gợi ý. Khi có từ khóa, độ phù hợp được ưu tiên trước lựa chọn sort. Quản trị cả ba tài nguyên tìm một phần tên không phân biệt hoa/thường/dấu. `%`, `_`, `\` là ký tự literal.
- Bộ lọc món kết hợp AND trước phân trang, khoảng giá gồm cả biên; danh mục lấy DISTINCT từ database. Sort tên/giá thêm ID làm tie-break. Count/chọn ID/tải bản ghi trong cùng transaction Repeatable Read; ghi dùng Serializable và retry xung đột có giới hạn.
- Với JavaScript: tìm kiếm debounce 300 ms, Enter gửi ngay và hủy timer; IME chờ composition kết thúc. Dropdown gửi ngay. Mỗi thay đổi danh sách tải **document HTML mới**, không fetch JSON hoặc hydrate React. ←/→ chuyển trang khi không nhập liệu; Back/Forward/reload dùng lịch sử và URL của browser.
- Thực đơn giữ hai lá sách trên desktop và một cột trên mobile. Hiệu ứng giấy trong lúc điều hướng và khi vào trang mới hoạt động bổ trợ, không trì hoãn request. Reduced motion tắt lật sách/chuyển động minh họa. Minh họa có nút tạm dừng/tiếp tục.
- Server render đủ checkbox đầu bếp/nguyên liệu. JavaScript hiển thị 6 mục đầu, tìm tên cục bộ, chip, tải thêm đầu bếp và cuộn mở rộng nguyên liệu theo nhóm 6, có nút dự phòng. Ẩn checkbox không disable hoặc bỏ khỏi DOM, nên quan hệ vẫn được submit đầy đủ. Enter trong ô tìm picker không submit form món. Không có request bổ sung khi tìm/tải thêm/cuộn picker.
- Bảng đầu bếp/nguyên liệu hiển thị hai món xem trước; `details` mở toàn bộ trong khung cuộn 220 px, JavaScript thêm ô lọc tên.
- **Tắt JavaScript:** tìm kiếm, bộ lọc, phân trang và CRUD dùng link/form; tất cả checkbox vẫn có sẵn trong khung cuộn; danh sách liên quan mở bằng `details`. Không khôi phục form chưa lưu hoặc số nhóm picker đã mở khi reload.

So với block7: HTML không còn là shell React cần fetch mới có dữ liệu; backend gọi store trực tiếp để render EJS. Đầu bếp/nguyên liệu chuyển từ phân trang client sang server. Trình duyệt nhận lại HTML khi đổi trang/điều kiện hoặc lưu form, đổi lại chức năng chính dùng được khi JavaScript bị tắt.

## Kiểm thử

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:db
```

- HTTP tests và browser tests dùng MemoryStore nghiệp vụ, MemoryAuthRepository và mailer riêng, không ghi database thật. Kiểm tra HTML đã render, cả ba CRUD, 400 giữ input/quan hệ, 303/reload, query/phân trang, escape HTML, xác nhận xóa, chặn xóa nguyên liệu, 404/500 và assets.
- Chrome tests dùng `/usr/bin/google-chrome`, hoặc đặt `CHROME_PATH`. Kiểm tra 1440/390 px, bật/tắt JavaScript, document navigation, Back/Forward, debounce/IME/Enter, bàn phím, picker giữ checkbox ẩn, reduced motion và tràn ngang. Khi có bản build, kiểm tra thêm startup của bản build production và static assets (không kết nối database thật). Ảnh ở `artifacts/` (gitignored).
- Database tests cần AUTH_TEST_DATABASE_URL được cung cấp riêng và quyền tạo schema/extension; không tự đọc .env. Chỉ tạo/ghi/xóa schema ngẫu nhiên `block8_test_*`; kiểm tra seed lặp, Decimal, quan hệ, xung đột xóa, phân trang 0/1/6/7/13 mục, phân trang server cho ba resource, full-text/fuzzy thật, wildcard, trigger/index và EXPLAIN. Không dùng MemoryStore để kết luận chất lượng tìm kiếm PostgreSQL.

Cấu trúc: `src/` chứa Express/domain/store/config; `views/` chứa EJS; `public/` chứa CSS/JavaScript/vector; `prisma/` chứa schema/seed; `test/`, `integration/`, `scripts/` chứa kiểm thử và lệnh quản trị. Prisma Client được generate vào `src/generated/` và không commit.

## Authentication (Block 8)

Chỉ `/admin` yêu cầu đăng nhập; `/dishes` và `/dishes/:id` công khai. Các form tài khoản render EJS bằng tiếng Việt và hoạt động khi tắt JavaScript. Mọi user `active` được dùng CRUD; role mặc định `viewer` là nhãn của bài tập, chưa có RBAC.

### Cấu hình và khởi chạy

Tự sao chép `.env.example` thành `.env` rồi điền cấu hình. Agent không đọc/sửa `.env` và không tự chạy đồng bộ schema/seed. Các module dùng chung không tự nạp dotenv; chỉ entrypoint server/Prisma CLI/lệnh quản trị nạp khi bạn tự chạy.

- `DATABASE_URL`: PostgreSQL, schema `block8` (giữ query kết nối khác như `sslmode`).
- `APP_BASE_URL`: origin của ứng dụng, ví dụ `http://localhost:3008`; production bắt buộc HTTPS. Link reset lấy từ đây, không lấy từ header Host.
- `SESSION_SECRET`, `AUTH_TOKEN_SECRET`: hai giá trị ngẫu nhiên **khác nhau**, mỗi giá trị ít nhất 32 byte; giữ ổn định qua restart. Có thể tự chạy `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` hai lần để tạo, rồi tự dán vào `.env`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: tài khoản SMTP của bạn. Cổng 587 dùng `SMTP_SECURE=false` và yêu cầu STARTTLS; cổng 465 dùng `true`. Không tắt kiểm tra chứng chỉ TLS. Không fallback sang log OTP/token nếu gửi thất bại.
- `NODE_ENV=production` bật cookie Secure; proxy phải chuyển đúng HTTPS. `TRUST_PROXY_HOPS=0` khi chạy trực tiếp; chỉ đặt đúng số hop khi các proxy đó đáng tin cậy. Không tin tùy ý `X-Forwarded-For` từ Internet.
- `PORT=3008` mặc định. Thiếu cấu hình auth/SMTP bắt buộc thì server từ chối khởi chạy.

Sau khi điền cấu hình, **bạn tự chạy** trong `block8`:

```sh
npm ci
npm run db:generate
npm run db:inspect
# Đối chiếu schema trước khi đồng bộ: chỉ thêm 6 bảng auth và index, giữ dữ liệu hiện có.
npm run db:push
# Nếu setup mới, thực hiện db:search:setup và seed như hướng dẫn đầu tài liệu.
npm run dev
```

Không dùng reset, drop schema hoặc `--accept-data-loss` để vượt cảnh báo. Startup/build không tự thay đổi schema hay tạo tài khoản. Không có user seed, password mặc định hoặc route bypass. Nếu schema đã tồn tại, vẫn phải kiểm tra diff trước `db:push` vì Prisma quản lý cả bảng nghiệp vụ.

### Hợp đồng và luồng

```mermaid
flowchart TD
  R[Đăng ký + CAPTCHA] --> P[User pending + email OTP]
  P --> A[POST /activate xác minh OTP]
  A --> U[User active, không tự đăng nhập]
  U --> L[POST /login + password bcrypt]
  L --> S[Đổi sid, lưu session PostgreSQL]
  S --> C[Middleware cho toàn bộ /admin]
  S --> O[POST /logout: hủy session, xóa cookie]
  F[POST /forgot] --> E[Email link reset]
  E --> G[GET /reset: chỉ hiện form]
  G --> Q[POST /reset: đổi password, tiêu thụ token]
  Q --> X[Hủy mọi session cũ, quay lại login]
```

| Route | Hành vi |
|---|---|
| `GET/POST /register` | Chuẩn hóa email; CAPTCHA trước bcrypt/tạo user/gửi email. Bỏ qua role từ request. Email trùng không đổi password, status hoặc gửi lại mã. Cùng 303 đến trang activate cho email mới/trùng. |
| `GET/POST /activate` | OTP 6 chữ số, chỉ dùng cho purpose activation; mã sai/hết hạn/đã dùng cùng lỗi. Đúng đặt active và emailVerifiedAt; không tự đăng nhập. |
| `POST /activate/resend` | Mã mới thay mã cũ, giữ attempts; bị khóa hoặc vượt giới hạn trả 429. |
| `GET/POST /login` | Lỗi chung cho email không tồn tại, password sai hoặc pending. Đúng regenerate sid, lưu trước 303 tới `/admin/dishes`. |
| `/admin` và mọi route con | Chưa xác thực hoặc user không còn active: 303 `/login`, trước xử lý CRUD/CSRF; không đổi dữ liệu. |
| `POST /logout` | Hủy session phía server, xóa cookie; sid cũ bị từ chối, kể cả response đang chạy cố lưu lại. |
| `GET/POST /forgot` | Cùng nội dung và status cho email có/không có; gửi link cho user active. Token mới vô hiệu token cũ. |
| `GET /reset?token=...` | Kiểm tra nhưng không tiêu thụ token; chỉ ghi digest vào anonymous session cho form tiếp theo. Không echo raw token vào HTML. |
| `POST /reset` | Đổi password và tiêu thụ token trong transaction; tăng authVersion, hủy mọi session của user. 303 tới login, không tự đăng nhập. |

Email trim + lowercase, không bỏ dấu chấm hoặc `+tag`. Password **ít nhất 8 ký tự Unicode và tối đa 72 byte UTF-8**, không trim; server từ chối vượt giới hạn thay vì để bcrypt cắt ngầm. Dùng `await bcrypt.hash(password, 12)` / `await bcrypt.compare`, salt ngẫu nhiên do bcrypt tạo. Chỉ lưu hash bcrypt.

Session lưu PostgreSQL, cookie `sid` là định danh ngẫu nhiên có chữ ký; database chỉ lưu SHA-256 của sid cùng userId, dữ liệu session và expiresAt. Cookie HttpOnly, SameSite=Lax, Path=/, Secure ở production; thời hạn cố định 8 giờ, không kéo dài theo hoạt động. Middleware kiểm tra status và authVersion mỗi request để session cũ không được dùng sau reset. Session secret và store phải ổn định qua restart.

CAPTCHA dùng thư viện svg-captcha vẽ chuỗi ngẫu nhiên từ crypto bằng SVG paths, không phải phép tính tự viết. Chỉ ảnh hiển thị ra trình duyệt; không có đáp án trong hidden field, cookie, alt text hay log. Server lưu HMAC gắn challengeId, phiên ẩn danh và purpose, hạn 5 phút. Thử một lần sẽ tiêu thụ thử thách, kể cả sai đáp án; tải lại form lấy ảnh mới. CAPTCHA đúng không xóa bộ đếm login sai.

OTP lưu HMAC gắn user + activation; reset token là 32 byte ngẫu nhiên, lưu SHA-256. Không đưa password/OTP/token vào log hoặc response (OTP và link reset chỉ gửi đến email). Xác minh/tiêu thụ OTP, CAPTCHA, reset và cập nhật bộ đếm dùng transaction Serializable, retry xung đột có giới hạn.

Mọi form POST/PATCH/DELETE có synchronizer CSRF token gắn session, kể cả login/register/logout/reset và form `_method`. Thiếu/sai trả 403; người chưa đăng nhập gọi `/admin` vẫn được ưu tiên 303 `/login`. GET không kích hoạt tài khoản, đổi password, đánh dấu mã đã dùng hoặc sửa dữ liệu nghiệp vụ; GET form có thể cấp anonymous session/CAPTCHA.

### Giới hạn tại server

| Cơ chế | Giới hạn |
|---|---|
| Login theo email | Cửa sổ 15 phút; CAPTCHA từ lần sai thứ 3; sai 10 lần khóa 15 phút tính từ lần thứ 10 |
| Login theo IP | 60 request/15 phút, kể cả request thiếu CAPTCHA |
| Register theo IP | 10 request/giờ |
| OTP | Hạn 10 phút; sai 5 lần khóa 15 phút; hết thời gian khóa được thử lại |
| Gửi OTP | Chờ 60 giây; tối đa 5 lần/giờ/email và 20 lần/giờ/IP, tính cả lần đăng ký đầu tiên |
| Xác minh OTP theo IP | 60 request/15 phút |
| Forgot | 5 request/giờ/email và 20 lần/giờ/IP |
| Reset | Token hạn 30 phút; POST tối đa 20 request/giờ/IP |
| Cấp CAPTCHA | 60 thử thách/phút/IP |

Khóa bộ đếm email/IP được HMAC trước khi lưu. Tất cả bộ đếm nằm PostgreSQL, không phụ thuộc cookie hoặc bộ nhớ tiến trình. Vượt giới hạn trả HTML 429 cùng Retry-After, dù password/CAPTCHA đúng. Giải CAPTCHA hoặc resend OTP không đặt lại số lần sai. Đăng nhập thành công xóa bộ đếm sai theo email; rate limit theo IP vẫn giữ nguyên.

Lỗi SMTP được ghi bằng thông báo cố định không chứa credential/email/OTP/token; phản hồi công khai vẫn chung. Nếu thư không đến, kiểm tra SMTP và yêu cầu gửi lại sau cooldown; resend trước đó có thể đã vô hiệu mã cũ dù gửi thư thất bại.

### Kiểm thử và nghiệm thu

```sh
npm run typecheck
npm test
npm run build
# Windows PowerShell: $env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:browser
```

HTTP/browser tests dùng dependency giả cho database/email/thời gian; CAPTCHA browser dùng bộ vẽ thật với đáp án giữ trong test harness tại server. Không gửi email hoặc ghi database thật. Kiểm tra mật khẩu 7/8 ký tự, 72 byte và Unicode; đăng ký/CAPTCHA/role injection; OTP sai/hết hạn/dùng lại/resend/lock; session rotation/restart/logout/CSRF; login CAPTCHA và khóa không mất khi đổi cookie; forgot đồng nhất; reset hết hạn/đồng thời/hủy session; SMTP lỗi không lộ bí mật. Các kiểm thử CRUD cũ đăng nhập thật và gửi CSRF.

Browser chạy desktop 1440 và mobile 390, bật/tắt JavaScript: đăng ký với CAPTCHA ảnh thật, kích hoạt OTP, login/logout, forgot/reset và toàn bộ CRUD. Kiểm tra không tràn ngang, chụp ảnh trong artifacts; smoke test bản build production chỉ dùng static assets, không giả định database kết nối được.

Integration PostgreSQL yêu cầu **AUTH_TEST_DATABASE_URL được truyền riêng trong môi trường**, không tự đọc `.env` hoặc dùng DATABASE_URL của ứng dụng:

```powershell
# Tự đặt $env:AUTH_TEST_DATABASE_URL bằng kết nối dành riêng cho test, có quyền tạo schema/extension.
npm run test:db
```

Mỗi test chỉ tạo/ghi/drop schema `block8_test_<hex>` do chính nó sinh. Auth integration kiểm tra session qua tái tạo Prisma client/app, OTP/reset đồng thời chỉ thành công một lần và bộ đếm đồng thời không bị mất cập nhật. Không dùng MemoryAuthRepository để kết luận về độ bền PostgreSQL. Khi chưa được cung cấp kết nối test, DB integration và gửi SMTP thật chưa được xác minh.

### Các file thay đổi cho authentication

- Runtime: `src/auth.ts`, `src/auth-store.ts`, `src/auth-config.ts`, `src/auth-mail.ts`, `src/app.ts`, `src/server.ts`, `src/config.ts`, `src/db.ts`.
- Dữ liệu/cấu hình: `prisma/schema.prisma`, `prisma/seed.ts`, `.env.example`, `package.json`, `package-lock.json`.
- Giao diện: `views/auth/form.ejs`, `views/partials/header.ejs`, `views/admin/form.ejs`, `views/admin/delete.ejs`, `public/styles.css`.
- Kiểm thử/công cụ: `test/auth-fixture.ts`, `test/auth.test.ts`, `test/app.test.ts`, `integration/auth-database.ts`, `integration/database.ts`, `scripts/browser-check.ts`, `scripts/db-inspect.ts`.
- Tài liệu: `README.md`.
