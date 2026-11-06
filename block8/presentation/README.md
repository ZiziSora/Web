# Authentication Block 8 — bộ slide HTML

Mở `index.html` trực tiếp trong Chrome/Edge. Không cần chạy server, cài thư viện hoặc build để xem slide. Mọi ảnh trong assets là file local, không gọi CDN.

Thiết kế tham khảo **`block7/representation`** (repo hiện không có `block7/presentation`): khung 1280 × 720, nền sáng, xanh navy/đỏ, code và bảng dễ đối chiếu, thanh điều hướng bên dưới.

## Điều khiển

- 16 slide chính và 5 phụ lục, tổng 21 slide cho bài trình bày 15–20 phút.
- Nút Trước/Sau, dropdown chọn slide, phím mũi tên, Space, Page Up/Down, Home/End.
- Nút **Ghi chú (N)** mở lời trình bày, thời lượng, câu hỏi phản biện, nguồn và cách thu thập bằng chứng của từng slide. Esc đóng ghi chú.
- Nút **Phụ lục / Đầu** chuyển giữa slide đầu và phụ lục A1.
- Nút **Toàn màn hình** hoặc F11. Phím chuyển slide hoạt động khi focus không ở control/link; nhấp vùng trống của slide trước khi dùng bàn phím.
- Nút **In / PDF** hoặc Ctrl+P: mỗi slide một trang 16:9. Bật in màu nền nếu trình duyệt yêu cầu. Ghi chú không in cùng slide.
- Hash `#slide-13`, `#slide-14`, `#slide-15` mở thẳng ba demo; `#slide-17` mở ma trận.
- Tắt JavaScript: toàn bộ 21 slide hiển thị để cuộn đọc hoặc in. `SCRIPT.md` có ghi chú độc lập.

## Tài liệu đi kèm

- `SCRIPT.md`: ghi chú và lời nói cho từng slide, gồm sáu câu hỏi phản biện.
- `DEMO.md`: chuẩn bị, kịch bản demo 5 phút, request mẫu, SQL read-only và quy cách chụp bằng chứng.
- `evidence.html`: ma trận đầy đủ **33 kịch bản**, gồm 28 mục trong bốn bảng nghiệm thu và 5 kiểm tra bổ sung. Có lọc từ khóa, link từng mã và ảnh UI.
- `evidence/cases.json`: cùng ma trận ở dạng dữ liệu để cập nhật sau này.
- `evidence/test-results.txt`: log bộ test cô lập được lưu khi chuẩn bị bài trình bày.
- `assets/`: bản sao các ảnh giao diện do browser test đã tạo. Nhấp ảnh trên slide để mở lớn.
- `build.mjs`: nguồn dựng HTML, ghi chú và ma trận. Chạy `node build.mjs` trong thư mục này nếu sửa nội dung nguồn; không kết nối DB/SMTP hoặc đọc `.env`. Lệnh cần ảnh gốc trong `../artifacts` để sao chép.

## Giới hạn bằng chứng

**Không coi ảnh form là ảnh nghiệm thu của mọi thao tác.** Ảnh có sẵn là browser test dùng store/mailer cô lập, CAPTCHA vẽ bằng thư viện thật. Chưa có ảnh Network/Cookies, email SMTP thật hoặc bản ghi PostgreSQL thật.

Kết quả 24 tests là tổng test SSR/CRUD/auth. Việc tạo lại app với MemoryAuthRepository kiểm tra contract session, chưa chứng minh persistence PostgreSQL. Mã integration test có sẵn nhưng cần `AUTH_TEST_DATABASE_URL` được cung cấp riêng để chạy.

Lỗi thiếu bảng `block8.AuthRateLimit` đã xuất hiện trước khi chuẩn bị slide; chưa nhận được xác nhận xử lý xong. Trước demo live, người dùng tự kiểm tra schema, Prisma Client, SMTP và các cấu hình cần thiết. Tác vụ dựng slide không sửa code auth, API/database, không đọc `.env` và không tự db:push/seed.

Thư mục `evidence/live` chỉ có hướng dẫn, chưa có bằng chứng thật. Không tạo hoặc dán token giả thành log quan sát thực tế. Khi bổ sung, che sid/OTP/reset token/challengeId/CSRF/credential, dùng nhãn nhất quán.

## Cấu trúc nội dung

1–4: bài toán, phạm vi, kiến trúc và model. 5–12: bcrypt, register, OTP, cookie/session, persistence/logout, CAPTCHA/rate limit, CRUD/CSRF, forgot/reset. 13–15: ba demo. 16: kiểm thử và phần còn thiếu. A1–A5: ma trận, ngưỡng, routes, cách lưu secret và trả lời phản biện.
