# Block 4 — Student List dạng CSR

Ứng dụng React + Express + Vite, có form thêm sinh viên, phân trang 10 hàng và lưu dữ liệu bền vững trong file JSON.

## Chạy ứng dụng

Yêu cầu Node.js từ 22.12 trở lên (môi trường hiện tại dùng Node 24.11).

```powershell
cd D:\Web\block4
npm.cmd install
npm.cmd run dev
```

Mở **http://localhost:3004/students**. `/` chuyển hướng tới `/students`.

Chạy bản production:

```powershell
npm.cmd run build
npm.cmd start
```

Dừng development trước khi chạy production trên cùng cổng. Nếu chưa build, server báo cần build trước. PowerShell hiện chặn `npm.ps1`, nên dùng `npm.cmd` thay vì thay đổi Execution Policy.

Có thể đổi cổng bằng `$env:PORT = '3005'`. `DATA_FILE` cho phép chỉ định file dữ liệu khác để thử nghiệm; đường dẫn tương đối tính từ thư mục đang chạy lệnh. File đó phải tồn tại và chứa mảng Student hợp lệ. Không đặt `DATA_FILE` nếu muốn dùng dữ liệu mặc định.

## Những quyết định đã thống nhất

### React + Express + Vite

- **React** quản lý state và render giao diện phía client bằng `createRoot`. HTML từ server chỉ chứa phần tử mount, không render sẵn danh sách sinh viên.
- **Express** phục vụ trang và API đọc/thêm Student, đồng thời ghi file JSON.
- **Vite** xử lý JSX, môi trường phát triển và build frontend. Vite không bắt buộc theo đề; được chọn để giảm cấu hình thủ công. Development tích hợp Vite middleware vào Express. Production chỉ phục vụ bản build, không chạy Vite.

Frontend và API dùng cùng origin, không cần cấu hình CORS. JavaScript đồng nhất với Block 3 và giảm cú pháp cho bài học; CSS thuần đủ cho bố cục này. State cục bộ đủ dùng, không cần Redux hoặc store ngoài.

### Nguồn dữ liệu và lưu trữ

`data/students.json` ban đầu là bản sao 52 Student trong `block3/data/students.json` tại thời điểm triển khai. Block 1 trong workspace là trang giới thiệu nhóm, không có seed Student, nên đã thống nhất dùng dữ liệu Block 3. Hai block dùng file riêng và không tác động dữ liệu của nhau.

Student gồm `{ id, name, email }`. Server cấp ID bằng ID lớn nhất cộng 1. Dữ liệu mới ghi vào JSON, tồn tại sau refresh và khởi động lại server; không dùng localStorage. File chỉ được khởi tạo một lần khi tạo dự án, không reset theo mỗi lần chạy.

Đề gốc không cần API/database. Lưu bền vững vào file JSON là yêu cầu bổ sung đã thống nhất, vì vậy bài này có GET/POST API. Trình duyệt gửi dữ liệu đến Express; server ghi file, trình duyệt không truy cập trực tiếp file trên máy chủ.

JSON phù hợp bài tập nhỏ, chưa thay thế database cho ứng dụng lớn. Ghi được xếp hàng trong **một tiến trình Express**, sau đó ghi file tạm và rename thay thế file chính. Cách này tránh mất bản ghi khi nhiều POST đồng thời trong cùng tiến trình. Không chạy nhiều tiến trình cùng ghi một file. Thiếu file hoặc JSON hỏng sẽ báo lỗi, không tự ghi đè bằng seed.

### State và form

`App` giữ một state `students` duy nhất. `StudentList` nhận dữ liệu qua props; số lượng và các hàng của trang hiện tại được tính từ danh sách này. State trang hiện tại và state riêng của form không phải bản sao danh sách.

`AddStudentForm` dùng controlled input: `value` đọc state, `onChange` cập nhật state. Submit chặn hành vi mặc định, kiểm tra input và POST bằng fetch. Server trim tên/email, kiểm tra bắt buộc, email hợp lệ, tên tối đa 100 ký tự, email tối đa 254 ký tự và cấm email trùng không phân biệt hoa/thường như Block 3.

Chỉ sau khi server xác nhận đã ghi thành công, React thêm Student trả về vào state, chuyển tới trang cuối và reset form. Đây là cập nhật sau xác nhận, không phải optimistic update. Lúc lưu khóa form; lỗi giữ input và danh sách để thử lại. Nếu kết nối bị mất sau khi server đã ghi, tải lại trang để kiểm tra; gửi lại email đã lưu sẽ bị từ chối trùng.

### Giao diện và phân trang

Giữ phong cách Block 3: màu xanh/đỏ, form bên trái và bảng bên phải. Thêm phân trang **10 hàng mỗi trang** để bảng không quá dài; mobile chuyển thành một cột và bảng cuộn ngang.

GET tải toàn bộ danh sách, React phân trang bằng `slice`. Với 52 Student ban đầu có 6 trang, trang cuối 2 hàng. Có Trước/Sau, số trang, trạng thái trang hiện tại và dấu ba chấm khi nhiều trang. Thêm mới ở cuối danh sách và chuyển đến trang cuối để nhìn thấy ngay. Không có sửa, xóa, tìm kiếm hoặc chọn kích thước trang.

### So sánh với Block 3

Block 3 dùng Express/EJS render HTML phía server và submit theo luồng POST → redirect → tải document. Block 4 render danh sách bằng React trên client, POST bằng fetch và cập nhật state, không điều hướng hoặc reload khi thêm. Cả hai vẫn lưu dữ liệu phía server.

## API

| Endpoint | Request | Response thành công |
|---|---|---|
| `GET /api/students` | Không có | `200`, mảng Student |
| `POST /api/students` | JSON `{ "name": "Nguyễn Văn An", "email": "an@example.com" }` | `201`, Student có ID |

Lỗi trả JSON `{ code, message }`: `400` input/body sai, `409` email trùng, `500` lỗi đọc/ghi, `404` API không tồn tại. Server không trả thành công trước khi ghi xong. API không bị frontend fallback đổi thành HTML.

## Kiểm thử và nghiệm thu

```powershell
npm.cmd test
npm.cmd run test:ui
npm.cmd run build
```

Kiểm thử tự động dùng thư mục/file tạm, không sửa dữ liệu thật: GET/POST, validation, trùng email, ghi đồng thời, khôi phục sau lỗi, persistence bằng store mới, JSON hỏng/thiếu, lỗi ghi và phân trang.

`test:ui` kiểm tra React trong jsdom: chuyển trang, tạo trang mới, chặn submit mặc định, chống submit lặp, chờ server rồi reset form, giữ input khi lỗi và thử tải lại. Đây là kiểm thử tương tác component, không thay thế kiểm tra trực quan bằng browser.

Sau khi build, `npm.cmd run test:runtime` chạy server development rồi production trên cổng tạm và file JSON tạm, kiểm tra HTML CSR, assets, API và persistence sau khi đổi tiến trình.

Kiểm tra trên browser ở cả development và production:

1. Mở `/students`, xác nhận số lượng và các trang; chuyển Trước/Sau/số trang, kiểm tra đầu/cuối. Seed ban đầu có 52 Student và 6 trang.
2. Mở DevTools → Network, bật Preserve log, xóa log sau khi tải ban đầu; nhập tên/email mới rồi submit bằng nút hoặc Enter.
3. Có POST `/api/students` dạng fetch, response 201; không có request loại **document** mới. Student xuất hiện ở trang cuối, số lượng tăng, form trống và báo thành công.
4. Thêm đến khi phát sinh trang mới; kiểm tra ID không trùng. Refresh rồi khởi động lại server, xác nhận dữ liệu còn tồn tại.
5. Thử input sai/email trùng: có thông báo, form giữ nguyên và danh sách không tăng. Thử Offline hoặc file thử nghiệm hỏng để kiểm tra lỗi và nút thử lại.
6. Kiểm tra viewport desktop/mobile, label/focus bàn phím, không lỗi console hoặc React key.

Thao tác thêm trong browser lưu dữ liệu thật. Khi chỉ thử nghiệm, sao chép JSON sang file tạm và đặt `DATA_FILE` trỏ tới bản sao trước khi chạy server.
