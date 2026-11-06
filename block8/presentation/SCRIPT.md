# Kịch bản thuyết trình Authentication Block 8

16 slide chính + 5 phụ lục. Khoảng 12 phút kỹ thuật, 5 phút demo, 2–3 phút phản biện.

## 1. Authentication cho The Table

Block 8 · Express SSR, EJS, Prisma và PostgreSQL

Thời lượng: 30 giây

Lời trình bày

Bài trình bày đi từ yêu cầu đến cơ chế trong mã nguồn, sau đó chứng minh bằng request và trạng thái lưu tại server. Các slide demo có ảnh giao diện từ bộ kiểm thử cô lập để dự phòng.

Bằng chứng và thao tác

Không điền tên hoặc mã sinh viên khi chưa có thông tin. Bấm N để mở ghi chú. Sáu câu hỏi phản biện được gắn vào các chủ đề liên quan.

Đối chiếu

Tài liệu yêu cầu do người dùng cung cấp. Mã nguồn Block 8.



## 2. Yêu cầu và phạm vi triển khai

Authentication áp dụng cho cụm quản trị. Thực đơn tiếp tục phục vụ khách chưa đăng nhập.

Thời lượng: 45 giây

Lời trình bày

Đây là phạm vi đã chốt với người dùng. Cụm CRUD quản trị yêu cầu đăng nhập, còn danh sách và chi tiết thực đơn công khai. Không diễn giải role viewer thành quyền chỉ đọc vì code hiện cho mọi user active dùng CRUD.

Trả lời phản biện

Các route công khai phục vụ xem thực đơn hoặc thực hiện auth trước đăng nhập. Mỗi POST vẫn phải kiểm tra CSRF và các điều kiện riêng.

Bằng chứng và thao tác

Đối chiếu GET /dishes với GET /admin/dishes khi không có cookie. Ma trận đầy đủ các yêu cầu nằm ở phụ lục A1 và evidence.html.

Đối chiếu

src/app.ts: auth.requireLogin và các route /admin. src/auth.ts: register gán role viewer.



## 3. Kiến trúc authentication trên SSR

Browser gửi form HTML. Server kiểm tra quyền và làm việc trực tiếp với store.

Thời lượng: 1 phút

Lời trình bày

Không thêm JWT hoặc REST API JSON cho giao diện auth. Browser gửi form về Express; express-session giải quyết phiên, các kiểm tra nghiệp vụ ở router và repository. Store session thật nằm ở PostgreSQL. Test thay repository và mailer mà không tạo route bypass production.

Bằng chứng và thao tác

Chỉ vào hai đường giao tiếp: browser–server và server–SMTP. Giải thích dependency giả là công cụ test, không phải bằng chứng SMTP hoặc database thật.

Đối chiếu

src/auth.ts: authentication(deps). src/auth-store.ts: PrismaAuthRepository, PersistentSessionStore. src/auth-mail.ts: smtpMailer.



## 4. Sáu model quản lý trạng thái auth

Trạng thái tài khoản, thử thách, phiên và bộ đếm nằm trong schema block8.

Thời lượng: 50 giây

Lời trình bày

Không cần đọc mọi cột. Nhấn mạnh ai sở hữu một thử thách, còn hạn hay không, đã dùng chưa và trạng thái có cho phép truy cập hay không. Session dùng SHA-256 của sid làm id database. Bảng AuthRateLimit cũng chứa dấu đánh dấu thu hồi sid để response chạy đồng thời không tái tạo session đã hủy.

Bằng chứng và thao tác

Chỉ dùng bản ghi demo đã che khi thu thập bằng chứng thật. Không trình bày sơ đồ như có FK vật lý vì schema chưa khai báo quan hệ Prisma.

Đối chiếu

prisma/schema.prisma. src/auth-store.ts: Session lưu digest(sid), destroy ghi dấu revoked.



## 5. Bcrypt bảo vệ password lưu trong database

Cost 12, salt riêng mỗi lần băm. Validation giữ nguyên password người dùng nhập.

Thời lượng: 45 giây

Lời trình bày

bcrypt và scrypt là hai thuật toán khác nhau. Dự án dùng bcrypt theo lựa chọn người dùng. Lệnh await chờ kết quả tại handler trong khi phép băm bất đồng bộ chạy ngoài event loop. Cost 12 là tham số công việc, không phải độ dài password hay số lần băm tuyến tính. Test tạo hai hash của cùng password và so sánh được bằng compare.

Bằng chứng và thao tác

Dùng test password 7/8 ký tự, biên 72 byte và Unicode. Đoạn mã trên lược bỏ nhánh dummyHash và validation để dễ đọc; chỉ dẫn mã đầy đủ trong nguồn.

Đối chiếu

src/auth.ts: validPassword, register, login, reset. test/auth.test.ts: bcrypt password boundaries.



## 6. Đăng ký xác minh CAPTCHA trước khi tạo user

Server kiểm tra mọi điều kiện. Dữ liệu role từ form không quyết định quyền tài khoản.

Thời lượng: 1 phút

Lời trình bày

CAPTCHA được kiểm tra trước bcrypt nhằm tránh chi phí băm khi thử thách chưa đạt. Dữ liệu đầu vào được chọn lọc, user tạo mới luôn pending/viewer. Unique email ở database và transaction xử lý cạnh tranh. Trả cùng phản hồi cho email mới và email đã tồn tại để hạn chế dò tài khoản.

Bằng chứng và thao tác

Bằng chứng R01/R06 và C01/C02. Chụp Network và đếm user/email trong môi trường test. Không diễn giải phản hồi 303 thành đã xác minh email.

Đối chiếu

src/auth.ts: POST /register, normalizeEmail, consumeCaptcha, issueOtp. test/auth.test.ts: registration CAPTCHA precedes creation/email.



## 7. OTP kích hoạt đúng user và dùng một lần

Mã ngẫu nhiên 6 chữ số, purpose activation, hạn 10 phút và chỉ lưu HMAC.

Thời lượng: 1 phút

Lời trình bày

HMAC gắn userId và nhãn activation, không lưu mã thô. Tiêu thụ mã và kích hoạt user trong transaction. Resend giữ attempts và lockedUntil. Khi khóa hết hạn, nhánh xác minh mới đặt lại attempts để cho một đợt thử mới. Thành công không gắn userId xác thực vào session.

Trả lời phản biện

Pending bị từ chối ở login dù password đúng. Middleware còn kiểm tra user active mỗi request. Resend không reset attempts, việc hết khóa được xử lý riêng ở bước xác minh.

Bằng chứng và thao tác

R01–R08. Chụp bản ghi User/ActivationChallenge trước và sau, email OTP đã che. Dùng lại mã cũ sau resend, kiểm tra attempts. GET /admin sau activate vẫn phải chuyển về login.

Đối chiếu

src/auth.ts: issueOtp, POST /activate và /activate/resend.



## 8. Cookie sid và session là hai phần khác nhau

Cookie ở browser tham chiếu tới trạng thái tại server, không mang password hay role để tự cấp quyền.

Thời lượng: 1 phút

Lời trình bày

Cookie có chữ ký xác thực định danh phiên. Dữ liệu session nằm ở PostgreSQL qua custom express-session Store. Database key là digest của raw sid, không phải chuỗi cookie có chữ ký đầy đủ. HttpOnly hạn chế JavaScript đọc cookie; SameSite góp phần giảm gửi cookie khác site; CSRF vẫn được kiểm tra riêng.

Trả lời phản biện

Xóa cookie chỉ khiến browser không gửi định danh nữa. Bản ghi server vẫn có thể còn cho tới khi hết hạn hoặc bị hủy. Logout phải hủy bản ghi tại server.

Bằng chứng và thao tác

S02/S04. Chụp Application/Cookies và Network Set-Cookie đã che. Khi chạy localhost HTTP, Secure tắt đúng cấu hình development; không dùng ảnh đó để khẳng định đã quan sát Secure ở production.

Đối chiếu

src/auth.ts: sessionMiddleware, POST /login. src/auth-store.ts: PersistentSessionStore.



## 9. Session qua restart và quy trình đăng xuất

Độ bền phụ thuộc store PostgreSQL và secret ổn định qua các lần khởi động.

Thời lượng: 1 phút

Lời trình bày

Test HTTP tái tạo application với cùng MemoryAuthRepository chứng minh contract store nhưng chưa đủ kết luận độ bền PostgreSQL. Integration test đã có cho Prisma client mới, cần kết nối kiểm thử riêng để chạy. Bằng chứng thật cần giữ cùng cookie và truy vấn bản ghi digest tương ứng sau restart.

Trả lời phản biện

Xóa cookie không hủy bản ghi server. Session sống qua restart được chứng minh bằng database và HTTP, không bằng việc giao diện vẫn đang mở trong tab cũ.

Bằng chứng và thao tác

S05/S06. Chuẩn bị cookie jar trước logout, giữ riêng để gửi lại. Không xóa cookie thủ công rồi dùng việc bị chuyển login làm bằng chứng logout server thành công.

Đối chiếu

src/auth-store.ts: get, set, destroy, touch. integration/auth-database.ts: persistence test.



## 10. CAPTCHA và giới hạn chống brute force

Giải đúng CAPTCHA chỉ cho phép đi tiếp tới bước kiểm tra password.

Thời lượng: 1 phút 15 giây

Lời trình bày

Cửa sổ đếm sai theo email là 15 phút. Sau lần sai thứ ba server hiển thị CAPTCHA, và các POST tiếp theo thiếu hoặc sai CAPTCHA bị chặn trước bcrypt. Đạt mười lần sai thì lockedUntil tính từ thời điểm đó thêm 15 phút. Đúng CAPTCHA với password sai tiếp tục tăng count. Chỉ đăng nhập thành công xóa bộ đếm sai theo email; bộ đếm IP vẫn còn.

Trả lời phản biện

CAPTCHA làm tăng chi phí tự động hóa, không bảo đảm chặn mọi cuộc tấn công. Bộ đếm và thời gian chờ giới hạn tốc độ thử dù CAPTCHA đã được giải.

Bằng chứng và thao tác

C03–C07. Dùng test đã chuẩn bị hoặc tài khoản đã gửi đủ request thật. Đừng sửa ngưỡng production chỉ để demo nhanh. Bằng chứng 429 phải có status server và Retry-After.

Đối chiếu

src/auth.ts: loginState, consumeCaptcha, POST /login, limited.



## 11. Middleware bảo vệ CRUD và form CSRF

Thứ tự kiểm tra quyết định phản hồi và ngăn handler nghiệp vụ chạy khi chưa đủ điều kiện.

Thời lượng: 1 phút

Lời trình bày

Middleware đặt trước toàn bộ route quản trị, không chỉ ẩn nút ngoài giao diện. CSRF là synchronizer token gắn session, được đưa vào hidden field của mọi form thay đổi dữ liệu, kể cả auth. Method override chỉ nhận POST với _method PATCH/DELETE. Token xác nhận xóa tài nguyên hiện có là kiểm tra riêng ngoài CSRF.

Bằng chứng và thao tác

S01/S07. Gửi POST trực tiếp với/không có cookie và với/không có _csrf. Chụp status và so dữ liệu trước/sau. Token hidden field là CSRF được phép xuất hiện trong form, khác đáp án CAPTCHA hoặc OTP.

Đối chiếu

src/app.ts: middleware order và routes. src/auth.ts: locals, requireLogin, csrf.



## 12. Reset password thu hồi mọi session cũ

Reset token ngẫu nhiên 32 byte, lưu SHA-256, hạn 30 phút và chỉ dùng một lần.

Thời lượng: 1 phút 15 giây

Lời trình bày

Mật khẩu có entropy thấp dùng bcrypt, còn reset token có entropy cao dùng SHA-256 để tra cứu. GET nhận raw token từ email, xác minh hash và giữ digest trong anonymous session cho form tiếp theo; không echo raw token vào HTML. POST kiểm tra lại trong transaction để hai request cạnh tranh chỉ một request thành công.

Trả lời phản biện

Database chỉ giữ tokenHash cùng userId, expiresAt và usedAt. Việc hủy phiên cũ cần cả bản ghi server không còn và request mang cookie cũ bị từ chối.

Bằng chứng và thao tác

F01–F06. Chụp PasswordReset.usedAt trước/sau và User.authVersion. Dùng cookie cũ từ hai phiên độc lập, kiểm tra 303 /login sau reset. Không chỉ chụp cookie browser hiện tại đã bị xóa.

Đối chiếu

src/auth.ts: forgot, GET/POST reset. auth-store.ts: atomic và deleteSessions.



## 13. Demo đăng ký và kích hoạt email

Dùng tài khoản demo. Nếu SMTP chậm quá 15 giây, chuyển sang ảnh dự phòng đã thu thập.

Thời lượng: 1 phút 30 giây

Lời trình bày

Mở DevTools trước khi gửi form, bật Preserve log. Mỗi thao tác nêu trước kỳ vọng rồi thực hiện. Chỉ mô tả đã gửi email thật nếu đã cấu hình và thấy thư tương ứng. Ảnh đang hiển thị là giao diện test với store/mailer giả, CAPTCHA vẽ bằng thư viện thật.

Trả lời phản biện

Pending có thể giữ cookie cho session ẩn danh. Quyền CRUD chỉ có sau POST /login thành công, không phải sau activation.

Bằng chứng và thao tác

Trước buổi trình bày: tự cấu hình SMTP và đồng bộ 6 bảng auth. Lỗi P2021 AuthRateLimit đã xuất hiện trong phiên làm việc, hiện chưa có xác nhận đã khắc phục. Không demo live khi prerequisite chưa hoàn tất.

Đối chiếu

scripts/browser-check.ts. test/auth.test.ts. Hồ sơ evidence.html và DEMO.md.



## 14. Demo session, brute force và bảo vệ CRUD

Dùng nhãn sid-A và sid-B, giữ cookie cũ riêng để kiểm tra tái sử dụng.

Thời lượng: 1 phút 45 giây

Lời trình bày

Ưu tiên demo sid rotation, CSRF và logout. Restart thật chỉ thực hiện khi đã xác nhận database có bảng auth, secret ổn định. Chuẩn bị sẵn ảnh các ngưỡng brute force và dùng lại cookie sau restart, vì phần này dễ vượt thời lượng.

Trả lời phản biện

Test tạo lại app với MemoryAuthRepository chỉ chứng minh hành vi ở môi trường cô lập. Cần dữ liệu PostgreSQL thật để khẳng định qua restart server thực tế.

Bằng chứng và thao tác

Application/Cookies: che giá trị, giữ flags. Network: Set-Cookie, 303 Location, 403 hoặc 429 Retry-After. Database: digest sid-B còn sau restart, mất sau logout. Request trực tiếp cần dùng lại chính cookie trước logout.

Đối chiếu

test/auth.test.ts: session rotation/restart/logout, CSRF, brute force. integration/auth-database.ts: kiểm thử thật chưa chạy trong phiên này.



## 15. Demo reset và từ chối cookie cũ

Hai phiên đăng nhập cùng user giúp quan sát việc thu hồi trên toàn tài khoản.

Thời lượng: 1 phút 30 giây

Lời trình bày

Chuẩn bị hai browser profile hoặc một cửa sổ thường và một ẩn danh. Giữ cookie jar trước reset, không lấy cookie mới sau redirect để chứng minh cookie cũ bị từ chối. Link reset có token nhạy cảm, ảnh thanh địa chỉ phải che query token.

Bằng chứng và thao tác

Chụp usedAt null sau GET, có giá trị sau POST. Chụp authVersion tăng và số Session của user bằng 0. Gửi lại token cũ cùng cookie trước reset. Nếu dùng clip hay ảnh từ test, nhãn môi trường cô lập phải giữ nguyên.

Đối chiếu

src/auth.ts: reset. test/auth.test.ts: forgot/reset, concurrent consumption. DEMO.md.



## 16. Kết quả kiểm thử và bằng chứng còn thiếu

Mức độ xác minh phải khớp với môi trường đã chạy, không suy ra từ ảnh giao diện.

Thời lượng: 45 giây + phản biện

Lời trình bày

Số 24 là tổng bộ test hiện có, bao gồm cả SSR/CRUD và auth, không phải 24 bài test PostgreSQL. Browser test có 4 tổ hợp viewport và JavaScript. Lần triển khai trước đã qua typecheck/build/browser; bộ test được chạy lại khi chuẩn bị bài trình bày. Chỉ tuyên bố test mới pass nếu log kiểm thử trong evidence xác nhận.

Bằng chứng và thao tác

Kết quả test được lưu riêng trong evidence/test-results.txt. Chưa dùng credential thật, không mở .env hoặc chạy db:push. Nếu thu thập bằng chứng thật sau này, cập nhật trạng thái từng mã trong evidence.html và README.

Đối chiếu

test/*.test.ts. scripts/browser-check.ts. integration/auth-database.ts. evidence/test-results.txt.



## 17. A1 · Ma trận nghiệm thu đầy đủ

Mỗi kịch bản có mã để liên kết giao diện, HTTP, cookie và bản ghi database.

Thời lượng: Phụ lục, mở khi được hỏi

Lời trình bày

28 kịch bản đến từ bốn bảng nghiệm thu trong bộ ảnh đầu. Năm mục bổ sung kiểm tra các chi tiết đã triển khai. Ma trận đầy đủ nằm trong evidence.html với mỗi kịch bản một dòng, không rút gọn mất yêu cầu.

Bằng chứng và thao tác

Mỗi mã có UI, Network, Cookies, request trực tiếp và DB cần thu thập. Tên test là điểm đối chiếu, không phải ảnh bằng chứng thật. Phần chưa có bằng chứng phải giữ trạng thái chờ.

Đối chiếu

Bộ ảnh yêu cầu gốc. test/auth.test.ts. evidence.html.



## 18. A2 · Giới hạn, thời hạn và HTTP status

Các ngưỡng được áp dụng ở server và lưu trong PostgreSQL.

Thời lượng: Phụ lục

Lời trình bày

Gửi OTP tính cả lần đăng ký đầu tiên. Giới hạn OTP resend theo email/IP tách với cooldown. Khóa OTP hết hạn thì bước xác minh mới reset attempts. Khóa login kéo dài 15 phút tính từ lần sai chạm ngưỡng. Các dữ liệu có hạn có thể vẫn còn bản ghi sau khi hết hạn nhưng sẽ bị từ chối.

Bằng chứng và thao tác

Đối chiếu Retry-After là số giây server trả, không chỉ đồng hồ JavaScript. Không dựa vào disabled button để chứng minh giới hạn.

Đối chiếu

src/auth.ts: rate, loginState, issueOtp, activate, forgot, reset.



## 19. A3 · Route công khai và middleware

Các trang tài khoản cần truy cập trước login để người dùng có thể đăng ký và khôi phục truy cập.

Thời lượng: Phụ lục

Lời trình bày

Các POST auth công khai theo nghĩa không yêu cầu đã đăng nhập, không có nghĩa bỏ xác minh. GET /reset không tự tiêu thụ token nhưng có thể lưu digest vào anonymous session. /logout được bảo vệ CSRF, không có GET logout đổi dữ liệu.

Bằng chứng và thao tác

Nếu giảng viên hỏi viewer có sửa được không: trả lời có trong phạm vi hiện tại vì đây là authentication, chưa triển khai RBAC. Nếu hỏi list/details CRUD có công khai không: chỉ menu /dishes được giữ công khai theo quyết định phạm vi, các danh sách quản trị /admin đều khóa.

Đối chiếu

src/app.ts: các route và thứ tự middleware. src/auth.ts: router.



## 20. A4 · Cách lưu password và các loại mã

Phương pháp lưu phụ thuộc loại dữ liệu và entropy, đồng thời phải gắn đúng mục đích sử dụng.

Thời lượng: Phụ lục

Lời trình bày

Bcrypt tốn chi phí để bảo vệ password do người dùng chọn. Reset token và sid ngẫu nhiên entropy cao dùng SHA-256 để tra cứu. OTP chỉ 6 số và CAPTCHA ngắn dùng HMAC khóa server. OTP không dùng làm password và reset token không có quyền truy cập CRUD. Bí mật cấu hình chỉ nằm trong môi trường, .env.example là placeholder.

Bằng chứng và thao tác

Không đưa raw token/OTP/sid/CSRF vào slide hoặc log. Các bảng minh họa là cấu trúc, không phải database export. Kiểm thử cạnh tranh đã có cho store giả, integration PostgreSQL cần chạy riêng.

Đối chiếu

src/auth.ts. src/auth-store.ts. src/auth-mail.ts. prisma/schema.prisma.



## 21. A5 · Bằng chứng và câu trả lời phản biện

Mở đúng slide và đúng hồ sơ cho từng câu hỏi, giữ nguyên nhãn môi trường kiểm thử.

Thời lượng: Phụ lục

Lời trình bày

Trả lời trực tiếp bằng cơ chế và sau đó chỉ bằng chứng. Không tuyên bố có ảnh Network, email SMTP hoặc DB thật khi mới có ảnh test harness. Nếu chưa xử lý thiếu bảng AuthRateLimit, ghi rõ demo live chưa sẵn sàng.

Bằng chứng và thao tác

Trước buổi báo cáo kiểm tra checklist DEMO.md. Mọi sid-A/sid-B trong báo cáo phải là nhãn che nhất quán. Thư mục evidence/live dành cho bằng chứng thật đã che khi người dùng bổ sung.

Đối chiếu

src/auth.ts, src/auth-store.ts, schema.prisma, test/auth.test.ts, integration/auth-database.ts. Bộ ảnh yêu cầu người dùng cung cấp.


