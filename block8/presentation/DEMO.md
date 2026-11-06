# Kịch bản demo và thu thập bằng chứng

Thời lượng dự kiến 5 phút. Ba slide demo là 13–15. Dùng ảnh dự phòng nếu email chậm quá 15 giây hoặc ứng dụng chưa sẵn sàng. Các ảnh assets hiện là ảnh browser test với store/mailer cô lập và CAPTCHA vẽ thật, không phải ảnh SMTP hay PostgreSQL thật.

## Điều kiện trước buổi báo cáo

- Người dùng tự xác nhận đã xử lý lỗi `P2021: block8.AuthRateLimit does not exist`. Cần đủ sáu bảng auth, Prisma Client và cấu hình ứng dụng tương thích. Không chỉ generate client mà bỏ qua database schema.
- Người dùng tự cấu hình SMTP và kiểm tra nhận email OTP/reset. Không gửi `.env`, credential hoặc token cho người khác.
- Server chạy tại `http://localhost:3008`, `APP_BASE_URL` phù hợp. Nếu đổi cổng, sửa link demo trong slide hoặc mở địa chỉ của bạn ở tab riêng.
- Giữ secret ổn định để chứng minh session qua restart. Trên localhost HTTP, không dùng cookie không có Secure làm bằng chứng cấu hình production HTTPS.
- Mở DevTools: Network bật Preserve log, Application mở Cookies. Chuẩn bị tài khoản demo, một user pending, hai profile/cửa sổ đăng nhập cùng user active và cookie jar riêng cho phiên cũ.
- Thực hiện các thao tác chỉ trên tài khoản/dữ liệu demo do bạn kiểm soát. Không sửa code production, không rút ngắn TTL để giả bằng chứng hết hạn. Quay/chụp trước tình huống hết hạn và khóa lâu.
- Chỉ chạy PostgreSQL integration khi có `AUTH_TEST_DATABASE_URL` được cung cấp riêng. Bộ test đó tự tạo/xóa schema ngẫu nhiên `block8_test_*`, không lấy kết nối từ `.env`.

## Demo 1: đăng ký và OTP (90 giây)

1. Mở `/register`, gửi form với CAPTCHA sai. Quan sát 400; xác nhận không có user/OTP mới. Chụp C01.
2. Tải form mới, nhập email demo và password hợp lệ. POST register nhận 303 đến activate. Chụp C02/R06, xác nhận status pending, role viewer.
3. Mở email OTP. Che toàn bộ mã trên bản ảnh nộp. Nếu email không đến trong 15 giây, chuyển sang bộ ảnh đã chuẩn bị, không diễn giải thư từ mailer giả thành thư SMTP thật.
4. Nhập OTP, quan sát 303 `/login?status=activated`. Database có active và emailVerifiedAt, challenge.usedAt có giá trị. Chụp R02.
5. Truy cập `/admin`, vẫn nhận 303 `/login`. Chứng minh không tự login, không dùng việc còn cookie ẩn danh để kết luận đã đăng nhập. Chụp R07.

Trước buổi báo cáo chụp thêm R01, R03–R05, R08: pending đúng password vẫn bị từ chối; OTP sai/hết hạn/đã dùng cùng lỗi; resend giữ attempts và đổi mã; vượt giới hạn có 429; OTP không dùng làm password.

## Demo 2: cookie, session, restart, CSRF, logout (105 giây)

1. Trước login gọi phiên ẩn danh là sid-A. Login active thành công, cookie mới gọi sid-B. Chụp Set-Cookie đã che giá trị, giữ Path, HttpOnly, SameSite và Expires. Chụp S02/S04.
2. Giữ nguyên cookie jar sid-B, restart server với cùng secret và PostgreSQL. Gửi request mới đến `/admin/dishes`, quan sát 200; bản ghi digest phiên vẫn còn. Chụp S05. Không lấy việc tab cũ vẫn hiển thị làm bằng chứng.
3. Gửi POST CRUD với cookie hợp lệ nhưng thiếu/sai `_csrf`. Quan sát 403 và dữ liệu không thay đổi. Chụp S07.
4. Minh họa 429 trên tài khoản đã đạt ngưỡng bằng request thật. Chụp Network Retry-After và bộ đếm, C04–C07. Nếu không đủ thời gian, dùng ảnh dự phòng được ghi nhãn rõ.
5. POST logout bằng form hợp lệ, giữ cookie jar sid-B cũ riêng. Gửi lại chính sid-B đến `/admin/dishes`, nhận 303 `/login`. Bản ghi Session cũ đã xóa. Chụp S06.

Mẫu request trực tiếp **chỉ là hướng dẫn, chưa phải log đã chạy**:

```powershell
# Giá trị trong dấu <> do người trình bày tự lấy trong phiên demo riêng.
# Không chụp hoặc nộp raw sid/CSRF.
curl.exe -s -o NUL -D - http://localhost:3008/admin/dishes
# Khách: kỳ vọng HTTP 303, Location: /login

curl.exe -s -o NUL -D - --cookie 'sid=<SID_B_TRUOC_LOGOUT>' http://localhost:3008/admin/dishes
# Sau logout: kỳ vọng HTTP 303, Location: /login

curl.exe -s -o NUL -D - --cookie 'sid=<SID_B_DANG_HOP_LE>' --data 'name=Demo&specialty=SSR' http://localhost:3008/admin/chefs
# Đã login nhưng thiếu CSRF: kỳ vọng HTTP 403
```

Cookie có chữ ký phải được giữ nguyên khi gửi request. Khi đối chiếu key database, code lấy SHA-256 của **raw sid**, không băm toàn bộ header `Cookie` hoặc chuỗi cookie đã ký.

## Demo 3: forgot/reset và hủy cả hai phiên cũ (90 giây)

1. Đăng nhập cùng user active ở hai profile A/B, lưu hai cookie jar trước reset. Chụp số session và authVersion ban đầu.
2. Gửi forgot, mở link từ email. Che token cả trên thanh địa chỉ, Network URL và email trước khi nộp.
3. Sau GET reset, bản ghi PasswordReset.usedAt vẫn null, passwordHash chưa đổi. Chụp F04.
4. POST reset bằng form, quan sát 303 login. Chụp usedAt có giá trị, authVersion tăng, Session của user đã xóa.
5. Gửi lại cookie cũ A và B: mỗi request mới phải bị chuyển 303 `/login`. Gửi lại link reset đã dùng: bị từ chối. Không dùng cookie mới sau reset để chứng minh cookie cũ bị từ chối. Chụp F03/F05.

## Truy vấn read-only để người dùng tự thu thập

Các truy vấn dưới đây là mẫu trên database demo sau khi cấu hình xong. Chúng chưa được agent chạy. Không export toàn bộ `Session.data`, vì có CSRF và trạng thái phiên.

```sql
SELECT id, email, role, status, "emailVerifiedAt", "authVersion",
       left("passwordHash", 7) AS "bcryptPrefix"
FROM block8."User" WHERE email = 'demo@example.com';

SELECT "userId", purpose, "expiresAt", attempts, "lockedUntil",
       "lastSentAt", "usedAt", left("otpHash", 8) AS "hashPrefix"
FROM block8."ActivationChallenge" WHERE "userId" = '<DEMO_USER_ID>';

SELECT id, "userId", "expiresAt", data->>'authVersion' AS "authVersion"
FROM block8."Session" WHERE "userId" = '<DEMO_USER_ID>';

SELECT "userId", "expiresAt", "usedAt", left("tokenHash", 8) AS "hashPrefix"
FROM block8."PasswordReset" WHERE "userId" = '<DEMO_USER_ID>';
```

AuthRateLimit dùng key HMAC, không chứa email/IP thô. Dùng key đã xác định trong môi trường demo hoặc ảnh hàng tương ứng đã che, giữ count/windowStart/lockedUntil. Đáp án CAPTCHA không xuất hiện trong response, hidden field, cookie hoặc log. Hidden field `captchaId` là định danh thử thách, cần che khi nộp ảnh.

## Quy cách bộ bằng chứng

Mỗi mã trong `evidence.html` có thư mục trong `evidence/live/<MA>/` khi người dùng bổ sung:

- `01-ui-before.png`, `02-ui-after.png`: ảnh giao diện trước/sau.
- `03-network.png`: method, URL đã che, status, Location/Retry-After/Set-Cookie attributes.
- `04-cookies.png`: Application/Cookies, giá trị thay bằng sid-A/sid-B nhất quán.
- `05-http.txt`: request/response trực tiếp đã che, thể hiện chính cookie/token nào được tái dùng.
- `06-db-before.png`, `07-db-after.png`: các trường liên quan được lọc theo user demo.

Không tạo ảnh placeholder giả dạng bằng chứng. Trường hợp kịch bản không gửi email hoặc không đổi cookie, ghi “không gửi” / “không đổi” cùng quan sát hỗ trợ. Với secret, che toàn bộ giá trị; chỉ giữ nhãn để đối chiếu. Bản ghi hash có thể chỉ hiển thị prefix nếu cần, không chụp toàn bảng.

## Sáu câu trả lời ngắn

1. **Cookie và session:** browser giữ định danh, PostgreSQL giữ trạng thái. Xóa cookie không xóa bản ghi server. Logout hủy session server rồi xóa cookie.
2. **Session qua restart:** giữ cookie/secret/database, restart rồi gửi HTTP mới thành công và đối chiếu bản ghi còn hạn. Test memory chưa chứng minh PostgreSQL thật.
3. **CAPTCHA và rate limit:** CAPTCHA làm khó tự động hóa nhưng vẫn có thể được giải. Bộ đếm server và thời gian chờ giới hạn số lần thử, không phụ thuộc cookie.
4. **Pending và resend:** login chỉ cấp phiên xác thực cho active, middleware kiểm tra active mỗi request. Resend giữ attempts; hết khóa được xử lý riêng tại bước verify.
5. **Route công khai:** thực đơn và các bước auth trước login. POST vẫn yêu cầu CSRF và mã/rate limit tương ứng. Toàn bộ `/admin` cần active.
6. **Reset:** lưu hash token, hạn và usedAt. POST tiêu thụ mã, tăng authVersion, xóa mọi session. Dùng lại cả hai cookie cũ nhận 303 login.
