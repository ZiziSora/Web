# The Table — Nhà hàng SSR

Ứng dụng bài tập trong `block5`: Express 5 + EJS, TypeScript ESM, Prisma 7 và PostgreSQL trên Supabase. Giao diện tiếng Việt, beige/nâu/terracotta, responsive, không dùng ảnh món ăn. Trang khách và toàn bộ CRUD render HTML trên server, hoạt động khi tắt JavaScript.

## Chạy ứng dụng

Yêu cầu Node.js **22.12 trở lên** và npm. Mọi lệnh dưới đây chạy trong `block5`:

```bash
cd block5
npm install
```

Giữ `.env` hiện có. Nếu tạo checkout mới, sao chép `.env.example` thành `.env` rồi đặt `DATABASE_URL` bằng chuỗi PostgreSQL từ phần **Connect** của Supabase. Với mạng chỉ hỗ trợ IPv4, dùng **Session pooler, cổng 5432**; tài khoản pooler thường có dạng `postgres.PROJECT_REF`. Mật khẩu chứa ký tự đặc biệt phải được URL-encode. Không đưa chuỗi kết nối thật vào source code hoặc commit.

Kiểm tra schema **trước** khi đồng bộ:

```bash
npm run db:inspect
```

Lệnh này chỉ đọc danh sách bảng/cột của schema `public`, không in chuỗi kết nối. Nếu schema có bảng sẵn, đối chiếu với `prisma/schema.prisma` trước khi tiếp tục. Không dùng `--accept-data-loss`, reset hoặc xóa bảng để vượt qua cảnh báo.

Khi kết nối hoạt động và schema không xung đột:

```bash
npm run db:generate
npm run db:push
npm run seed
npm run dev
```

Mở **http://localhost:3005**. Có thể đặt `PORT` trong `.env`. Khởi động ứng dụng không tự chạy seed hay đồng bộ schema.

Seed tạo **12 món, 4 đầu bếp, 12 nguyên liệu**, có món tạm hết và các quan hệ mẫu. Chạy lại sẽ bỏ qua bản ghi cùng tên, không ghi đè thông tin đã có hoặc xóa dữ liệu người dùng. Mỗi lần seed là một transaction, có khóa ngăn hai lượt seed chạy đồng thời. Prisma 7 cần chạy generate và seed tường minh.

Bản production:

```bash
npm run build
npm start
```

Bản build đọc EJS từ `views/` và CSS/favicon từ `public/`, vì vậy giữ các thư mục này cùng `dist/`, `.env` và dependencies khi chạy. Server mặc định lắng nghe loopback. Trang quản trị truy cập trực tiếp, đúng phạm vi bài tập không có xác thực.

Nếu Supabase trả `XX000`, kiểm tra project còn hoạt động, chuỗi kết nối đúng project/region, tài khoản pooler, mật khẩu và giới hạn kết nối. Ứng dụng không tự đổi `.env` hoặc chuyển sang dữ liệu giả khi database lỗi.

## Trang và HTTP

| Method | URL | Chức năng |
|---|---|---|
| GET | `/` | Chuyển đến thực đơn |
| GET | `/dishes?q=...` | Danh sách; tìm tên không phân biệt hoa/thường |
| GET | `/dishes/:id` | Đủ thông tin món, các đầu bếp biết nấu, nguyên liệu |
| GET | `/admin` | Chuyển đến quản lý món |
| GET | `/admin/{resource}` | Danh sách quản trị |
| GET | `/admin/{resource}/new` | Form thêm |
| POST | `/admin/{resource}` | Tạo mới |
| GET | `/admin/{resource}/:id/edit` | Form sửa |
| PATCH | `/admin/{resource}/:id` | Cập nhật |
| GET | `/admin/{resource}/:id/delete` | Xác nhận xóa, không xóa dữ liệu |
| DELETE | `/admin/{resource}/:id` | Xóa sau xác nhận |

`{resource}` nhận `dishes`, `chefs`, `ingredients`. Browser gửi form POST, middleware đọc trường ẩn `_method=PATCH` hoặc `_method=DELETE`. Không override GET, query string hoặc header. Không có script phía client, `fetch` hoặc AJAX trong template; CSP cũng tắt thực thi script.

- **400:** dữ liệu không hợp lệ, giữ giá trị đã nhập và lựa chọn quan hệ trên đúng form thêm/sửa. Chặn xóa nguyên liệu đang dùng, hoặc thiếu/hết hạn xác nhận xóa.
- **404:** ID không phải số nguyên dương hợp lệ, bản ghi không có hoặc URL không tồn tại.
- **303:** sau khi thêm/sửa/xóa thành công, chuyển về danh sách kèm thông báo. Reload trang đích chỉ GET, không lặp thao tác.
- **500:** lỗi database hoặc hệ thống, hiển thị thông báo thân thiện. Không ghi đối tượng lỗi chứa thông tin kết nối vào log.

Xác nhận xóa có chữ ký gắn với tài nguyên/ID, hết hạn sau 30 phút. Truy cập GET không thay đổi dữ liệu nghiệp vụ; DELETE thiếu xác nhận hợp lệ bị từ chối. Khởi động lại server làm hết hiệu lực xác nhận cũ, người dùng có thể xác nhận lại.

## Model và quy tắc dữ liệu

| Model | Trường |
|---|---|
| `Dish` | `id`, `name`, `description`, `price: Decimal(12,2)`, `category`, `available` |
| `Chef` | `id`, `name`, `specialty` |
| `Ingredient` | `id`, `name`, `unit` |

ID tự tăng, giới hạn PostgreSQL Int. Tên tối đa 120 ký tự; mô tả 2000; danh mục 80; chuyên môn 200; đơn vị 40. Trường văn bản của từng model bắt buộc, trim trước khi lưu. Giá không âm, tối đa 10 chữ số phần nguyên và 2 chữ số thập phân, nhập dấu chấm cho phần lẻ. Giá được lưu dưới dạng Decimal, không chuyển qua số thực khi ghi; hiển thị theo định dạng VNĐ. Boolean chỉ nhận `true`/`false`.

- **Dish–Chef nhiều–nhiều:** đầu bếp *biết nấu* món, không phải đang được phân công. Xóa đầu bếp chỉ xóa hồ sơ và các liên kết, giữ món ăn.
- **Dish–Ingredient nhiều–nhiều:** chọn nhiều nguyên liệu, chưa quản lý định lượng. Có thể để trống các quan hệ khi thêm/sửa món.
- Sửa quan hệ sẽ thay thế danh sách đã chọn; bỏ chọn tất cả để gỡ liên kết.
- Xóa món chỉ xóa món và các liên kết, giữ đầu bếp/nguyên liệu.
- Chặn xóa nguyên liệu còn dùng; trang xác nhận liệt kê và liên kết đến form sửa các món. Kiểm tra lại trong transaction lúc DELETE, không chỉ dựa vào trang xác nhận trước đó.

Prisma quản lý hai bảng nối implicit (`_ChefToDish`, `_DishToIngredient`), vì vậy vẫn có đúng ba model nghiệp vụ. Các thao tác ghi dùng transaction `Serializable` và thử lại xung đột để tránh âm thầm mất liên kết khi xóa và thêm nguyên liệu đồng thời. Dữ liệu form được kiểm tra và chọn lọc trước khi truyền cho Prisma; không đưa trực tiếp `req.body` vào create/update và không nối input vào raw SQL. EJS escape toàn bộ dữ liệu người dùng.

## Kiểm thử

```bash
npm test
npm run typecheck
npm run build
npm run test:browser
npm run test:db
```

- `npm test`: 17 kiểm thử HTTP bằng store cô lập: SSR, tìm kiếm, chi tiết, CRUD cả ba tài nguyên, 400 giữ dữ liệu, 404, override, 303/reload, xác nhận xóa, quy tắc liên kết, escape HTML và không lộ thông tin kết nối khi lỗi.
- `test:browser`: Chrome headless, desktop 1440px và mobile 390px, **tắt JavaScript**, kiểm tra tìm kiếm, form lỗi, thêm/xóa, reload, chặn xóa nguyên liệu và không tràn ngang. Nếu đã build, kiểm tra thêm khởi động production, trang 404 và static assets. Dùng store kiểm thử, không ghi Supabase. Ảnh chụp lưu trong `artifacts/` được gitignore.
- Browser QA dùng Chrome tại `/usr/bin/google-chrome`; đặt `CHROME_PATH` nếu máy dùng đường dẫn khác.
- `test:db`: cần `DATABASE_URL` hợp lệ và quyền tạo schema. Mỗi lần chạy tạo schema `block5_test_<uuid>`, đẩy schema vào đó, kiểm tra Prisma/HTTP CRUD thật, Decimal, quan hệ, xóa đồng thời; cuối cùng xóa **chỉ schema do chính lượt test tạo**. Không ghi hoặc xóa bảng trong `public`.

Các kiểm thử HTTP và browser không thay thế kiểm thử Supabase thực tế. Khi chưa kết nối được database, `test:db`, `db:push` và seed chưa được xác nhận.

## Cấu trúc chính

```text
src/           Express app, server, validation/domain, Prisma repository
prisma/        Ba model và script seed
views/         EJS trang khách, quản trị, trang lỗi và partials
public/        CSS thuần và favicon
scripts/       Kiểm tra database chỉ đọc, browser QA
test/          HTTP tests, fixture cô lập, integration tests PostgreSQL
```

`.env` được gitignore ở gốc repo; `.env.example` chỉ chứa placeholder. Không sửa các bài trong `block3` hoặc `block4`.
