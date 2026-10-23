# The Table — React CSR

Bản React SPA của ứng dụng block5: React + Vite + TypeScript + React Router; REST API Express + Prisma 7 + PostgreSQL. Hai ứng dụng chạy khác origin. Giữ nguyên schema và giao diện The Table, không import mã nguồn từ block5.

## Chạy local

Yêu cầu Node >=22.12 và npm. Chạy từ `block6`:

```bash
npm install
cp api/.env.example api/.env
cp web/.env.example web/.env
```

Đặt **cùng DATABASE_URL và schema của block5** trong `api/.env`. Checkout hiện tại đã có cấu hình local dùng chung; không commit file `.env`. `PORT=3006`, `SPA_ORIGIN=http://localhost:5176`. Frontend chỉ có cấu hình công khai `VITE_API_BASE_URL=http://localhost:3006/api`. Không đặt bí mật trong biến `VITE_*`.

```bash
npm run db:generate
npm run db:inspect
npm run dev
```

Mở http://localhost:5176. API ở http://localhost:3006/api/dishes. Dùng thống nhất hostname `localhost`; `127.0.0.1` là origin khác. Không có proxy API. Frontend truy cập API trực tiếp, CORS cho đúng `SPA_ORIGIN` và hỗ trợ OPTIONS/PATCH/DELETE.

Ứng dụng dùng dữ liệu có sẵn. **Không cần push/reset database hoặc seed lại.** CRUD từ block6 thay đổi cùng dữ liệu mà block5 sử dụng. Không tự seed, push schema hoặc chuyển sang dữ liệu giả khi startup/database lỗi. Prisma config có URL local placeholder chỉ để generate/build khi chưa cấu hình; runtime bắt buộc có DATABASE_URL.

## Build và kiểm tra

```bash
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:preview
npm run preview
```

`preview` chạy API đã build cùng Vite preview ở hai origin trên để kiểm tra local; không phải cấu hình hosting công khai. Vite hỗ trợ mở trực tiếp/reload route SPA; asset thiếu vẫn trả 404.

- `test`: Node test runner + Supertest, store memory cô lập, không đọc/ghi PostgreSQL.
- `test:browser`: Playwright/Chrome bật JavaScript, khởi động hai server với port kiểm thử, store cô lập. Kiểm tra tìm kiếm, giữ input khi validation, CRUD ba tài nguyên, điều hướng không tải document, reload, xác nhận/chặn xóa, mobile, lỗi kỹ thuật. Ảnh trong `artifacts/` được gitignore.
- `test:preview`: kiểm tra bản build SPA với API memory; cần port 3006 đang trống. Kiểm tra history fallback, asset 404, CORS và bundle không chứa dấu hiệu bí mật/backend.
- Browser mặc định `/usr/bin/google-chrome`; đặt `CHROME_PATH` nếu cần.
- `test:db`: cần DATABASE_URL và quyền tạo schema. Chỉ tạo/ghi/xóa schema `block6_test_<uuid>` của lượt chạy, không ghi bảng nghiệp vụ dùng chung. Kiểm tra seed hai lần, Decimal, quan hệ, PATCH và xung đột xóa nguyên liệu. Chạy tường minh khi có quyền truy cập database.
- `db:inspect`: chỉ đọc cột/bảng của đúng schema đang kết nối, không in DATABASE_URL.
- `seed`: script mẫu 12 món, 4 đầu bếp, 12 nguyên liệu, transaction/khóa và bỏ qua tên đã có. Chỉ dùng khi chủ động khởi tạo môi trường trống; không được gọi trong startup/build.

## REST API

Cả ba resource `dishes`, `chefs`, `ingredients` có:

| Method | URL | data thành công |
|---|---|---|
| GET | `/api/{resource}` | Mảng, có thể rỗng |
| GET | `/api/{resource}/:id` | Bản ghi |
| POST | `/api/{resource}` | Bản ghi vừa tạo |
| PATCH | `/api/{resource}/:id` | Bản ghi sau sửa |
| DELETE | `/api/{resource}/:id` | null |

`GET /api/dishes?q=bò`: tìm tên không phân biệt hoa/thường, xử lý `%`, `_`, `\` như ký tự tìm kiếm thường.

Kết quả nghiệp vụ luôn HTTP 200:

```json
{"ok":true,"data":[]}
```

```json
{"ok":false,"error":{"code":"VALIDATION_FAILED","message":"Vui lòng kiểm tra thông tin.","fields":{"name":"Vui lòng nhập tên."}}}
```

Không có bản ghi hoặc ID sai trả `NOT_FOUND` trong envelope lỗi nghiệp vụ. Route API sai trả HTTP 404; lỗi hệ thống 500; JSON sai cú pháp 400 hoặc body quá lớn 413. Các lỗi kỹ thuật trả `{ "message": "..." }`, không có `ok/data/error`. API client kiểm tra cả HTTP status lẫn `ok`.

Dish trả `id/name/description/price/category/available`, `chefs: {id,name,specialty}[]`, `ingredients: {id,name,unit}[]`. Chef trả `id/name/specialty/dishes`; Ingredient trả `id/name/unit/dishes`; `dishes` là `{id,name}[]`. Quan hệ rỗng `[]`, không lồng ngược nhiều tầng. ID số nguyên dương, `available` boolean, `price` chuỗi thập phân.

Ví dụ tạo món:

```json
{"name":"Món mới","description":"Mô tả","price":"125000.50","category":"Món Việt","available":true,"chefIds":[],"ingredientIds":[]}
```

Văn bản bắt buộc, trim và giữ giới hạn như block5. Giá không âm, tối đa 10 chữ số phần nguyên và hai số lẻ, không dùng số thực trước khi ghi. POST mặc định `available=true`, quan hệ `[]`. PATCH cập nhật trường có mặt; bỏ qua giữ nguyên, mảng `[]` gỡ toàn bộ quan hệ. Payload PATCH rỗng bị từ chối. Các trường ngoài whitelist không được ghi.

```json
{"ingredientIds":[]}
```

Xóa món giữ đầu bếp/nguyên liệu; xóa đầu bếp giữ món. Nguyên liệu đang dùng không được xóa: HTTP 200, code `VALIDATION_FAILED`, thông báo trong `fields.form`, danh sách `{id,name}[]` tại `details.dishes`. Kiểm tra lại trong transaction Serializable, retry xung đột có giới hạn.

## SPA

- `/dishes?q=...`, `/dishes/:id`: thực đơn và chi tiết.
- `/admin/{resource}`, `/new`, `/:id/edit`, `/:id/delete`: đủ CRUD cho ba tài nguyên.
- `/` và `/admin` điều hướng phía client; URL không tồn tại có màn hình không tìm thấy.
- Mỗi trang tự tải dữ liệu và giữ state cục bộ; không global store/cache. Request đọc cũ được hủy khi đổi trang/query.
- Loading/error/notFound/rỗng; form giữ giá trị và lỗi cạnh trường, khóa submit khi đang gửi. Ghi thành công điều hướng đến danh sách và tải dữ liệu mới.
- Trang xác nhận không ghi khi mount/reload. Chỉ nút xác nhận gọi DELETE; nguyên liệu đang dùng hiển thị link sửa món và không có nút xóa.
- JSX escape dữ liệu; không chèn HTML thô, không method override, không SSR.

## Trạng thái xác minh

Typecheck, HTTP tests, build và browser QA đã chạy đạt trong quá trình triển khai. Kiểm tra database dùng chung và integration test Prisma **chưa chạy** vì lệnh truy cập database bị từ chối quyền thực thi. Không có thao tác seed/push/reset trên database dùng chung. `test:preview` được kiểm tra riêng sau khi bổ sung middleware trả 404 cho asset thiếu.
