# Lời thoại — Block 5: The Table

Bài nói gồm **14 slide, khoảng 9 phút**. Thời lượng ở từng mục là mục tiêu, đã tính cả lúc chỉ vào bảng/code. Phần in nghiêng là hướng dẫn cho người trình bày, không đọc thành lời. Có thể dừng lâu hơn ở bảng URL nếu cần giải thích câu hỏi của thầy/cô.

## Slide 1 — The Table: nhà hàng với SSR

*25 giây. Giới thiệu hai nhóm chức năng, không đọc hết tên công nghệ.*

Chào thầy/cô và các bạn. Trong Block 5, nhóm em xây dựng The Table, một website nhà hàng theo mô hình Server-Side Rendering, gọi tắt là SSR. Khách có thể xem, tìm kiếm và xem chi tiết món ăn. Trang quản trị có thêm, sửa, xóa món ăn, đầu bếp và nguyên liệu.

Trong bài trình bày này, nhóm em tập trung vào lý do lựa chọn kỹ thuật, bảng URL và method, sau đó đi qua các luồng xử lý quan trọng trong code.

## Slide 2 — Vì sao chọn cách triển khai này?

*45 giây. Đi theo cột lựa chọn và lý do. Nhấn mạnh TS không phải yêu cầu của đề.*

Nhóm chọn Express và EJS vì server có thể đọc dữ liệu, ghép vào template rồi trả HTML hoàn chỉnh. Form HTML gửi dữ liệu theo cơ chế mặc định, phù hợp yêu cầu không sử dụng fetch hoặc AJAX.

Prisma được dùng để khai báo model và truy vấn dữ liệu, còn Supabase cung cấp database PostgreSQL. Hai phần này có vai trò khác nhau: Prisma là công cụ trong code, Supabase là nơi lưu dữ liệu.

Backend dùng TypeScript để phát hiện lỗi kiểu trước khi chạy, nhưng đây là lựa chọn triển khai, không bắt buộc theo đề. Dữ liệu form vẫn phải kiểm tra lúc chạy. Trang quản trị hiện truy cập trực tiếp, chưa có đăng nhập.

## Slide 3 — Request đi qua những phần nào?

*35 giây. Chỉ luồng ngang từ Browser đến Supabase, rồi đường trả về EJS.*

Browser gửi HTTP request đến Express. Route trong app xử lý yêu cầu rồi gọi store. Store sử dụng Prisma Client và PostgreSQL adapter để truy vấn Supabase. Khi có dữ liệu, Express gọi EJS tạo HTML và trả về browser.

Với thao tác ghi, input được chuẩn hóa và validate trước khi gọi store. Logic này nằm trong domain. Store chịu trách nhiệm truy vấn và các quy tắc liên kết, còn views chứa template hiển thị.

Điểm cần nhớ là code truy vấn database và render template đều chạy phía server. Browser nhận HTML và tải thêm CSS; không cần chạy React để tạo danh sách món ăn.

## Slide 4 — Từ schema trong code đến bảng dữ liệu

*45 giây. Chỉ Dish ở giữa, hai quan hệ N–N, rồi bốn bước thiết lập.*

Ứng dụng dùng code-first: nhóm khai báo model và quan hệ trong schema Prisma, rồi đồng bộ xuống database. Dish lưu thông tin món, trong đó giá có kiểu Decimal. Chef lưu đầu bếp và chuyên môn; Ingredient lưu tên và đơn vị nguyên liệu.

Hai quan hệ đều là nhiều–nhiều. Một đầu bếp biết nấu nhiều món, một món có nhiều đầu bếp biết nấu. Đây là khả năng nấu, không phải phân công hiện tại. Quan hệ với nguyên liệu thể hiện thành phần, chưa có định lượng.

Generate sinh Prisma Client; db push đồng bộ bảng; seed thêm dữ liệu mẫu. Generate không tạo bảng, và db push không tạo lịch sử migration. Hai bảng nối do Prisma tự quản lý. Slide mô tả quy trình cấu hình, không báo cáo kết quả kết nối database.

## Slide 5 — Các URL để xem và tìm món ăn

*30 giây. Chỉ bảng từ trên xuống; phân biệt query q và path parameter id.*

Ở phần khách, tất cả route này dùng GET. Đường dẫn gốc chuyển đến thực đơn. Danh sách món nhận query q để tìm theo tên; không có q thì lấy toàn bộ danh sách. Chi tiết dùng ID trong đường dẫn để tìm một món cụ thể. Admin là điểm vào quản trị và chuyển đến danh sách món.

Các redirect ở hai điểm vào dùng 302 mặc định. Nếu tìm kiếm không có kết quả, server vẫn trả 200 với danh sách rỗng. Riêng ID sai hoặc bản ghi không tồn tại sẽ trả 404.

## Slide 6 — Bảy route cho mỗi tài nguyên quản trị

*40 giây. Giải thích resource một lần, rồi nhóm các GET và các thao tác ghi.*

Bảng này áp dụng cho cả dishes, chefs và ingredients. Resource là ký hiệu rút gọn trên slide; code đăng ký các route cụ thể cho từng tài nguyên.

GET dùng để xem danh sách, mở form thêm, mở form sửa hoặc mở trang xác nhận xóa. Các route này không sửa dữ liệu nghiệp vụ. POST tạo bản ghi, PATCH cập nhật và DELETE xóa sau xác nhận. Khi ghi thành công, cả ba đều redirect 303 về danh sách tương ứng.

Cột method ở đây là method route Express xử lý. Trong browser, form sửa và xóa thực tế gửi POST. Middleware chuyển thành PATCH hoặc DELETE, như phần tiếp theo.

## Slide 7 — Browser gửi POST, Express xử lý PATCH

*45 giây. Chỉ method="post", trường ẩn _method và thứ tự hai middleware.*

Form sửa ở bên trái dùng method POST, đồng thời có input ẩn tên là underscore method, giá trị PATCH. Browser gửi cả các trường món ăn và trường ẩn đó tới server. Form xóa dùng cùng cơ chế nhưng giá trị là DELETE.

Ở bên phải, middleware urlencoded phải chạy trước để đọc body. Sau đó method override chỉ chấp nhận request gốc là POST và giá trị PATCH hoặc DELETE. Middleware đổi req.method, rồi Express mới chọn route xử lý phù hợp.

Vì vậy Network hiển thị POST là đúng. Server vẫn xử lý route PATCH. Code không lấy method từ query string và không cho phép GET biến thành thao tác xóa hoặc sửa dữ liệu.

## Slide 8 — Server đọc dữ liệu rồi render EJS

*40 giây. Chỉ q → store.list → res.render; sau đó chỉ hai nhánh throw trong load.*

Route danh sách đọc q, kiểm tra đó là chuỗi rồi trim. Store truy vấn món có tên phù hợp bằng Prisma, không phân biệt hoa thường, đồng thời lấy các quan hệ. Express truyền danh sách và query vào EJS để tạo HTML.

Với trang chi tiết, hàm load kiểm tra ID trước. Nếu ID sai định dạng thì ném NotFoundError. ID đúng nhưng không có bản ghi cũng ném cùng loại lỗi. Middleware cuối cùng chuyển lỗi này thành trang 404.

Điểm nhận biết SSR là response đã chứa nội dung món ăn. Khi tìm kiếm, browser gửi GET và nhận một document HTML mới, không gọi API JSON bằng fetch để render danh sách.

## Slide 9 — Thêm/sửa: kiểm tra trước khi ghi

*45 giây. Đi theo flow; chỉ values ở đầu và renderForm(...400) trong catch.*

Server không đưa nguyên req.body vào Prisma. FormValues lấy các trường đã định nghĩa và giữ giá trị để có thể hiển thị lại. Validate kiểm tra dữ liệu bắt buộc, độ dài, giá, boolean và định dạng ID liên kết; sau đó trim và chuyển kiểu cần thiết.

Store kiểm tra đầu bếp và nguyên liệu được chọn còn tồn tại trước khi ghi trong transaction. Nếu có lỗi input, code render lại form với values và errors, status 400. Vì giữ values nên người dùng không phải nhập lại tên, mô tả, giá hay chọn lại các checkbox hợp lệ.

PATCH dùng cùng cách kiểm tra, nhưng phải tải bản ghi trước rồi mới gọi update. TypeScript không thay thế những bước validation này.

## Slide 10 — Vì sao ghi thành công phải redirect 303?

*40 giây. Đọc sequence từ trên xuống; nét liền là lời gọi/request, nét đứt là kết quả/response.*

Browser gửi POST. Express validate rồi chờ store và Prisma ghi database hoàn tất. Sau đó server trả 303 kèm Location của danh sách. Browser theo Location bằng GET, server đọc danh sách mới và trả HTML do EJS tạo.

Sau bước này, trang hiện tại là kết quả của GET. Reload chỉ tải lại danh sách, không gửi lại thao tác tạo mới. Đó là ý nghĩa của Post/Redirect/Get trong ứng dụng.

Cập nhật và xóa cũng redirect 303 tương tự. Cần phân biệt: cơ chế này tránh lặp khi reload trang đích, không bảo đảm chống mọi trường hợp gửi hai request ghi độc lập.

## Slide 11 — Xóa đúng bản ghi, đúng quy tắc quan hệ

*45 giây. Chỉ flow trước, ba quy tắc bên trái, rồi kiểm tra ingredient.dishes.length.*

Nhấn Xóa trước hết chỉ gửi GET đến trang xác nhận. Khi người dùng xác nhận, browser mới gửi POST với method override là DELETE. Server kiểm tra chữ ký và thời hạn xác nhận trước khi gọi store.

Xóa món sẽ xóa món và các liên kết, giữ đầu bếp và nguyên liệu. Xóa đầu bếp giữ nguyên các món vì liên kết chỉ thể hiện người đó biết nấu món nào. Nguyên liệu có quy tắc khác: nếu còn dùng trong món thì chặn xóa và hướng dẫn gỡ liên kết trước.

Đoạn code bên phải kiểm tra lại các món đang dùng nguyên liệu ngay trong transaction. Không chỉ tin vào trạng thái khi trang xác nhận được mở, vì dữ liệu có thể đã thay đổi trong thời gian đó.

## Slide 12 — Kiểm soát input, dữ liệu và lỗi trả về

*40 giây. Nêu ngắn các quyết định ở trái rồi dùng bảng status để tổng hợp.*

Có một số quyết định giúp kiểm soát dữ liệu: chỉ nhận các trường cho phép, lưu giá bằng Decimal, dùng truy vấn Prisma thay vì nối input vào SQL. Template EJS escape dữ liệu khi xuất ra HTML. Chuỗi kết nối nằm trong file env được gitignore, không đưa vào template hay log lỗi ứng dụng.

Về response, 400 dùng cho input hoặc thao tác không hợp lệ; form thêm và sửa giữ lại dữ liệu. 404 dùng khi ID, bản ghi hoặc URL không tồn tại. Lỗi hệ thống trả 500 với thông báo thân thiện.

Điều kiện thành công là ghi hoàn tất rồi trả 303; lỗi input không bị chuyển hướng thành thông báo thành công.

## Slide 13 — Nhận biết SSR và method override qua HTTP

*40 giây. Nói rõ đây là minh họa, sau đó chỉ HTML bên trái và HTTP bên phải.*

Slide này là minh họa rút gọn từ source, không phải ảnh hay log của một lần chạy database. Nếu kiểm chứng SSR trong DevTools, ta xem Response của request document. Response phải có tên món, chứ không chỉ kiểm tra Elements vì DOM cũng có thể được tạo bằng JavaScript.

Khi sửa món, request thật trên Network là POST, payload có underscore method bằng PATCH. Server xử lý cập nhật rồi trả 303 với Location. Tiếp theo sẽ có GET nhận HTML mới. Khi kiểm tra cần giữ filter All và Preserve log để không bỏ sót document và redirect.

JavaScript điều hướng bộ slide này là phần riêng, không thuộc website SSR đang được giải thích.

## Slide 14 — Từ yêu cầu đề bài đến cách triển khai

*25 giây. Tổng hợp theo sáu ô, không đọc lại chi tiết từng route.*

Đối chiếu với đề, ứng dụng có trang khách SSR, CRUD đủ ba tài nguyên, method phù hợp, xử lý 400, 404 và redirect 303. Việc xóa có bước xác nhận và tuân theo quy tắc liên kết. Model được quản lý theo hướng code-first.

Qua bài này, điểm chính nhóm muốn làm rõ là server chịu trách nhiệm từ kiểm tra input đến HTML trả về. Browser gửi form và theo redirect; HTTP cho phép giải thích từng bước đó. Nhóm em xin cảm ơn thầy/cô và các bạn.

## Gợi ý trả lời câu hỏi

- **Vì sao Network thấy POST khi sửa hoặc xóa?** Form gửi POST; trường `_method` được middleware xử lý trước khi chọn route PATCH/DELETE trên server.
- **Vì sao GET tới /delete?** Đây chỉ là trang xác nhận; dữ liệu chỉ bị xóa khi submit form và xử lý DELETE.
- **Code-first hay database-first?** Code-first: model nằm trong schema rồi đồng bộ xuống database. Generate sinh client; db push mới đồng bộ bảng.
- **Vì sao ba model nhưng có năm bảng?** Hai bảng bổ sung là bảng nối implicit của hai quan hệ nhiều–nhiều.
- **Vì sao có TypeScript?** Hỗ trợ kiểm tra kiểu khi viết/build code, không phải yêu cầu của đề và không thay thế runtime validation.
- **Có sử dụng Supabase API key không?** App này kết nối PostgreSQL từ server qua Prisma và adapter, dùng `DATABASE_URL`.
- **Có chứng minh database đã chạy bằng bộ slide này không?** Không. Đây là giải thích source và cách kiểm chứng HTTP; không có kết quả kiểm thử database mới.
