# Block 10 — Ghi chú trình bày

## 1. Block 10 · Phân quyền & MFA

THE TABLE / React CSR + Express API + PostgreSQL

Giới thiệu hai nội dung trọng tâm: ma trận quyền viewer/editor/admin và các sơ đồ nhóm tự dựng theo mã nguồn để giải thích luồng phân quyền, bật MFA và đăng nhập MFA. Bộ slide dùng template Block 9 nhưng trình bày hành vi Block 10.

Nguồn: ../README.md

## 2. Từ Block 9 đến Block 10

Giữ nền tảng JWT; bổ sung quyền theo vai trò và bảo mật tài khoản

Block 9 đặt nền móng JWT và refresh rotation. Block 10 thêm kiểm tra role ở API và route guard ở React. MFA xác minh thêm yếu tố sở hữu ứng dụng Authenticator, sau bước mật khẩu. Quyền và MFA giải quyết hai câu hỏi khác nhau.

Nguồn: ../../block9/README.md, ../README.md, ../api/src/app.ts, ../api/src/security.ts

## 3. Ma trận RBAC

Ba vai trò · Quyền tăng theo phạm vi công việc

Đọc từng cột: viewer xem món và quản lý bảo mật bản thân; editor CRUD món nhưng chỉ xem/chọn đầu bếp và nguyên liệu có sẵn; admin còn CRUD hai danh mục đó và quản lý quyền editor. Xem/chọn ở đây nói về màn hình quản trị và API danh mục; chi tiết món công khai vẫn có thể chứa thông tin liên quan. Admin không được dùng trang này để đổi tài khoản admin.

Nguồn: ../README.md, ../api/src/app.ts, ../api/src/security.ts, ../web/src/App.tsx

## 4. Sơ đồ luồng phân quyền

Kiểm tra tại API, kể cả khi gọi trực tiếp và bỏ qua giao diện

Theo luồng từ trái sang phải: request bảo vệ cần Bearer token có chữ ký hợp lệ. API đọc tài khoản và session từ database, kiểm tra trạng thái active, hạn phiên và version. Xác thực sai hoặc phiên bị thu hồi trả 401; role không được phép thao tác trả 403 FORBIDDEN. Đủ quyền vẫn cần CSRF và origin hợp lệ khi thay đổi dữ liệu. Sơ đồ này áp dụng cho route bảo vệ; GET dishes công khai không yêu cầu token. React ẩn thao tác và chặn route để hỗ trợ trải nghiệm, nhưng API là nơi quyết định quyền.

Nguồn: ../api/src/app.ts, ../api/src/token-sessions.ts, ../web/src/pages/Security.tsx

## 5. Cấp / thu hồi editor

Admin đổi quyền; các phiên cũ của tài khoản đích bị thu hồi

Admin chỉ chuyển viewer sang editor hoặc ngược lại cho tài khoản active. Backend kiểm tra lại actor là admin trong transaction để tránh dựa vào dữ liệu cũ. Việc tăng userVersion và thu hồi session làm access token và refresh token cũ không còn sử dụng được. Sau đăng nhập, viewer đến /dishes; editor/admin đến /admin/dishes.

Nguồn: ../api/src/security.ts, ../api/src/token-sessions.ts, ../web/src/pages/Security.tsx, ../web/src/auth/state.ts

## 6. Sơ đồ bật / thay Authenticator

Chỉ kích hoạt secret mới sau khi xác minh TOTP thành công

Người dùng vào Settings, xác nhận mật khẩu; nếu đang bật MFA thì còn phải chứng minh yếu tố cũ bằng OTP hoặc recovery code. Server sinh secret và QR tạm, hết hạn sau 5 phút. Người dùng quét QR và nhập TOTP của secret mới. Chỉ khi confirm thành công mới thay trạng thái MFA chính thức, sinh 10 recovery code và thu hồi mọi phiên. Khi thay thiết bị, secret cũ tiếp tục có hiệu lực cho đến khi xác nhận secret mới thành công. TOTP dùng SHA1, 6 số và chu kỳ 30 giây.

Nguồn: ../api/src/security.ts, ../web/src/pages/Security.tsx

## 7. Sơ đồ đăng nhập MFA

Tài khoản bật MFA phải hoàn tất yếu tố thứ hai trước khi có phiên đăng nhập

Sau khi password, trạng thái active và CAPTCHA theo quy tắc đều đạt, hệ thống kiểm tra MFA. Chưa bật MFA thì cấp access và refresh như bình thường. Đã bật thì chỉ tạo challenge 5 phút trong cookie block10.mfa HttpOnly; chưa có grant. Ở /mfa, người dùng nhập TOTP hoặc recovery code chưa dùng. API kiểm tra hạn challenge, account version và khóa xác minh; thành công mới tiêu thụ challenge và cấp phiên. Mỗi bước TOTP chỉ chấp nhận một lần trên toàn tài khoản. Sai 5 lần khóa xác minh 15 phút; đăng nhập lại không xóa bộ đếm.

Nguồn: ../api/src/auth.ts, ../api/src/security.ts, ../api/src/token-sessions.ts

## 8. Thông số thời gian MFA

TOTP đổi mỗi 30 giây; thiết lập và phiên chờ có hạn riêng

Phân biệt chu kỳ mã với thời hạn thao tác: mã TOTP gồm 6 số, đổi mỗi 30 giây; server xét bước hiện tại, bước trước và bước sau để dung sai đồng hồ. Đây không phải một mã cố định có hạn 5 phút. Hạn 5 phút áp dụng riêng cho thiết lập QR/secret và challenge đăng nhập. Challenge hết hạn thì phải đăng nhập lại; thiết lập hết hạn thì tạo lại QR. OTP đã chấp nhận không dùng lại ở thao tác tiếp theo: cần chờ mã mới hoặc dùng recovery code chưa dùng.

Nguồn: ../api/src/security.ts

## 9. Giới hạn nhập mã MFA

Bộ đếm lưu theo tài khoản, dùng chung giữa các thao tác xác minh bảo mật

Bộ đếm attempts và lockedUntil nằm trong trạng thái bảo mật của tài khoản ở PostgreSQL, không phụ thuộc tab hoặc bộ nhớ trình duyệt. Các bước xác minh MFA, xác nhận setup và xác thực lại trong Settings dùng chung bộ đếm; xác thực lại sai mật khẩu hiện tại cũng tính là một lần sai. Xác minh thành công xóa attempts; sau khi hết khóa, lần kiểm tra tiếp theo xóa bộ đếm và khóa. Mã sai, mã TOTP bị dùng lại hoặc recovery code đã dùng đều bị từ chối. Hết hạn challenge không được xử lý như một lần nhập mã sai.

Nguồn: ../api/src/security.ts, ../api/src/auth.ts

## 10. Recovery code & Settings

Giữ quyền kiểm soát khi đổi mật khẩu hoặc thay thiết bị

Recovery code thay thế OTP khi mất thiết bị; có 10 mã mỗi bộ, mỗi mã là 128 bit ngẫu nhiên được biểu diễn bằng 32 ký tự hex và dùng một lần. Chưa đặt thời hạn cho recovery code; mã mất hiệu lực khi đã dùng, tạo bộ mới, thay hoặc tắt MFA. Chỉ mã HMAC được lưu, không lưu plaintext. Sau các thao tác bảo mật, người dùng cần đăng nhập lại; giao diện giữ recovery mới để họ lưu trước khi rời trang. Việc reset password không được dùng để tắt MFA.

Nguồn: ../api/src/security.ts, ../web/src/pages/Security.tsx, ../README.md

## 11. Kịch bản trình diễn

Thực hiện lần lượt để đối chiếu ma trận quyền và hai lớp xác thực

Chuẩn bị ba tài khoản active mang ba vai trò. Dùng các cửa sổ hoặc profile riêng để tránh lẫn phiên. Trình diễn phần quyền trước, sau đó bật MFA, lưu recovery code và đăng nhập lại. Nếu thử recovery, chỉ dùng một mã chưa dùng. Không trình chiếu mật khẩu, secret QR, OTP còn hiệu lực hoặc bộ recovery thật. Đây là hướng dẫn demo chứ không phải log bằng chứng đã chạy.

Nguồn: ../README.md, ../api/test/security.test.ts, ../scripts/security-browser-check.ts

## 12. A1 · Nguồn đối chiếu

Sơ đồ tự dựng theo mã nguồn Block 10; template kế thừa Block 9

Khi cần giải thích chi tiết, mở trực tiếp các file nguồn được liệt kê. Các SVG là sơ đồ do bộ slide tự dựng, không dùng hình từ Internet. Bộ slide không đọc .env và không chứa credential hay dữ liệu tài khoản thật.

Nguồn: ../README.md, ../../block9/presentation/README.md
