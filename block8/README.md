# The Table — block8 (SSR)

Bản SSR của `block7`, chạy độc lập bằng Express 5, EJS, TypeScript, Prisma 7 và PostgreSQL. Server trả HTML đã chứa thực đơn, bảng quản trị và form; JavaScript chỉ bổ sung tương tác. Cả ba danh sách đều tìm/sort/phân trang tại server, 6 mục mỗi trang.

## Chạy ứng dụng

Yêu cầu Node.js >=22.12 và npm. Chạy các lệnh trong `block8`:

```sh
npm ci
cp .env.example .env
# Điền DATABASE_URL bằng kết nối PostgreSQL/Supabase của bạn.
npm run db:generate
npm run db:inspect
```

`DATABASE_URL` dùng cùng máy chủ PostgreSQL cũng được, nhưng schema nghiệp vụ phải là **block8**. Ví dụ template: `postgresql://USER:PASSWORD@HOST:5432/postgres?schema=block8`. Nếu thiếu query `schema`, mọi entrypoint tự bổ sung `block8`. Cấu hình từ chối `public`, `block7` và schema ngoài phạm vi; integration test được phép dùng `block8_test_<hex>`. Giữ các query kết nối khác như `sslmode` khi thêm `schema`. Không đưa `.env` vào Git.

Sau khi kiểm tra schema trống hoặc tương thích:

```sh
npm run db:push
npm run db:search:setup
npm run seed
npm run dev
```

Mở **http://localhost:3008/dishes**. Biến `PORT` đổi cổng. Không dùng `--accept-data-loss` hoặc reset để vượt cảnh báo schema.

Startup/build không tự sửa schema hoặc seed. Setup search bật `unaccent`/`pg_trgm` nếu chưa có (cần quyền tạo extension), giữ vị trí extension hiện có, tạo function/trigger/index trong schema đích và backfill riêng cột tìm kiếm. Chạy lại setup sau khi tạo lại bảng. Seed tạo 1.000 món, 20 đầu bếp, 20 nguyên liệu; chạy lại bỏ qua tên mẫu đã tồn tại, giữ giá và quan hệ người dùng đã sửa. Đầu bếp/nguyên liệu hiện có được tính vào ngưỡng 20, không bị xóa khi vượt ngưỡng. Đổi tên món mẫu rồi seed lại có thể tạo thêm món mang tên mẫu cũ.

Production:

```sh
npm run build
npm start
```

Khi chạy production, giữ `views/`, `public/`, `.env`, dependencies và `dist/` cùng thư mục dự án. Không phụ thuộc source của các block khác.

## SSR và các đường dẫn

| Method | Đường dẫn | Hành vi |
| --- | --- | --- |
| GET | `/`, `/admin` | Chuyển tới danh sách tương ứng |
| GET | `/dishes` | Thực đơn sách, tìm kiếm và bộ lọc |
| GET | `/dishes/:id` | Chi tiết món và quan hệ |
| GET | `/admin/{resource}` | Bảng quản trị, tìm/sort/phân trang server |
| GET | `/admin/{resource}/new` | Form tạo |
| POST | `/admin/{resource}` | Tạo rồi redirect 303 |
| GET | `/admin/{resource}/:id/edit` | Form sửa |
| PATCH | `/admin/{resource}/:id` | Sửa rồi redirect 303 |
| GET | `/admin/{resource}/:id/delete` | Xác nhận xóa, không ghi dữ liệu |
| DELETE | `/admin/{resource}/:id` | Xóa rồi redirect 303 |

`resource` là `dishes`, `chefs`, `ingredients`. Browser gửi form POST với `_method=PATCH` hoặc `_method=DELETE`; không override qua GET, query hoặc header. Không có REST API JSON cho frontend.

Validation trả 400, giữ nội dung và checkbox đã chọn, kể cả ID quan hệ vừa bị xóa. ID/URL/bản ghi không tồn tại trả 404; lỗi hệ thống trả trang 500 thân thiện, có link thử lại, không lộ chuỗi kết nối. Thành công dùng POST → 303 → GET nên reload trang đích không lặp ghi. Thông báo thành công lấy từ mã cố định trên URL.

Giữ quy tắc của block7: giá Decimal(12,2), văn bản trim/giới hạn độ dài, quan hệ nhiều–nhiều; xóa đầu bếp hoặc món chỉ gỡ liên kết liên quan. Nguyên liệu đang được dùng không được xóa; kiểm tra lại trong transaction lúc ghi. Trang xóa dùng token có chữ ký gắn tài nguyên/ID, hết hạn 30 phút và hết hiệu lực khi restart. Quản trị truy cập trực tiếp theo phạm vi bài tập, chưa thêm đăng nhập.

## Tìm kiếm, URL và JavaScript bổ trợ

Ví dụ: `/admin/dishes?q=nam&category=Vườn+xanh&minPrice=50000&available=true&sort=price-asc&page=2`.

- `q`, `sort`, `page`, `category`, `minPrice`, `maxPrice`, `available` nằm trên URL. Link phân trang/chip giữ các điều kiện còn lại; form đổi điều kiện bắt đầu ở trang 1. Trang sai định dạng về 1; trang vượt cuối chuyển hướng tới trang hợp lệ. Điều kiện tìm/lọc sai trả 400.
- Thực đơn tìm full-text trên tên (trọng số A) và mô tả (B), cấu hình `simple`; không có kết quả thì tìm fuzzy tên, ngưỡng similarity >=0.3, có nhãn gợi ý. Khi có từ khóa, độ phù hợp được ưu tiên trước lựa chọn sort. Quản trị cả ba tài nguyên tìm một phần tên không phân biệt hoa/thường/dấu. `%`, `_`, `\` là ký tự literal.
- Bộ lọc món kết hợp AND trước phân trang, khoảng giá gồm cả biên; danh mục lấy DISTINCT từ database. Sort tên/giá thêm ID làm tie-break. Count/chọn ID/tải bản ghi trong cùng transaction Repeatable Read; ghi dùng Serializable và retry xung đột có giới hạn.
- Với JavaScript: tìm kiếm debounce 300 ms, Enter gửi ngay và hủy timer; IME chờ composition kết thúc. Dropdown gửi ngay. Mỗi thay đổi danh sách tải **document HTML mới**, không fetch JSON hoặc hydrate React. ←/→ chuyển trang khi không nhập liệu; Back/Forward/reload dùng lịch sử và URL của browser.
- Thực đơn giữ hai lá sách trên desktop và một cột trên mobile. Hiệu ứng giấy trong lúc điều hướng và khi vào trang mới hoạt động bổ trợ, không trì hoãn request. Reduced motion tắt lật sách/chuyển động minh họa. Minh họa có nút tạm dừng/tiếp tục.
- Server render đủ checkbox đầu bếp/nguyên liệu. JavaScript hiển thị 6 mục đầu, tìm tên cục bộ, chip, tải thêm đầu bếp và cuộn mở rộng nguyên liệu theo nhóm 6, có nút dự phòng. Ẩn checkbox không disable hoặc bỏ khỏi DOM, nên quan hệ vẫn được submit đầy đủ. Enter trong ô tìm picker không submit form món. Không có request bổ sung khi tìm/tải thêm/cuộn picker.
- Bảng đầu bếp/nguyên liệu hiển thị hai món xem trước; `details` mở toàn bộ trong khung cuộn 220 px, JavaScript thêm ô lọc tên.
- **Tắt JavaScript:** tìm kiếm, bộ lọc, phân trang và CRUD dùng link/form; tất cả checkbox vẫn có sẵn trong khung cuộn; danh sách liên quan mở bằng `details`. Không khôi phục form chưa lưu hoặc số nhóm picker đã mở khi reload.

So với block7: HTML không còn là shell React cần fetch mới có dữ liệu; backend gọi store trực tiếp để render EJS. Đầu bếp/nguyên liệu chuyển từ phân trang client sang server. Trình duyệt nhận lại HTML khi đổi trang/điều kiện hoặc lưu form, đổi lại chức năng chính dùng được khi JavaScript bị tắt.

## Kiểm thử

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:db
```

- HTTP tests và browser tests dùng MemoryStore riêng, không ghi database thật. Kiểm tra HTML đã render, cả ba CRUD, 400 giữ input/quan hệ, 303/reload, query/phân trang, escape HTML, xác nhận xóa, chặn xóa nguyên liệu, 404/500 và assets.
- Chrome tests dùng `/usr/bin/google-chrome`, hoặc đặt `CHROME_PATH`. Kiểm tra 1440/390 px, bật/tắt JavaScript, document navigation, Back/Forward, debounce/IME/Enter, bàn phím, picker giữ checkbox ẩn, reduced motion và tràn ngang. Khi có bản build, kiểm tra thêm startup production/404/assets. Ảnh ở `artifacts/` (gitignored).
- Database tests cần kết nối và quyền tạo schema/extension. Chỉ tạo/ghi/xóa schema ngẫu nhiên `block8_test_*`; kiểm tra seed lặp, Decimal, quan hệ, xung đột xóa, phân trang 0/1/6/7/13 mục, phân trang server cho ba resource, full-text/fuzzy thật, wildcard, trigger/index và EXPLAIN. Không dùng MemoryStore để kết luận chất lượng tìm kiếm PostgreSQL.

Cấu trúc: `src/` chứa Express/domain/store/config; `views/` chứa EJS; `public/` chứa CSS/JavaScript/vector; `prisma/` chứa schema/seed; `test/`, `integration/`, `scripts/` chứa kiểm thử và lệnh quản trị. Prisma Client được generate vào `src/generated/` và không commit.
