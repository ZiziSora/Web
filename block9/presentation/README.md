# Block 9 — slide HTML minh chứng

Mở index.html trực tiếp trong Chrome/Edge. Không cần server hoặc CDN. Có 20 slide chính và 3 phụ lục; bàn phím ← →, Home/End, dropdown, N mở ghi chú, toàn màn hình và In/PDF. Ảnh có thể nhấp mở lớn; evidence.html có lọc theo mã.

## Nguồn và giới hạn

Tất cả HTTP, giao diện, cookie/storage được thu thập khi ứng dụng chạy với MemoryStore/MemoryAuthRepository. Email và CAPTCHA là dependency test; widget bị thay script trong Playwright. Không đọc .env ứng dụng: Vite dùng cấu hình envDir:false. Không gửi SMTP, gọi Google thật hoặc ghi PostgreSQL. Snapshot trong HTTP JSON là repository bộ nhớ, không phải export DB.

PASS là assertion chạy thành công trong fixture. Chưa có ảnh DevTools Network/Application, email SMTP và PostgreSQL thật. OTP/reset token/password/cookie/Authorization được che trước khi lưu; ảnh input mật khẩu và OTP được mask.

## Chạy lại (từ block9)

```powershell
node --import tsx --test presentation/collect.test.ts
node --import tsx presentation/collect-browser.ts
npm test
python presentation/build.py
node presentation/verify.mjs
```

Cần dependencies Block 9 và Chrome; có thể đặt CHROME_PATH. Không chạy db:push, migration hoặc seed. Công cụ thu thập HTTP là bản độc lập dựa trên auth.test.ts tại thời điểm tạo slide; khi auth đổi cần cập nhật collector. Test thất bại phải được giữ trong log và trạng thái evidence.

## Tệp

- build.py dựng lại HTML, SCRIPT.md và cases.json từ kết quả quan sát.
- collect.test.ts ghi HTTP và snapshot đã che; collect-browser.ts chụp UI và storage.
- evidence/http.json, cases.json, storage-*.json, role-*.json: minh chứng máy đọc được.
- evidence/test-results.txt và browser-results.txt: log lần chạy.
- .qa/: render từng slide, bản in kiểm tra và báo cáo; không phải tài liệu nộp.

## Checklist bổ sung môi trường thật

Theo mỗi mã J/R/F: chụp UI nếu có thao tác giao diện, Network, Application và request trực tiếp. Che Authorization, cookie, CSRF, OTP, reset token. Chụp email OTP/reset thật đã che và bản ghi PostgreSQL liên quan (hash đã che, expiresAt, usedAt, attempts). Xác nhận Google SiteVerify thật. Không coi screenshot form chung là bằng chứng mọi kịch bản.

Role viewer hiện là nhãn; ứng dụng chưa có RBAC. Bỏ mục lỗi agent theo yêu cầu người dùng.
