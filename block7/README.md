# The Table — block7

React SPA + Express API + Prisma/PostgreSQL (Supabase). Danh sách được tìm, lọc, sắp xếp và phân trang tại database; trình duyệt cập nhật qua `fetch`, không tải lại HTML.

## Chạy ứng dụng

Từ thư mục `block7`, cấu hình `api/.env` theo `api/.env.example`. Giữ `DATABASE_URL` ở backend; frontend chỉ cần API origin trong `web/.env` nếu thay đổi cổng mặc định.

```sh
npm ci
npm run db:generate
npm run db:search:setup
npm run dev
```

Mở http://localhost:5176. API mặc định http://localhost:3006/api.

Với database mới chưa có bảng, chạy `npm exec -w @table/api -- prisma db push` trước setup; có thể chạy `npm run seed` sau setup để thêm 12 món, 4 đầu bếp, 12 nguyên liệu mẫu. Seed không ghi đè bản ghi có sẵn. Test tự tạo fixture dài hơn; không cần thêm dữ liệu demo vào database nghiệp vụ.

`db:search:setup` chạy transaction SQL idempotent: bật `unaccent`/`pg_trgm` (mặc định schema `extensions`, giữ vị trí extension đã tồn tại), tạo cột, trigger và index, backfill riêng trường tìm kiếm. Cần quyền tạo extension và sửa bảng. Chạy lại sau khi tạo lại bảng bằng `db push`. Schema đích lấy từ `?schema=...` trong `DATABASE_URL`, mặc định `public`.

## Quyết định phân trang và tìm kiếm

| Chức năng | UI | Database | Lý do |
| --- | --- | --- | --- |
| Thực đơn sách | Số trang, trước/sau; số trang trực tiếp trên desktop | COUNT + LIMIT/OFFSET, mặc định 6 | Mở lại đúng trang, giữ bố cục hai lá sách |
| Ba bảng quản trị | Số trang | COUNT + LIMIT/OFFSET, mặc định 6 | Biết tổng và chuyển đến trang cần quản lý |
| Chọn đầu bếp trong form món | Tải thêm | `id > after`, LIMIT 7, trả tối đa 6 | Người dùng chủ động mở rộng lựa chọn |
| Chọn nguyên liệu trong form món | Cuộn vô hạn trong khung, có nút Tải thêm dự phòng | Cursor như trên | Khám phá danh sách dài mà vẫn nhìn thấy phần còn lại của form |

Không còn client paging trên tập dữ liệu tải đầy đủ. Việc `slice` trong sách chỉ chia **một trang gồm 6 món đã nhận** thành hai lá, mỗi lá 3 món. Cursor đọc dư một mục để biết còn dữ liệu; không COUNT cho picker. Các quan hệ trong chi tiết món được dùng để khôi phục lựa chọn đã lưu.

- Thực đơn: nhập tên/mô tả, nhấn Áp dụng. PostgreSQL full-text dùng cấu hình `simple` ở cả document và query, tên trọng số A và mô tả trọng số B; `coalesce` xử lý NULL. Không có kết quả thì tìm tên gần đúng và ghi rõ đây là gợi ý.
- Fuzzy dùng `pg_trgm`, `similarity >= 0.3`, có toán tử `%` để hỗ trợ GIN. Full-text/fuzzy xếp điểm giảm dần, `id` tăng dần khi bằng điểm; sort tên/giá không ghi đè thứ hạng tìm kiếm.
- Quản trị và picker tìm một phần tên. Mọi ô tìm đều không phân biệt hoa/thường/dấu nhờ `lower(unaccent(...))` tại PostgreSQL. Ký tự `%`, `_`, `\` trong tìm tên là ký tự literal.
- Bộ lọc món: danh mục, min/max giá (bao gồm biên), trạng thái phục vụ; kết hợp AND với tìm kiếm trên toàn bộ tập dữ liệu **trước** phân trang. Danh mục lấy DISTINCT từ database.
- Sort thường: ID, tên A–Z/Z–A; món có thêm giá tăng/giảm. Luôn thêm ID tăng dần để thứ tự ổn định. Đầu bếp và nguyên liệu không dùng full-text/fuzzy.
- Cột `searchName` và `searchVector` do trigger cập nhật khi CRUD, không phải generated column gọi `unaccent`; GIN hỗ trợ trigram/full-text, B-tree hỗ trợ tên/giá. Không xuất các cột nội bộ trong DTO.

## URL và trạng thái

Ví dụ: `/admin/dishes?q=nam&category=Vườn+xanh&minPrice=50000&available=true&sort=price-asc&page=2`.

URL danh sách giữ điều kiện và trang qua reload, copy link, Back/Forward. Đổi tìm kiếm/filter/sort bằng nút Áp dụng bắt đầu từ trang 1. Xóa điều kiện khôi phục mặc định. Trang sai ở UI về 1; trang vượt cuối được server clamp rồi đồng bộ URL bằng replace. Count, chọn ID và tải bản ghi nằm trong cùng transaction Repeatable Read.

Khi tải trang mới, trang cũ có trạng thái đang tải; chỉ đổi dữ liệu, số trang và lật sách khi phản hồi mới sẵn sàng. Reduced motion không chạy hiệu ứng. Lỗi có nút thử lại.

Picker tìm kiếm debounce 300 ms (Enter áp dụng ngay, không submit form món); đổi từ khóa hủy request cũ và tải từ cursor đầu. Lựa chọn giữ riêng bằng ID, có chip để xem/bỏ chọn cả mục nằm ngoài kết quả đang xem. Append giữ vị trí cuộn, loại trùng ID, khóa request đồng thời; lỗi giữ dữ liệu và lựa chọn. Infinite scroll dùng IntersectionObserver có root là khung nguyên liệu; lỗi không tự retry liên tục.

**Mở lại form/reload:** tải lại từ lô đầu; chỉ khôi phục liên kết đã lưu của món. Không khôi phục số lô đã cuộn hay nội dung form chưa lưu.

## Hợp đồng API

`GET /api/{dishes|chefs|ingredients}`:

```json
{"ok":true,"data":{"items":[],"meta":{"page":1,"pageSize":6,"total":0,"pages":1,"effectiveMode":"basic"}}}
```

Query: `page` (1..2147483647), `pageSize` (1..50, mặc định 6), `q` (tối đa 200 ký tự), `sort` (`id`, `name-asc`, `name-desc`, `price-asc`, `price-desc`). Sort giá chỉ dùng cho món.

Món nhận thêm `category`, `minPrice`, `maxPrice`, `available=true|false` và `mode`:

| Mode | Hành vi |
| --- | --- |
| `basic` | Tìm một phần tên |
| `advanced` | Tìm tên với điều kiện AND |
| `fulltext` | Tên và mô tả qua `websearch_to_tsquery`/`ts_rank` |
| `fuzzy` | Tên gần giống, ngưỡng 0.3 |

Mọi mode đều kết hợp được bộ lọc món. `mode=fulltext&fallback=fuzzy` chỉ chuyển sang fuzzy khi không có kết quả full-text trong cùng bộ lọc; `effectiveMode` công bố cách tìm thực tế. `q` trống duyệt danh sách bình thường. Giao diện không có bộ chọn mode: thực đơn gửi fulltext + fallback, quản trị món gửi advanced; tài nguyên còn lại gửi basic.

`GET /api/{chefs|ingredients}/options?q=...&after=6&limit=6`:

```json
{"ok":true,"data":{"items":[{"id":7,"name":"Tên","unit":"kg"}],"nextCursor":7,"hasMore":true}}
```

Đầu bếp có `specialty` thay cho `unit`. Hết dữ liệu: `nextCursor=null`, `hasMore=false`. Lần đầu bỏ `after`; giữ nguyên `q` khi dùng cursor. `GET /api/dishes/facets` trả `data: {categories: string[]}`.

Query không hợp lệ trả business error `VALIDATION_FAILED` theo envelope HTTP 200 hiện có. CRUD/detail giữ hợp đồng cũ. Tất cả caller và validator đã chuyển sang paged DTO; không hỗ trợ trả lại mảng danh sách đầy đủ.

## Kiểm thử và nghiệm thu

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:preview
npm run test:db
```

Browser test cần Chrome (`CHROME_PATH` nếu không ở đường dẫn mặc định). Database test cần `DATABASE_URL` có quyền tạo schema/extension; chạy trong schema ngẫu nhiên `block7_test_*`, xóa schema khi kết thúc. MemoryStore chỉ kiểm tra HTTP/UI; thứ hạng full-text, similarity, trigger, wildcard và index được kiểm tra trên PostgreSQL thật.

| Thao tác | Kết quả cần thấy |
| --- | --- |
| Số mục 0/1/6/7/13, chọn trang rồi reload | Đúng số trang và phạm vi, không trùng/mất mục; trang quá cuối được clamp |
| Tìm không dấu; đổi filter và sort từ trang 3 | Đúng bộ điều kiện trên toàn bộ dữ liệu; quay về trang 1 |
| Tìm từ chỉ có trong mô tả | Có kết quả full-text |
| Nhập sai tên, không có full-text | Gợi ý gần giống có nhãn riêng, vẫn giữ bộ lọc |
| Tải thêm đầu bếp, cuộn khung nguyên liệu | Nối từng lô tối đa 6, giữ vị trí và lựa chọn; dừng khi hết |
| Chọn mục rồi tìm tên khác hoặc gặp lỗi tải tiếp | Chip và lựa chọn còn nguyên; thử lại được |
| Đổi query khi request cũ còn chạy | Phản hồi cũ không trộn vào danh sách mới |
| Bàn phím, 1440/390 px, reduced motion | Điều khiển được, không tràn ngang; không lật sách khi giảm chuyển động |

Browser test xuất ảnh vào `artifacts/`, gồm `book-desktop.png`, `book-mobile.png`, `relationship-paging-1440.png`, `relationship-paging-390.png`; `network-batches.json` ghi URL và số mục từng response để chứng minh lô không vượt 6. DevTools Network cho thấy đổi trang/filter chỉ phát sinh fetch API; picker gửi `after` tăng dần và không tải lại HTML.

Các tình huống được kiểm tra hồi quy: dữ liệu cũ thắng query mới; lựa chọn mất khi tìm khác; Enter trong ô tìm picker submit nhầm form; nút xóa điều kiện bị lặp; dữ liệu bị cắt sau khi lọc trên một trang; phản hồi sai shape đi vào JSX. Kịch bản kiểm thử xác nhận hành vi bằng DOM, URL, request và dữ liệu thực trong schema cô lập.

Tài liệu nền: [PostgreSQL full-text](https://www.postgresql.org/docs/current/functions-textsearch.html), [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html), [Supabase extensions](https://supabase.com/docs/guides/database/extensions).
