## 1. Block 9 · JWT và API
The Table / React CSR + Express JSON API

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 2. Phạm vi nghiệm thu
16 dòng yêu cầu trong ba bảng nghiệm thu

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 3. Từ Block 8 sang API
Giữ nghiệp vụ; chuyển rendering và xác thực

Đối chiếu block8/src và block9/api/src cùng web/src. Mô-đun nghiệp vụ tiếp tục chạy phía API; trình duyệt dựng trang bằng React. Role viewer chưa phải RBAC.

## 4. Luồng đăng nhập JWT
API xác minh tài khoản; trình duyệt giữ access token trong bộ nhớ

Bộ nhớ tránh lưu access token lâu dài trong localStorage. Cookie HttpOnly không đọc được bằng JavaScript; refresh vẫn cần CSRF. Logout thu hồi phiên hiện tại, reset thu hồi toàn bộ phiên của user.

## 5. Nơi lưu token
Access: bộ nhớ · Refresh: cookie HttpOnly

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 6. Preflight và CSRF
OPTIONS cho origin cụ thể; mutation cần X-CSRF-Token

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 7. CRUD khi chưa đăng nhập
POST · PATCH · DELETE đều bị chặn ở API

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 8. Gọi API trực tiếp
Bỏ qua giao diện vẫn chịu cùng middleware

Mở hồ sơ HTTP: API middleware áp dụng độc lập giao diện. Các test browser kiểm tra UI gọi ứng dụng thật trên fixture; không tuyên bố có ảnh DevTools thật. So sánh CRUD chi tiết xem test-results.txt.

## 9. JWT bị sửa hoặc hết hạn
401 ở request trực tiếp; frontend có thể refresh khi ACCESS_EXPIRED

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 10. Role phía client không quyết định quyền
Storage là dữ liệu người dùng có thể tự sửa

Ứng dụng chưa có RBAC: user active role viewer vẫn CRUD. Không diễn giải viewer thành read-only. Browser assertion xác nhận identity trước/sau giống nhau; payload sửa không có chữ ký hợp lệ.

## 11. Đọc món không cần token
Thực đơn, chi tiết, tìm kiếm và phân trang tiếp tục công khai

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 12. Đăng ký luôn tạo viewer
Body role: admin không được tin cậy

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 13. CAPTCHA thiếu hoặc sai
Không tạo user và không gửi OTP

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 14. OTP sai, hết hạn hoặc đã dùng
Kích hoạt một lần; tài khoản chưa xác minh không được cấp quyền

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 15. Pending đăng nhập qua API
Không cấp accessToken

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 16. Login đến ngưỡng CAPTCHA
Sau ba lần sai, bỏ CAPTCHA sẽ bị từ chối

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 17. Forgot và giới hạn gửi
Phản hồi chung giúp tránh tiết lộ tài khoản

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 18. Mở reset chưa tiêu thụ token
Prepare lưu digest trong session; URL được làm sạch

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 19. Reset token không hợp lệ
Token cũ, hết hạn, đã dùng đều bị từ chối

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 20. Sau reset mật khẩu
Không tự đăng nhập; thu hồi mọi phiên cũ

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 21. A1 · Ma trận nghiệm thu
16 kịch bản có mã liên kết tới hồ sơ

Mở evidence.html để xem toàn bộ request đã che và assertion nguồn. PASS là kết quả test cô lập, không phải nghiệm thu môi trường thật.

## 22. A2 · Danh mục minh chứng
Ảnh ứng dụng thật chạy trên fixture; email/repository là test

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 23. A3 · API và các ngưỡng
Các mặc định được đối chiếu với mã nguồn Block 9

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.

## 24. A4 · Chạy lại và phần cần bổ sung
Không kết luận thay cho nghiệm thu dịch vụ thật

Nêu thao tác, đối chiếu assertion và mở hồ sơ minh chứng khi cần. Đây là môi trường cô lập; không dùng để khẳng định SMTP, Google hay PostgreSQL thật đã hoạt động.