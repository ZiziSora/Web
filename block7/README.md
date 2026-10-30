# The Table — block7

React SPA + Express API + Prisma/PostgreSQL (Supabase). Món ăn được tìm, lọc, sắp xếp và phân trang tại database. Đầu bếp/nguyên liệu tải toàn bộ một lần rồi tìm tên, sắp xếp và phân trang tại client. Trình duyệt nhận JSON qua `fetch`, không tải lại HTML.

## Chạy ứng dụng

Từ thư mục `block7`, cấu hình `api/.env` theo `api/.env.example`. Giữ `DATABASE_URL` ở backend; frontend chỉ cần API origin trong `web/.env` nếu thay đổi cổng mặc định.

```sh
npm ci
npm run db:generate
npm run db:search:setup
npm run seed
npm run dev
```

Mở http://localhost:5176. API mặc định http://localhost:3006/api.

Với database mới chưa có bảng, chạy `npm exec -w @table/api -- prisma db push` trước setup; chạy `npm run seed` sau setup để tạo bộ 1.000 món, 20 đầu bếp, 20 nguyên liệu mẫu. Đầu bếp/nguyên liệu do người dùng tạo cũng được tính vào tổng 20: seed chỉ bổ sung đến ngưỡng này, không xóa khi dữ liệu đã vượt ngưỡng. Khi tên trong bộ mẫu không có vì đã đủ 20 bản ghi khác, món mới dùng liên kết tương ứng từ danh sách hiện có. Với 20 đầu bếp và 20 nguyên liệu, mỗi danh sách tải toàn bộ 20 mục một lần, sau đó hiển thị thêm theo các nhóm 6, 6, 6 và 2 mục để demo Tải thêm và cuộn vô hạn. Bộ món gồm 12 món gốc và 988 biến thể tổng hợp với tên riêng, mô tả, giá, danh mục, trạng thái và liên kết đầu bếp/nguyên liệu. Seed thêm phần còn thiếu theo tên ổn định; chạy lại không nhân đôi bộ mẫu, không ghi đè bản ghi hoặc liên kết đã có. Không xóa dữ liệu trước khi seed. Nếu đổi tên một món mẫu rồi seed lại, tên mẫu ban đầu sẽ được tạo lại và món đã đổi tên vẫn được giữ; vì vậy tổng số có thể lớn hơn 1.000.

`db:search:setup` chạy transaction SQL idempotent: bật `unaccent`/`pg_trgm` (mặc định schema `extensions`, giữ vị trí extension đã tồn tại), tạo cột, trigger và index, backfill riêng trường tìm kiếm. Cần quyền tạo extension và sửa bảng. Chạy lại sau khi tạo lại bảng bằng `db push`. Schema đích lấy từ `?schema=...` trong `DATABASE_URL`, mặc định `public`.

## Quyết định phân trang và tìm kiếm

| Chức năng | UI | Nơi phân trang | Lý do |
| --- | --- | --- | --- |
| Thực đơn sách + quản trị món | Số trang, trước/sau | Server: COUNT + LIMIT/OFFSET, mặc định 6 | Tập 1.000 món, mở lại đúng trang |
| Quản trị đầu bếp/nguyên liệu | Số trang | Client: filter/sort toàn bộ rồi slice 6 mục | Tập nhỏ khoảng 20 mục, đổi trang không gọi API |
| Chọn đầu bếp trong form món | Tải thêm | Client: slice(0, count), tăng count thêm 6 | Chủ động mở rộng danh sách đã tải |
| Chọn nguyên liệu trong form món | Cuộn vô hạn trong khung, có nút Tải thêm dự phòng | Client: cùng cơ chế tăng count | Giữ form gọn, cuộn tiếp không gọi API |

Món không tải đủ 1.000 mục để chia tại browser; `slice` trong sách chỉ chia một trang 6 món thành hai lá. Bảng quản trị nhỏ dùng `/api/{resource}/all`; picker dùng `/api/{resource}/options/all` chỉ lấy ID, tên và chuyên môn/đơn vị. Hai endpoint này không có LIMIT, page hay cursor. Mỗi danh sách chỉ fetch khi mở màn hình hoặc thử lại sau lỗi tải ban đầu; đổi trang, tìm tên, sort hoặc mở rộng picker đều xử lý tại browser. Rời màn hình rồi quay lại sẽ tải mới để nhận thay đổi CRUD.

- Thực đơn: nhập tên/mô tả, tự tìm sau 300 ms ngừng gõ; Enter tìm ngay. PostgreSQL full-text dùng cấu hình `simple` ở cả document và query, tên trọng số A và mô tả trọng số B; `coalesce` xử lý NULL. Không có kết quả thì tìm tên gần đúng và ghi rõ đây là gợi ý.
- Fuzzy dùng `pg_trgm`, `similarity >= 0.3`, có toán tử `%` để hỗ trợ GIN. Full-text/fuzzy xếp điểm giảm dần, `id` tăng dần khi bằng điểm; sort tên/giá không ghi đè thứ hạng tìm kiếm.
- Quản trị món tìm một phần tên bằng PostgreSQL `lower(unaccent(...))`. Đầu bếp/nguyên liệu ở bảng và picker tìm trên mảng đã tải bằng NFD, bỏ dấu và chuyển chữ thường trong JavaScript; tên sắp xếp bằng Intl.Collator tiếng Việt. Mọi ô tìm đều không phân biệt hoa/thường/dấu. Ký tự `%`, `_`, `\` trong tìm tên là ký tự literal.
- Bộ lọc món: danh mục, min/max giá (bao gồm biên), trạng thái phục vụ; kết hợp AND với tìm kiếm trên toàn bộ tập dữ liệu **trước** phân trang. Danh mục lấy DISTINCT từ database.
- Sort thường: ID, tên A–Z/Z–A; món có thêm giá tăng/giảm. Luôn thêm ID tăng dần để thứ tự ổn định. Đầu bếp và nguyên liệu không dùng full-text/fuzzy.
- Cột `searchName` và `searchVector` do trigger cập nhật khi CRUD, không phải generated column gọi `unaccent`; GIN hỗ trợ trigram/full-text, B-tree hỗ trợ tên/giá. Không xuất các cột nội bộ trong DTO.

## URL và trạng thái

Ví dụ: `/admin/dishes?q=nam&category=Vườn+xanh&minPrice=50000&available=true&sort=price-asc&page=2`.

URL danh sách giữ điều kiện và trang qua reload, copy link, Back/Forward. Từ khóa và khoảng giá tự cập nhật sau 300 ms (replace lịch sử); lựa chọn danh mục/trạng thái/sort và xóa điều kiện cập nhật ngay (thêm lịch sử). Điều kiện mới bắt đầu từ trang 1. Chip cho phép bỏ từng điều kiện; Xóa tất cả khôi phục mặc định. Giá sai được báo tại trường nhập và không gửi request. Khi nhập bằng IME, chỉ tìm sau khi kết thúc composition. Back/Forward hoặc điều hướng hủy bản nhập đang chờ. Trang sai ở UI về 1; trang vượt cuối được clamp và đồng bộ URL bằng replace: món clamp ở server, đầu bếp/nguyên liệu clamp ở client. Với món, count, chọn ID và tải bản ghi nằm trong cùng transaction Repeatable Read.

Khi tải trang mới, trang cũ có trạng thái đang tải; chỉ đổi dữ liệu, số trang và lật sách khi phản hồi mới sẵn sàng. Reduced motion không chạy hiệu ứng. Lỗi có nút thử lại.

Nút **Tìm kiếm** và phím Enter gửi ngay điều kiện hợp lệ đang nhập, không chờ debounce và không gửi lặp sau đó. Danh sách quản trị, trang chi tiết và form sử dụng skeleton theo bố cục nội dung; lỗi vẫn có nút thử lại.

Quản trị đầu bếp hiển thị tổng số món và tối đa hai món xem trước. Với nhiều hơn hai món, nút **Xem tất cả** mở danh sách có khung cuộn giới hạn 220 px và ô tìm tên không phân biệt dấu. Danh sách đầy đủ chỉ được dựng khi mở; các liên kết vẫn dẫn tới trang chỉnh sửa món ăn.

Quản trị nguyên liệu dùng cùng danh sách món thu gọn. Menu tải bằng skeleton hai lá sách, gồm sáu vị trí món, cả khi mở trang và chuyển trang. Khi nhảy xa, chỉ tải trang đích rồi thực hiện một lượt lật theo đúng hướng; thời lượng tăng nhẹ theo khoảng cách và giới hạn 845 ms trên desktop. Lá chưa lật giữ nội dung cũ cho đến khi lượt lật hoàn tất; chế độ giảm chuyển động đổi trang trực tiếp.

Picker tải toàn bộ lựa chọn một lần. Tìm kiếm debounce 300 ms (Enter áp dụng ngay, không submit form món); đổi từ khóa lọc lại mảng và hiển thị tối đa 6 kết quả đầu. Tải thêm/cuộn chỉ tăng số mục hiển thị, không gọi API. Lựa chọn giữ riêng bằng ID và chip ngay cả khi không nằm trong kết quả đang xem. Infinite scroll dùng IntersectionObserver có root là khung nguyên liệu; khi đã hết dữ liệu không mở rộng tiếp. Lỗi tải ban đầu có nút thử lại và không chặn nhập các trường khác của form.

**Mở lại form/reload:** tải lại từ lô đầu; chỉ khôi phục liên kết đã lưu của món. Không khôi phục số lô đã cuộn hay nội dung form chưa lưu.

## Hợp đồng API

Frontend đầu bếp/nguyên liệu dùng hai endpoint tải đầy đủ:

- `GET /api/{chefs|ingredients}/all` → `{ok:true,data: Entity[]}` gồm các liên kết món để hiển thị bảng quản trị.
- `GET /api/{chefs|ingredients}/options/all` → `{ok:true,data: Option[]}` chỉ có ID, tên và `specialty`/`unit` cho form chọn.

Không có endpoint `/api/dishes/all`. Các API phân trang/cursor bên dưới được giữ tương thích; UI chỉ dùng server paging cho món, không gọi các API cursor cũ của đầu bếp/nguyên liệu.

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

Mọi mode đều kết hợp được bộ lọc món. `mode=fulltext&fallback=fuzzy` chỉ chuyển sang fuzzy khi không có kết quả full-text trong cùng bộ lọc; `effectiveMode` công bố cách tìm thực tế. `q` trống duyệt danh sách bình thường. Giao diện không có bộ chọn mode: thực đơn gửi fulltext + fallback, quản trị món gửi advanced; đầu bếp/nguyên liệu không gửi query khi tìm tại client.

`GET /api/{chefs|ingredients}/options?q=...&after=6&limit=6`:

```json
{"ok":true,"data":{"items":[{"id":7,"name":"Tên","unit":"kg"}],"nextCursor":7,"hasMore":true}}
```

Đầu bếp có `specialty` thay cho `unit`. Hết dữ liệu: `nextCursor=null`, `hasMore=false`. Lần đầu bỏ `after`; giữ nguyên `q` khi dùng cursor. `GET /api/dishes/facets` trả `data: {categories: string[]}`.

Query không hợp lệ trả business error `VALIDATION_FAILED` theo envelope HTTP 200 hiện có. Validator phân biệt mảng đầy đủ của endpoint all, DTO phân trang của món và DTO cursor cũ. CRUD/detail giữ nguyên.

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
| Chạy seed hai lần trên database mới | Có 1.000 món; lần hai thêm 0; giá và liên kết đã chỉnh sửa còn nguyên; trang 167 có 4 món |
| Số mục 0/1/6/7/13, chọn trang rồi reload | Đúng số trang và phạm vi, không trùng/mất mục; trang quá cuối được clamp |
| Tìm không dấu; đổi filter và sort từ trang 3 | Đúng bộ điều kiện trên toàn bộ dữ liệu; quay về trang 1 |
| Tìm từ chỉ có trong mô tả | Có kết quả full-text |
| Nhập sai tên, không có full-text | Gợi ý gần giống có nhãn riêng, vẫn giữ bộ lọc |
| Tải thêm đầu bếp, cuộn khung nguyên liệu | Mở rộng 6 → 12 → 18 → 20 ở client, giữ lựa chọn; không có request mới |
| Chọn mục rồi tìm tên khác hoặc gặp lỗi tải tiếp | Chip và lựa chọn còn nguyên; thử lại được |
| Đổi query khi request cũ còn chạy | Phản hồi cũ không trộn vào danh sách mới |
| Bàn phím, 1440/390 px, reduced motion | Điều khiển được, không tràn ngang; không lật sách khi giảm chuyển động |

Browser test xuất ảnh vào `artifacts/`, gồm `book-desktop.png`, `book-mobile.png`, `relationship-paging-1440.png`, `relationship-paging-390.png`; `network-batches.json` ghi URL và số mục từng response: món trả từng trang tối đa 6, endpoint all của tập nhỏ trả toàn bộ. DevTools Network cho thấy đổi trang/filter món có fetch mới; đầu bếp/nguyên liệu chỉ fetch khi mở màn hình, sau đó page/search/sort/Tải thêm/cuộn tiếp không có request mới.

Các tình huống được kiểm tra hồi quy: dữ liệu cũ thắng query mới; lựa chọn mất khi tìm khác; Enter trong ô tìm picker submit nhầm form; nút xóa điều kiện bị lặp; dữ liệu bị cắt sau khi lọc trên một trang; phản hồi sai shape đi vào JSX. Kịch bản kiểm thử xác nhận hành vi bằng DOM, URL, request và dữ liệu thực trong schema cô lập.

Tài liệu nền: [PostgreSQL full-text](https://www.postgresql.org/docs/current/functions-textsearch.html), [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html), [Supabase extensions](https://supabase.com/docs/guides/database/extensions).
