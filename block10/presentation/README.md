# Block 10 — RBAC & MFA

Mở `index.html` trực tiếp bằng Chrome/Edge, không cần server, CDN hoặc ứng dụng đang chạy. Template 16:9, màu sắc và điều khiển kế thừa `block9/presentation`.

Có 9 slide chính và 1 phụ lục, khoảng 10–12 phút:

- Slide 3: ma trận RBAC viewer/editor/admin.
- Slide 4: sơ đồ luồng phân quyền tại API.
- Slide 6: sơ đồ bật/thay Authenticator.
- Slide 7: sơ đồ đăng nhập MFA.
- Slide 9: kịch bản trình diễn.

Sơ đồ SVG trong `assets/` được tự dựng theo mã nguồn Block 10 và có thể mở độc lập. Nội dung phân biệt 401 (xác thực/phiên không hợp lệ) với 403 (thiếu quyền), challenge MFA với phiên đăng nhập, và quyền editor đối với món ăn với quyền xem/chọn đầu bếp/nguyên liệu.

Điều khiển: ←/→, Home/End, dropdown, N mở ghi chú, nút toàn màn hình, In/PDF. Tắt JavaScript vẫn cuộn xem/in được toàn bộ slide. `SCRIPT.md` chứa lời trình bày và nguồn cho từng slide.

Chạy lại bộ dựng từ thư mục gốc repository:

```sh
python3 block10/presentation/build.py
```

Nguồn chính: `api/src/app.ts`, `api/src/security.ts`, `api/src/token-sessions.ts`, `web/src/App.tsx`, `web/src/pages/Security.tsx` và README Block 10. Slide mô tả hành vi trong mã nguồn; không tuyên bố các bước demo đã được chạy hoặc các dịch vụ Google/SMTP thật đã được xác minh. Không đọc `.env`, không chứa secret, tài khoản hoặc ảnh QR thật.
