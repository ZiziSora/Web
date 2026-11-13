# The Table — block9

React CSR + Express JSON API + Prisma/PostgreSQL. Giữ nghiệp vụ và giao diện block7; thêm các luồng tài khoản block8, Google reCAPTCHA v2 checkbox, JWT access token và refresh token rotation. Block7/block8 không bị thay đổi.

## Cấu hình và chạy

Cần Node >=22.12, PostgreSQL (có thể dùng Supabase), SMTP và cặp khóa Google reCAPTCHA **v2 checkbox**. Tự tạo `api/.env` từ `api/.env.example` và `web/.env` từ `web/.env.example`. Không commit credential.

- `DATABASE_URL`: kết nối PostgreSQL với `?schema=block9`; giữ các query kết nối khác như `sslmode`. Runtime/CLI/seed/search chỉ chấp nhận `block9` hoặc schema test `block9_test_<hex>`, tránh trỏ nhầm block khác.
- `PORT=3009`, `SPA_ORIGIN=http://localhost:5179`, `APP_BASE_URL=http://localhost:5179`. Hai origin frontend phải khớp. Link email reset lấy từ APP_BASE_URL, không lấy header Host.
- `ACCESS_TOKEN_TTL_SECONDS=600`: hạn access token tính bằng giây. `REFRESH_TOKEN_TTL_SECONDS=28800`: hạn cố định của phiên đăng nhập/refresh token từ lúc login. Chỉ nhận số nguyên dương; bỏ trống hoặc giá trị sai làm server từ chối khởi chạy. Không khai báo thì dùng mặc định 600/28800 giây. Restart API sau khi sửa. Session ẩn danh CSRF/reset giữ hạn riêng 8 giờ.
- `SESSION_SECRET`, `AUTH_TOKEN_SECRET`, `JWT_SECRET`: ba secret ngẫu nhiên **khác nhau**, mỗi secret ít nhất 32 byte, ổn định qua restart. Có thể tự chạy `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` ba lần rồi điền các kết quả riêng.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: 587 với `SMTP_SECURE=false` yêu cầu STARTTLS; 465 dùng `true`. Không fallback sang log OTP/token khi gửi thư lỗi.
- `RECAPTCHA_SECRET_KEY` chỉ ở API; `VITE_RECAPTCHA_SITE_KEY` là site key công khai ở frontend. Cho phép `localhost` trong cấu hình domain của Google; backend kiểm tra hostname khớp SPA_ORIGIN. Không dùng khóa v3 hoặc Enterprise API thay cho khóa v2/SiteVerify.
- `VITE_API_BASE_URL=http://localhost:3009/api`. Khi thay frontend origin, cập nhật đồng thời các cấu hình origin và domain Google.
- Production bắt buộc HTTPS, cookie Secure. Chạy frontend/API cùng site (ví dụ qua reverse proxy `/api`) để cookie SameSite=Lax hoạt động; không giả định hai domain khác site sẽ dùng được cookie này. `TRUST_PROXY_HOPS=0` khi chạy trực tiếp; chỉ đặt đúng số proxy tin cậy khi triển khai.

Sau khi tự điền cấu hình, chạy trong `block9`:

```sh
npm ci
npm run db:generate
npm run db:inspect
# Kiểm tra schema đích trước khi đồng bộ; không dùng reset hoặc --accept-data-loss.
npm run db:push
npm run db:search:setup
npm run seed
npm run dev
```

Mở http://localhost:5179. API ở http://localhost:3009/api. Seed tạo đủ 1.000 món, 20 đầu bếp và 20 nguyên liệu theo cơ chế idempotent của block7, không xóa/ghi đè dữ liệu đã có. Không có user/password seed: đăng ký tài khoản, nhận OTP email rồi kích hoạt để đăng nhập.

Build và chạy bản production cục bộ:

```sh
npm run build
npm run preview
```

`npm run build` chỉ generate Prisma Client và build TypeScript/Vite; build/start không tự đồng bộ schema, seed hay gửi email. Modules dùng chung không tự đọc dotenv; chỉ entrypoint/CLI/lệnh quản trị nạp cấu hình khi được chạy.

## Access token, refresh token và versioning

Access token là JWT HS256, hạn theo `ACCESS_TOKEN_TTL_SECONDS` (mặc định 10 phút), chứa `sub`, `sid`, `userVersion`, `sessionVersion`, `iat`, `exp`, issuer `the-table-block9` và audience `the-table-block9-api`. Token giữ trong bộ nhớ React, gửi bằng `Authorization: Bearer ...`; không lưu localStorage/sessionStorage. API kiểm tra chữ ký, thuật toán, issuer, audience, hạn và **trạng thái/version hiện tại trong database ở mỗi lần xác thực**, không cache version.

Mỗi login tạo AuthSession riêng, hạn cố định theo `REFRESH_TOKEN_TTL_SECONDS` (mặc định 8 giờ). Refresh token là chuỗi ngẫu nhiên 32 byte; database chỉ lưu SHA-256. Cookie `block9.refresh` là HttpOnly, SameSite=Lax, Path=/api/auth, Secure ở production, không có Domain. Thay đổi refresh TTL áp dụng cho phiên tạo bởi lần login mới; các phiên đang có giữ expiresAt đã lưu. Giảm access TTL cũng khiến JWT cũ có thời lượng dài hơn cấu hình mới bị từ chối khi kiểm tra. Token mới không vượt hạn phiên; access token cuối cũng bị giới hạn bởi mốc này.

| Thao tác | Version | Refresh token |
| --- | --- | --- |
| Refresh thành công | Giữ nguyên | Tiêu thụ token cũ, cấp token mới |
| Logout | Tăng sessionVersion, thu hồi phiên hiện tại | Thu hồi mọi token của phiên đó |
| Reset mật khẩu | Tăng userVersion, thu hồi mọi phiên | Thu hồi toàn bộ token của user |

Token đã dùng bị gửi lại làm thu hồi phiên tương ứng. Lịch sử refresh token được giữ để phát hiện replay; việc đổi token/thu hồi dùng transaction Serializable có retry xung đột giới hạn. Logout/reset có hiệu lực từ lần kiểm tra quyền tiếp theo, không hoàn tác request đã được cho phép chạy.

Reload mất access token trong bộ nhớ: frontend lấy CSRF rồi POST refresh để khôi phục. Chỉ lỗi `ACCESS_EXPIRED` mới kích hoạt refresh tự động; request được thử lại tối đa một lần. Dùng một Promise cho các request đồng thời trong tab và Web Locks cho các thao tác cookie giữa tab. Trình duyệt cần hỗ trợ Web Locks (localhost hoặc HTTPS). BroadcastChannel thông báo logout tới các tab cùng ứng dụng. Refresh lỗi mạng không được tự gửi lại vì kết quả rotation có thể chưa xác định; người dùng có thể cần đăng nhập lại.

Cookie `block9.anon` là session ẩn danh lưu PostgreSQL, chỉ dùng cho CSRF và digest reset; cookie này không cấp quyền quản trị. Mọi POST/PATCH/DELETE cần `X-CSRF-Token`. Frontend fetch với credentials; CORS chỉ chấp nhận origin đã cấu hình và cho phép Authorization/X-CSRF-Token. Session biểu mẫu hết hạn thì tải lại trang để lấy CSRF mới.

## Luồng tài khoản và hợp đồng API

Các trang `/register`, `/activate`, `/login`, `/forgot`, `/reset` là React, điều hướng/gửi form không tải lại document. Chỉ `/admin/*` yêu cầu đăng nhập; thực đơn và chi tiết món công khai. Mọi user active được CRUD, role viewer là nhãn của bài tập, chưa có RBAC.

| API | Hành vi |
| --- | --- |
| GET /api/auth/csrf | Tạo/lấy anonymous session và trả `{csrfToken}` |
| GET /api/auth/me | Bearer hợp lệ → `{id,email,role}` |
| POST /api/auth/register | `{email,password,passwordConfirm,recaptchaToken}` → next `/activate?email=...`; email trùng không đổi tài khoản/gửi lại mã |
| POST /api/auth/activate | `{email,otp}` → next `/login?status=activated`, không tự login |
| POST /api/auth/activate/resend | `{email}` → thông báo chung, cooldown 60 giây |
| POST /api/auth/login | `{email,password,recaptchaToken?}` → `{accessToken,expiresAt,user}` và Set-Cookie refresh |
| POST /api/auth/refresh | Refresh cookie → token mới, JSON access grant; không trả raw refresh trong JSON |
| POST /api/auth/logout | Thu hồi phiên từ refresh cookie, kể cả access đã hết hạn; xóa cookie |
| POST /api/auth/forgot | `{email}` → thông báo chung cho email có/không tồn tại |
| POST /api/auth/reset/prepare | `{token}` → kiểm tra, lưu digest vào session, chưa tiêu thụ; `{}` kiểm tra lại digest hiện có sau reload |
| POST /api/auth/reset | `{password,passwordConfirm}` → đổi password/tiêu thụ token/thu hồi mọi phiên trong transaction, next `/login?status=reset` |

Success envelope `{ok:true,data:...}`; auth error `{ok:false,error:{code,message,fields?,captchaRequired?,retryAfter?}}`. Auth dùng HTTP 400/401/403/429/503; 429 có Retry-After. Các mã xác thực gồm `ACCESS_EXPIRED`, `ACCESS_INVALID`, `SESSION_REVOKED`, `REFRESH_INVALID`, `CSRF_INVALID`, `LOGIN_FAILED`, `CAPTCHA_REQUIRED`, `CAPTCHA_UNAVAILABLE`, `RATE_LIMITED`. Các lỗi nghiệp vụ CRUD vẫn dùng envelope HTTP 200 của block7.

API đọc `/api/dishes`, `/api/dishes/facets`, `/api/dishes/:id` công khai. Mọi POST/PATCH/DELETE nghiệp vụ và mọi API `/api/chefs*`, `/api/ingredients*` yêu cầu Bearer hợp lệ, không chỉ kiểm tra route React.

Email trim + lowercase, không bỏ dấu chấm/+tag. Mật khẩu không trim, ít nhất 8 ký tự Unicode và tối đa 72 byte UTF-8, bcrypt cost 12. OTP 6 số lưu HMAC; reset token 32 byte lưu SHA-256. Email reset trỏ frontend; trang reset chuyển token sang digest trong session rồi loại token khỏi URL. Referrer-Policy=no-referrer; không echo token vào form.

reCAPTCHA v2 bắt buộc ở register; login yêu cầu sau lần sai thứ ba. React tải script một lần, render theo vòng đời trang và reset sau lần gửi sử dụng token. API gọi Google SiteVerify với timeout 8 giây và kiểm tra hostname. Token dùng một lần, có hạn hai phút; Google lỗi thì báo thử lại, không bỏ qua xác minh. [Google SiteVerify](https://developers.google.com/recaptcha/docs/verify)

| Giới hạn | Chính sách |
| --- | --- |
| Login/email | 15 phút; reCAPTCHA sau 3 lần sai; sai 10 lần khóa 15 phút |
| Login/IP | 60 request/15 phút, kể cả thiếu reCAPTCHA |
| Register/IP | 10 request/giờ |
| OTP | Hạn 10 phút; sai 5 lần khóa 15 phút; resend không xóa attempts |
| Gửi OTP | 60 giây/lần; 5 lần/giờ/email và 20 lần/giờ/IP, gồm đăng ký đầu |
| Verify OTP/IP | 60 request/15 phút |
| Forgot | 5 request/giờ/email và 20 lần/giờ/IP |
| Reset | Token hạn 30 phút; POST 20 request/giờ/IP |
| Refresh/IP | 120 request/phút |

Rate limit lưu PostgreSQL với khóa HMAC email/IP. Thành công login xóa bộ đếm sai email, giữ giới hạn IP. SMTP lỗi chỉ log thông báo cố định; không log password/OTP/token/credential.

## Quyết định phân trang và tìm kiếm

| Chức năng | UI | Nơi phân trang | Lý do |
| --- | --- | --- | --- |
| Thực đơn sách + quản trị món | Số trang, trước/sau | Server: COUNT + LIMIT/OFFSET, mặc định 6 | Tập 1.000 món, mở lại đúng trang |
| Quản trị đầu bếp/nguyên liệu | Số trang | Client: filter/sort toàn bộ rồi slice 6 mục | Tập nhỏ khoảng 20 mục, đổi trang không gọi API |
| Chọn đầu bếp trong form món | Tải thêm | Client: slice(0, count), tăng count thêm 6 | Chủ động mở rộng danh sách đã tải |
| Chọn nguyên liệu trong form món | Cuộn vô hạn trong khung, có nút Tải thêm dự phòng | Client: cùng cơ chế tăng count | Giữ form gọn, cuộn tiếp không gọi API |

Món không tải đủ 1.000 mục để chia tại browser; `slice` trong sách chỉ chia một trang 6 món thành hai lá. Bảng quản trị nhỏ dùng `/api/{resource}/all`; picker dùng `/api/{resource}/options/all` chỉ lấy ID, tên và chuyên môn/đơn vị. Hai endpoint này không có LIMIT, page hay cursor. Mỗi danh sách chỉ fetch khi mở màn hình hoặc thử lại sau lỗi tải ban đầu; đổi trang, tìm tên, sort hoặc mở rộng picker đều xử lý tại browser. Rời màn hình rồi quay lại sẽ tải mới để nhận thay đổi CRUD.

- Thực đơn: nhập tên/mô tả, tự tìm sau 300 ms ngừng gõ; Enter tìm ngay. PostgreSQL full-text dùng cấu hình `simple` ở cả document và query, tên trọng số A và mô tả trọng số B; `coalesce` xử lý NULL. Không có kết quả thì tìm tên gần đúng và ghi rõ đây là gợi ý.
- Fuzzy dùng `pg_trgm`, `similarity >= 0.3`, có toán tử `%` để hỗ trợ GIN. Full-text/fuzzy xếp điểm giảm dần, `id` tăng dần khi bằng điểm; sort tên/giá không ghi đè thứ hạng tìm kiếm.
- Quản trị món tìm một phần tên bằng PostgreSQL `lower(unaccent(...))`. Đầu bếp/nguyên liệu ở bảng và picker tìm trên mảng đã tải bằng NFD, bỏ dấu và chuyển chữ thường trong JavaScript; tên sắp xếp bằng Intl.Collator tiếng Việt. Mọi ô tìm đều không phân biệt hoa/thường/dấu. Ký tự `%`, `_`, `\` trong tìm tên là ký tự literal.
- Bộ lọc món: danh mục, min/max giá (bao gồm biên), trạng thái phục vụ; kết hợp AND với tìm kiếm trên toàn bộ tập dữ liệu **trước** phân trang. Danh mục lấy DISTINCT từ database.
- Sort thường: ID, tên A–Z/Z–A; món có thêm giá tăng/giảm. Luôn thêm ID tăng dần để thứ tự ổn định. Đầu bếp và nguyên liệu không dùng full-text/fuzzy.
- Cột `searchName` và `searchVector` do trigger cập nhật khi CRUD, không phải generated column gọi `unaccent`; GIN hỗ trợ trigram/full-text, B-tree hỗ trợ tên/giá. Không xuất các cột nội bộ trong DTO.

## URL và trạng thái

Ví dụ: `/admin/dishes?q=nam&category=Vườn+xanh&minPrice=50000&available=true&sort=price-asc&page=2`.

URL danh sách giữ điều kiện và trang qua reload, copy link, Back/Forward. Từ khóa và khoảng giá tự cập nhật sau 300 ms (replace lịch sử); lựa chọn danh mục/trạng thái/sort và xóa điều kiện cập nhật ngay (thêm lịch sử). Điều kiện mới bắt đầu từ trang 1. Chip cho phép bỏ từng điều kiện; Xóa tất cả khôi phục mặc định. Giá sai được báo tại trường nhập và không gửi request. Khi nhập bằng IME, chỉ tìm sau khi kết thúc composition. Back/Forward hoặc điều hướng hủy bản nhập đang chờ. Trang sai ở UI về 1; trang vượt cuối được clamp và đồng bộ URL bằng replace: món clamp ở server, đầu bếp/nguyên liệu clamp ở client. Với món, count, chọn ID và tải bản ghi nằm trong cùng transaction Repeatable Read.

Khi tải trang mới, trang cũ có trạng thái đang tải; chỉ đổi dữ liệu, số trang và lật sách khi phản hồi mới sẵn sàng. Reduced motion không chạy hiệu ứng. Lỗi có nút thử lại.

Nút **Tìm kiếm** và phím Enter gửi ngay điều kiện hợp lệ đang nhập, không chờ debounce và không gửi lặp sau đó. Danh sách quản trị, trang chi tiết và form sử dụng skeleton theo bố cục nội dung; lỗi vẫn có nút thử lại.

Quản trị đầu bếp hiển thị tổng số món và tối đa hai món xem trước. Với nhiều hơn hai món, nút **Xem tất cả** mở danh sách có khung cuộn giới hạn 220 px và ô tìm tên không phân biệt dấu. Danh sách đầy đủ chỉ được dựng khi mở; các liên kết vẫn dẫn tới trang chỉnh sửa món ăn.

Quản trị nguyên liệu dùng cùng danh sách món thu gọn. Khi mở menu, chuyển trang hoặc tìm/lọc, các trang giấy trống lật liên tục trong khung sách trong lúc chờ dữ liệu; không hiển thị skeleton món ăn. Sang trang lớn hơn lật từ phải sang trái; về trang nhỏ hơn lật từ trái sang phải, kể cả khi nhập số trang hoặc dùng Back/Forward. Hiệu ứng dừng khi request hoàn tất hoặc báo lỗi. Khi nhảy xa, chỉ tải trang đích rồi thực hiện một lượt lật theo đúng hướng; thời lượng tăng nhẹ theo khoảng cách và giới hạn 845 ms trên desktop. Lá chưa lật giữ nội dung cũ cho đến khi lượt lật hoàn tất; chế độ giảm chuyển động hiển thị sách tĩnh với thông báo đang tải và đổi trang trực tiếp.

Picker tải toàn bộ lựa chọn một lần. Tìm kiếm debounce 300 ms (Enter áp dụng ngay, không submit form món); đổi từ khóa lọc lại mảng và hiển thị tối đa 6 kết quả đầu. Tải thêm/cuộn chỉ tăng số mục hiển thị, không gọi API. Lựa chọn giữ riêng bằng ID và chip ngay cả khi không nằm trong kết quả đang xem. Infinite scroll dùng IntersectionObserver có root là khung nguyên liệu; khi đã hết dữ liệu không mở rộng tiếp. Lỗi tải ban đầu có nút thử lại và không chặn nhập các trường khác của form.

**Mở lại form/reload:** tải lại từ lô đầu; chỉ khôi phục liên kết đã lưu của món. Không khôi phục số lô đã cuộn hay nội dung form chưa lưu.

## Hợp đồng API

Frontend đầu bếp/nguyên liệu dùng hai endpoint tải đầy đủ:

- `GET /api/{chefs|ingredients}/all` → `{ok:true,data: Entity[]}` gồm các liên kết món để hiển thị bảng quản trị.
- `GET /api/{chefs|ingredients}/options/all` → `{ok:true,data: Option[]}` chỉ có ID, tên và `specialty`/`unit` cho form chọn.

Không có endpoint `/api/dishes/all`. Các API phân trang/cursor bên dưới được giữ tương thích; UI chỉ dùng server paging cho món, không gọi các API cursor cũ của đầu bếp/nguyên liệu.

`GET /api/{dishes|chefs|ingredients}`:

```json
{"ok":true,"data":{"items":[],"meta":{"page":1,"pageSize":6,"total":0,"pages":1,"effectiveMode":"basic"}}}
```

Query: `page` (1..2147483647), `pageSize` (1..50, mặc định 6), `q` (tối đa 200 ký tự), `sort` (`id`, `name-asc`, `name-desc`, `price-asc`, `price-desc`). Sort giá chỉ dùng cho món.

Món nhận thêm `category`, `minPrice`, `maxPrice`, `available=true|false` và `mode`:

| Mode | Hành vi |
| --- | --- |
| `basic` | Tìm một phần tên |
| `advanced` | Tìm tên với điều kiện AND |
| `fulltext` | Tên và mô tả qua `websearch_to_tsquery`/`ts_rank` |
| `fuzzy` | Tên gần giống, ngưỡng 0.3 |

Mọi mode đều kết hợp được bộ lọc món. `mode=fulltext&fallback=fuzzy` chỉ chuyển sang fuzzy khi không có kết quả full-text trong cùng bộ lọc; `effectiveMode` công bố cách tìm thực tế. `q` trống duyệt danh sách bình thường. Giao diện không có bộ chọn mode: thực đơn gửi fulltext + fallback, quản trị món gửi advanced; đầu bếp/nguyên liệu không gửi query khi tìm tại client.

`GET /api/{chefs|ingredients}/options?q=...&after=6&limit=6`:

```json
{"ok":true,"data":{"items":[{"id":7,"name":"Tên","unit":"kg"}],"nextCursor":7,"hasMore":true}}
```

Đầu bếp có `specialty` thay cho `unit`. Hết dữ liệu: `nextCursor=null`, `hasMore=false`. Lần đầu bỏ `after`; giữ nguyên `q` khi dùng cursor. `GET /api/dishes/facets` trả `data: {categories: string[]}`.

Query không hợp lệ trả business error `VALIDATION_FAILED` theo envelope HTTP 200 hiện có. Validator phân biệt mảng đầy đủ của endpoint all, DTO phân trang của món và DTO cursor cũ. CRUD/detail giữ nguyên.

## Kiểm thử và nghiệm thu

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:preview
npm run test:db
```

- HTTP/unit tests kiểm tra CRUD, tìm kiếm/phân trang, validation/DTO, CSRF/CORS, chữ ký/claims JWT, cả hai version, rotation/replay, logout một phiên, reset mọi phiên, mốc 8 giờ, OTP/lock/cooldown, mật khẩu Unicode và SMTP/reCAPTCHA lỗi.
- Browser tests dùng Chrome qua `CHROME_PATH`, hoặc `/usr/bin/google-chrome`. Bộ cũ giữ các kiểm tra tìm kiếm, CRUD, picker, hiệu ứng sách, mobile, Back/Forward, request race và retry. Bộ tài khoản kiểm tra desktop 1440/mobile 390, CSR, đăng ký/OTP/login/logout/forgot/reset, reload, token trong bộ nhớ/cookie HttpOnly, single-flight, nhiều tab và version invalidation. Chạy riêng bằng `npm run test:auth:browser`.
- Browser/HTTP tests dùng MemoryStore, MemoryAuthRepository, mailer và verifier giả qua dependency injection. Widget Google được chặn/thay script chỉ trong Playwright; không có bypass trong ứng dụng. Ảnh và bằng chứng network ở `artifacts/` (gitignored). Không dùng các kiểm tra này để kết luận PostgreSQL/SMTP/Google thật đã hoạt động.
- Production preview kiểm tra bundle thật, SPA fallback, deep-link/reload, static assets, CORS và không chứa secret backend, với API fixture riêng.
- DB integration chỉ chạy khi `AUTH_TEST_DATABASE_URL` được truyền riêng vào môi trường; không tự đọc `.env` hoặc dùng DATABASE_URL của ứng dụng. Thiếu biến thì hiển thị SKIP. Chỉ tạo/ghi/drop schema `block9_test_<hex>` ngẫu nhiên do test tạo. Kiểm tra seed/search PostgreSQL và auth persistence qua restart, refresh/reset/OTP đồng thời, shared counters, logout race.
- Database ứng dụng, gửi SMTP và Google reCAPTCHA thật cần cấu hình riêng và nghiệm thu thủ công. Không có credential thật trong repository.

Cấu trúc: `api/` chứa Express/domain/Prisma/auth; `web/` chứa React CSR; `scripts/` chứa browser/preview/DTO tests. Không cần EJS hay server render HTML nghiệp vụ.
