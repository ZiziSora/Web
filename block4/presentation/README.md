# Block 4 — Quản lý sinh viên với React

Bài HTML có **14 slide tiếng Việt**, dành cho khoảng **8–10 phút**. Mạch trình bày đi từ mở trang, tải danh sách, phân trang, thêm sinh viên đến kiểm chứng CSR bằng DevTools.

## Mở bài trình bày

Mở trực tiếp `index.html` bằng trình duyệt. Giữ `index.html`, `styles.css`, `slides.js` và `assets/` cùng vị trí khi sao chép. Bài dùng font hệ thống và file cục bộ, có thể mở offline.

- Nút **Trước / Sau** hoặc **← / →**, **↑ / ↓**: chuyển slide.
- **Home / End**: tới slide đầu/cuối.
- **F11**: bật toàn màn hình bằng chức năng của trình duyệt.
- Mở `index.html#slide-7` để bắt đầu từ slide 7.

Ở slide 12–13, mỗi ảnh có một tab riêng để dành vùng hiển thị lớn hơn. Bấm ảnh để mở khung xem lớn; chọn **Vừa màn hình** hoặc **100%** (kích thước gốc, có thể cuộn). Nhấn **Esc**, nút **Đóng** hoặc vùng nền ngoài khung để quay lại. Khi đang xem ảnh phóng to, các phím mũi tên không chuyển slide. Khi focus ở thanh tab ảnh, dùng ←/→ hoặc Home/End để chọn ảnh.

Slide giữ tỷ lệ **16:9**, co lớn tối đa trong vùng trình chiếu. Nền ngoài slide cùng màu trắng. Trên màn hình khác tỷ lệ hoặc khi có thanh điều hướng, vẫn có thể có khoảng trống để giữ nguyên tỷ lệ và nội dung.

Muốn xuất PDF, dùng Print → Save as PDF → Landscape và bật Background graphics. Kiểm tra print preview trước khi lưu.

## Lời thoại theo slide

Đọc **[SCRIPT.md](SCRIPT.md)**. File có 14 mục, khớp số và tiêu đề trên slide, gồm lời thoại, hướng dẫn chỉ vào code/ảnh và câu chuyển sang phần tiếp theo. Các hướng dẫn in nghiêng không cần đọc thành lời.

| Slide | Nội dung |
|---|---|
| 1 | Quản lý sinh viên với React |
| 2 | Từ SSR ở Block 3 đến CSR ở Block 4 |
| 3 | Ứng dụng được chia thành những phần nào? |
| 4 | Điều gì xảy ra khi mở /students? |
| 5 | App lấy danh sách từ API |
| 6 | State nằm ở đâu trong component tree? |
| 7 | StudentList hiển thị từng trang như thế nào? |
| 8 | Form xử lý dữ liệu người dùng nhập |
| 9 | API kiểm tra và lưu sinh viên mới |
| 10 | Sau POST, React cập nhật danh sách |
| 11 | Nếu thêm sinh viên thất bại thì sao? |
| 12 | Kiểm tra CSR bằng HTML response và DOM |
| 13 | Quan sát Network khi submit |
| 14 | Kết quả kiểm thử và những điểm cần nhớ |

## Hai sơ đồ kỹ thuật

- **Slide 6 — Component tree:** nhánh nối thể hiện component cha render component con. Trong mỗi hộp, state, props và ref được tách rõ. App giữ danh sách; StudentList nhận props, không giữ bản sao state của danh sách. Các callback cũng được truyền xuống qua props.
- **Slide 10 — Sequence diagram:** ba lifeline Form, App, API và thứ tự xử lý từ trên xuống. Message dùng mũi tên liền; response/hoàn tất dùng mũi tên ngang nét đứt. Trục dọc nét đứt là lifeline; các thanh mảnh biểu diễn phạm vi xử lý.

Sequence minh họa luồng thành công ở mức ứng dụng: form await callback, App await API, cập nhật state rồi callback hoàn tất và form reset. React render từ state mới; sơ đồ không khẳng định DOM được cập nhật đồng bộ ngay khi gọi setState.

Tham khảo: [React — Sharing State Between Components](https://react.dev/learn/sharing-state-between-components), [UML sequence diagram — Microsoft](https://support.microsoft.com/en-us/visio/create-a-uml-sequence-diagram).

## Bốn ảnh cần bổ sung

Các khung trên slide chỉ ghi tên ảnh để nhóm tự chụp. Đặt file đúng tên trong `assets/`, rồi reload bài HTML. Ảnh tải thành công sẽ tự thay khung hướng dẫn.

| Slide | Tên file | Nội dung cần thấy |
|---|---|---|
| 12 | `csr-html-response.png` | Network → document `/students` → Response: root rỗng, chưa có bảng/tên/email sinh viên. |
| 12 | `csr-dom-rendered.png` | Elements → `#root` → `table` → `tbody`: các hàng đã có ID, tên và email. |
| 13 | `network-before-submit.png` | Log lúc tải ban đầu: document, JS/CSS và GET API; thấy cột Name, Status, Type. |
| 13 | `network-after-submit.png` | POST API loại fetch, status 201; giữ log trước/sau để thấy không có document mới trong khoảng submit. |

Ưu tiên chụp ở production để tách các request của công cụ phát triển. Giữ đủ ngữ cảnh trong ảnh DevTools và crop sao cho chữ đọc được khi trình chiếu.

### Chạy ứng dụng với dữ liệu tạm

Từ thư mục `block4`, dùng Bash:

```bash
npm run build
csr_demo_dir=$(mktemp -d /tmp/block4-demo.XXXXXX)
cp data/students.json "$csr_demo_dir/students.json"
PORT=3005 DATA_FILE="$csr_demo_dir/students.json" npm start
```

Hoặc PowerShell:

```powershell
npm.cmd run build
$csrDemoDir = Join-Path ([System.IO.Path]::GetTempPath()) ("block4-demo-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $csrDemoDir | Out-Null
Copy-Item data/students.json (Join-Path $csrDemoDir "students.json")
$env:PORT = '3005'
$env:DATA_FILE = Join-Path $csrDemoDir "students.json"
npm.cmd start
```

Mở `http://localhost:3005/students`. Những lần thêm thử được lưu vào bản sao JSON. Sau khi dừng server, dùng terminal mới cho lần chạy bình thường. Nếu dùng lại PowerShell, bỏ biến demo bằng `Remove-Item Env:DATA_FILE` và `Remove-Item Env:PORT`.

### Chụp HTML và DOM — slide 12

1. Mở DevTools → Network, chọn All, reload và đợi GET API xong.
2. Chọn document `/students` → Response. Chụp vùng có `<div id="root"></div>` vào `csr-html-response.png`.
3. Mở Elements → `#root` → bảng → `tbody`. Chụp các hàng sinh viên vào `csr-dom-rendered.png`.

Response là HTML gốc; Elements là DOM sau khi JavaScript chạy. Trong production, script nằm ở `/assets/...js`; root trong HTML ban đầu vẫn rỗng.

### Chụp Network — slide 13

1. Chọn All, bật Preserve log, xóa log cũ rồi reload một lần.
2. Đợi tải xong, chụp `network-before-submit.png` với cột Name/Status/Type.
3. Nhập tên và email mới, submit mà không reload.
4. Chọn POST `/api/students`. Chụp `network-after-submit.png` thấy type fetch, status 201 và danh sách request trước/sau.
5. Kiểm tra Payload chứa name/email; Response chứa id/name/email.

Không chỉ dùng filter Fetch/XHR để chứng minh không có document mới, vì filter che request document. Nếu muốn kiểm tra persistence, chỉ reload sau khi đã chụp ảnh after. Sau reload, App trở về trang 1; chuyển tới trang cuối để tìm Student vừa thêm.

Ở development, Vite có WebSocket HMR; header subprotocol là `vite-hmr`. React StrictMode cũng có thể chạy thêm một vòng effect và hủy/gửi lại GET. Hai hành vi này không phải đồng bộ danh sách sinh viên bằng WebSocket.

## Kết quả và kiểm tra trước khi trình bày

Kết quả ứng dụng đã xác nhận ngày **13/10/2026**, giữ lại từ lần kiểm thử trước:

| Lệnh | Kết quả |
|---|---|
| `npm test` | 7/7 test API, storage và pagination đạt. |
| `npm run test:ui` | 4/4 test React UI trong jsdom đạt. |
| `npm run build` | Build production thành công. |
| `npm run test:runtime` | 1/1 test runtime đạt, kiểm tra cả development và production. |

Lần chỉnh bài này chỉ thay đổi presentation. Code ứng dụng được đối chiếu lại; các đoạn trên slide có nhãn định dạng lại/lược trích khi cần. Ví dụ 60 → 61 ở slide 7 giải thích thuật toán, không phải số lượng của phiên chụp.

Kiểm tra tự động bằng jsdom xác nhận số slide/lời thoại, điều hướng, hash links, cơ chế hiển thị ảnh và phép tính co khung. Việc bố trí font, code và ảnh cần kiểm tra trực quan trong browser. Chrome headless chưa được cấp quyền chạy ngoài sandbox ở phiên trước, nên phần kiểm tra trực quan vẫn được ghi nhận là chưa thực hiện.

Trước khi trình bày:

- Mở ở 1280×720 và 1920×1080, kiểm tra code và sơ đồ đọc được, không bị khuất.
- Thử Trước/Sau, phím mũi tên, Home/End và F11.
- Kiểm tra bốn ảnh đã thay khung chờ và đúng nội dung.
- Đọc thử SCRIPT.md, điều chỉnh tốc độ nói để vừa 8–10 phút.
- Nếu cần PDF, kiểm tra print preview.
