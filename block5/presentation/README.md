# Block 5 — The Table: SSR và quyết định kỹ thuật

Bộ **14 slide HTML tiếng Việt**, dành cho khoảng **8–10 phút**. Phong cách trắng–navy–đỏ, canvas 16:9 và cách điều hướng kế thừa bài trình bày Block 4. Nội dung tập trung vào quyết định kỹ thuật, bảng URL/method và các luồng code chính.

## Mở và trình chiếu

Mở trực tiếp **[index.html](index.html)** bằng trình duyệt. Khi sao chép, giữ `index.html`, `styles.css` và `slides.js` trong cùng thư mục. Không cần chạy server, kết nối Supabase, tải font hoặc thư viện từ Internet.

- Nút **Trước / Sau**, **← / →** hoặc **↑ / ↓**: chuyển slide.
- **Home / End**: đến slide đầu/cuối.
- **F11**: bật/tắt toàn màn hình bằng trình duyệt.
- Mở `index.html#slide-7` để bắt đầu từ slide 7.
- Slide tự co theo vùng trình chiếu, giữ tỷ lệ **16:9**, không kéo giãn nội dung.

JavaScript trong bộ slide chỉ phục vụ điều hướng. Website SSR của Block 5 không dùng script này và không có fetch/AJAX để gửi form.

## Lời thoại và nội dung

**[SCRIPT.md](SCRIPT.md)** có lời thoại khớp đủ 14 slide, hướng dẫn chỉ vào bảng/code/sơ đồ và các câu chuyển. Tổng thời gian mục tiêu **9 phút**; phần in nghiêng không cần đọc thành lời. Cuối file có gợi ý trả lời các câu hỏi thường gặp.

| Slide | Tiêu đề | Thời lượng |
|---|---|---|
| 1 | The Table: nhà hàng với SSR | 25 giây |
| 2 | Vì sao chọn cách triển khai này? | 45 giây |
| 3 | Request đi qua những phần nào? | 35 giây |
| 4 | Từ schema trong code đến bảng dữ liệu | 45 giây |
| 5 | Các URL để xem và tìm món ăn | 30 giây |
| 6 | Bảy route cho mỗi tài nguyên quản trị | 40 giây |
| 7 | Browser gửi POST, Express xử lý PATCH | 45 giây |
| 8 | Server đọc dữ liệu rồi render EJS | 40 giây |
| 9 | Thêm/sửa: kiểm tra trước khi ghi | 45 giây |
| 10 | Vì sao ghi thành công phải redirect 303? | 40 giây |
| 11 | Xóa đúng bản ghi, đúng quy tắc quan hệ | 45 giây |
| 12 | Kiểm soát input, dữ liệu và lỗi trả về | 40 giây |
| 13 | Nhận biết SSR và method override qua HTTP | 40 giây |
| 14 | Từ yêu cầu đề bài đến cách triển khai | 25 giây |

## Sơ đồ, code và ví dụ

- **Slide 3:** kiến trúc Browser → Express → Store → Prisma → Supabase, rồi dữ liệu về EJS để tạo HTML. Validation áp dụng dữ liệu ghi; truy vấn database chạy trên server.
- **Slide 4:** ba model và hai quan hệ N–N. Chef–Dish thể hiện đầu bếp **biết nấu**, không phải phân công. Hai bảng nối implicit không phải model nghiệp vụ mới.
- **Slide 5–6:** bảng đầy đủ URL/method. `{resource}` là ký hiệu trên slide cho `dishes`, `chefs`, `ingredients`; source đăng ký route cụ thể qua vòng lặp.
- **Slide 10:** sequence đọc từ trên xuống; mũi tên liền là request/lời gọi, nét đứt là kết quả/response. Ghi hoàn tất trước 303, sau đó browser GET danh sách. PRG tránh gửi lại thao tác ghi khi reload trang đích, không phải cơ chế chống mọi kiểu gửi trùng.
- **Slide 13:** ví dụ HTML và HTTP **minh họa từ source**, không phải ảnh DevTools hoặc log thu từ Supabase. ID `1` và tên món là ví dụ.

Sơ đồ dùng SVG inline; không có ảnh, khung chờ ảnh, font tải từ xa hay dependency bên ngoài. Code được lược trích và định dạng lại để đọc khi trình chiếu; mỗi khối ghi file nguồn. Một số option/nhánh xử lý không liên quan bị bỏ và có nhãn tương ứng. HTML form ở slide 7 là kết quả render minh họa cho ID 1, không phải nguyên văn biểu thức EJS tạo action.

Các điểm cần diễn đạt chính xác:

- Browser gửi **POST**; middleware đổi thành **PATCH/DELETE** trước khi Express chọn route.
- GET mở form/xác nhận, không cập nhật hoặc xóa dữ liệu nghiệp vụ.
- Redirect ở `/` và `/admin` dùng **302**; ghi thành công dùng **303**.
- Input sai trả **400** và giữ dữ liệu form; ID sai/không có trả **404**.
- Xóa đầu bếp giữ món. Nguyên liệu còn được dùng phải được gỡ khỏi các món trước khi xóa.
- `db:generate` sinh client; `db:push` đồng bộ schema mà không tạo lịch sử migration.
- TS chỉ kiểm tra kiểu phía server; validation lúc chạy vẫn cần thiết.

## Xuất PDF

1. Mở `index.html` trong Chrome/Edge.
2. **Ctrl+P → Save as PDF**, chọn tất cả các trang.
3. Bật **Background graphics**, tắt headers/footers nếu đang bật; giữ scale 100% và lề None.
4. CSS đã đặt kích thước trang **16:9**. Kiểm tra preview đủ **14 trang**, không mất code, bảng hoặc sơ đồ. Không ép sang A4 nếu muốn giữ đúng tỷ lệ slide.

Khi in, CSS hiển thị toàn bộ slide dù đang ở slide nào, ẩn thanh điều hướng và thanh tiến trình. Không cần bấm lần lượt từng slide trước khi in.

## Kiểm tra và giới hạn

Chỉ bổ sung thư mục presentation. Không sửa ứng dụng, Block 4, `.env` hoặc database; không chạy kiểm thử database để làm bộ slide này.

Nội dung được đối chiếu với route, middleware, validation, Prisma store, schema và EJS trong source hiện tại. Bộ slide không khẳng định database đã kết nối, schema đã được đồng bộ hoặc kiểm thử database đã đạt. Slide cuối là bảng đối chiếu yêu cầu với cách triển khai, không phải bảng kết quả test.

Kiểm tra cục bộ bằng jsdom đã đạt: đủ 14 slide và 14 lời thoại khớp tiêu đề/số trang; nút và phím điều hướng, hash, trạng thái đầu/cuối; tham chiếu ARIA; tính toán co khung ở viewport 1280×720 và 1920×1080; tài nguyên offline và quy tắc CSS in 16:9. JavaScript cũng đã qua kiểm tra cú pháp bằng Node.js.

Chrome headless chưa được cấp quyền chạy trong phiên này, nên **chưa xác nhận trực quan bố cục/font, không tràn nội dung và PDF thực tế đủ 14 trang**. Kiểm tra jsdom chỉ xác nhận logic và cấu trúc, không thay thế bước xem từng slide và print preview trong trình duyệt.

Trước khi thuyết trình, đọc thử lời thoại và kiểm tra màn hình trình chiếu thực tế. Source code dài đã được rút gọn, vì vậy khi trả lời câu hỏi chi tiết nên mở file gốc tương ứng.
