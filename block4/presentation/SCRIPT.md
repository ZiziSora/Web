# Lời thoại — Block 4: Quản lý sinh viên với React

Script dành cho khoảng **8–10 phút**. Phần in nghiêng là hướng dẫn thao tác, không cần đọc thành lời. Mỗi mục khớp với số và tiêu đề trong bài HTML.

## Slide 1 — Quản lý sinh viên với React

*Khoảng 25–30 giây. Giới thiệu bài toán và các chức năng ở trang đầu.*

Chào thầy/cô và các bạn. Trong Block 4, nhóm em xây dựng một ứng dụng quản lý sinh viên bằng React. Ứng dụng có ba chức năng chính: xem danh sách, thêm sinh viên và phân trang, mỗi trang hiển thị mười hàng.

Mục tiêu của bài này là hiểu cơ chế Client-Side Rendering, hay CSR. Nhóm em sẽ đi theo những gì xảy ra khi mở trang và thêm một sinh viên, sau đó kiểm tra lại bằng DevTools. Trước hết, em nhắc lại một điểm khác với cách nhóm đã làm ở Block 3.

## Slide 2 — Từ SSR ở Block 3 đến CSR ở Block 4

*Khoảng 35–40 giây. Chỉ hai luồng SSR và CSR, rồi hàng “HTML response đầu tiên”.*

Ở Block 3, server đọc dữ liệu rồi dùng EJS để tạo HTML. Khi browser nhận được trang, danh sách sinh viên đã nằm trong HTML đó. Đây là Server-Side Rendering, hay SSR.

Sang Block 4, server vẫn lưu dữ liệu, nhưng HTML gửi về ban đầu chỉ có một khung để React mount vào. Browser chạy JavaScript, gọi API lấy danh sách rồi render giao diện. Vì vậy, điểm quyết định ở đây là nơi tạo HTML của giao diện, chứ không phải dữ liệu nằm trên server hay trên client.

Luồng thêm sinh viên cũng thay đổi. Block 3 submit form rồi redirect và tải document mới. Block 4 gửi POST bằng fetch, nhận JSON và cập nhật state. Để theo dõi rõ những bước này, em giới thiệu nhanh các phần trong ứng dụng.

## Slide 3 — Ứng dụng được chia thành những phần nào?

*Khoảng 30–35 giây. Chỉ thư mục src, server và shared.*

Ứng dụng có frontend React và backend Express. Trong thư mục src là các component, hàm gọi API và logic pagination. Những phần này chạy trên browser. Thư mục server chứa HTTP server, API và logic đọc ghi dữ liệu. File validation trong shared được dùng ở cả hai phía.

Nhóm em chọn JSON file để lưu dữ liệu vì phạm vi bài tập nhỏ. Vite hỗ trợ xử lý JSX, chạy môi trường development và build frontend. Khi chạy production, Express phục vụ các file đã build trong dist.

Có hai điểm khởi động cần phân biệt: server/index.js mở server, còn src/main.jsx khởi động React trên browser. Bây giờ em bắt đầu từ lúc người dùng mở đường dẫn /students.

## Slide 4 — Điều gì xảy ra khi mở /students?

*Khoảng 35–40 giây. Chỉ root rỗng ở code bên trái và createRoot ở bên phải.*

Khi mở /students, browser gửi GET để nhận HTML. Trong file index.html, phần body có một div với id là root, nhưng bên trong chưa có bảng hay thông tin sinh viên. Trang cũng tải script frontend.

Sau khi JavaScript chạy, main.jsx gọi createRoot và render App vào phần tử root đó. Đây là bước React bắt đầu tạo giao diện trên browser. Lúc này App có danh sách rỗng và trạng thái loading, nên giao diện sẽ báo đang tải danh sách.

Ở production, đường dẫn main.jsx được thay bằng file JavaScript đã build; cơ chế render vẫn như vậy. Vậy dữ liệu để tạo bảng đến từ đâu? Phần tiếp theo là effect lấy danh sách từ API.

## Slide 5 — App lấy danh sách từ API

*Khoảng 45–50 giây. Đi theo requestStudents → setStudents → ready; sau đó chỉ response.ok.*

Sau khi App mount, useEffect gọi requestStudents. Không truyền method thì fetch sử dụng GET đến /api/students. Server trả về mảng sinh viên, và App đưa mảng đó vào state bằng setStudents. App cũng đặt trang hiện tại về một và chuyển status sang ready để hiển thị bảng, mở form.

Hàm requestStudents đọc response thành JSON và kiểm tra response.ok. Bước này cần thiết vì fetch không tự ném lỗi khi server trả HTTP 400, 409 hay 500. Khi có lỗi tải danh sách, App hiện thông báo và cho phép thử lại bằng cách tăng loadAttempt.

AbortController dùng để hủy request khi effect cleanup, đồng thời code bỏ qua kết quả của request đã bị hủy. Sau bước này, danh sách đã có trong state. Em sẽ chỉ rõ component nào giữ state đó và component nào nhận dữ liệu để hiển thị.

## Slide 6 — State nằm ở đâu trong component tree?

*Khoảng 45–50 giây. Đọc sơ đồ từ App xuống hai component con. Đây là cấu trúc component, không phải thứ tự chạy.*

Trong sơ đồ này, App là component cha, render AddStudentForm và StudentList. State có thể hiểu là dữ liệu React ghi nhớ giữa các lần render. App giữ students, page và các trạng thái liên quan đến việc tải danh sách.

Form có state riêng cho tên, email, trạng thái đang lưu và thông báo. submitting là ref để chặn submit lặp, nên được đặt ở một dòng riêng. Còn StudentList không có local state: component này nhận danh sách, trang và trạng thái qua props, rồi tính những hàng cần hiển thị.

Props là dữ liệu hoặc hàm được component cha truyền xuống. Vì vậy onAddStudent cũng là một prop. Khi form cần thêm sinh viên, nó gọi hàm này; form không trực tiếp sửa state students của App. Nhánh trong sơ đồ chỉ thể hiện quan hệ cha–con. Luồng gọi callback sẽ được trình bày bằng sequence diagram sau. Trước mắt, em giải thích cách StudentList dùng các props để phân trang.

## Slide 7 — StudentList hiển thị từng trang như thế nào?

*Khoảng 40–45 giây. Chỉ công thức start, slice và ví dụ 60 → 61.*

Ứng dụng tải toàn bộ danh sách bằng GET API. Pagination hiện tại được thực hiện trên client. PAGE_SIZE bằng mười, còn tổng số trang được tính bằng cách lấy số sinh viên chia cho mười và làm tròn lên.

Với trang hiện tại, start bằng số trang trừ một, nhân với PAGE_SIZE. StudentList dùng slice từ start đến start cộng mười để lấy các hàng. Khi nhấn Sau hoặc chọn một số trang, onPageChange gọi setPage của App. State trang đổi nên React render lại các hàng, không cần gọi thêm API.

pageItems tạo danh sách các số trang và dấu ba chấm khi có nhiều trang. Ví dụ có sáu mươi sinh viên thì có sáu trang; thêm người thứ sáu mươi mốt sẽ tạo trang thứ bảy với một hàng. Đây là ví dụ thuật toán. Tiếp theo, em chuyển sang thao tác tạo sinh viên mới từ form.

## Slide 8 — Form xử lý dữ liệu người dùng nhập

*Khoảng 45–50 giây. Chỉ value/onChange trước, rồi preventDefault và await onAddStudent.*

Form dùng controlled input: value đọc từ state, còn onChange cập nhật state mỗi lần người dùng nhập. Nhờ vậy, React luôn biết tên và email hiện tại, và có thể reset input bằng cách đặt state về chuỗi rỗng.

Khi submit, handleSubmit gọi preventDefault để chặn hành vi submit và điều hướng mặc định của browser. Hàm kiểm tra input bằng validation dùng chung. Nếu input chưa hợp lệ thì hiện thông báo và dừng trước khi gọi callback.

Nếu hợp lệ, form khóa submit bằng ref submitting và cập nhật saving để khóa input, nút bấm. Sau đó nó await onAddStudent, tức là đợi hàm do App truyền xuống hoàn tất. Thành công thì reset input; lỗi thì giữ lại để người dùng sửa. Callback của App gửi POST đến API, nên bước tiếp theo diễn ra trên server.

## Slide 9 — API kiểm tra và lưu sinh viên mới

*Khoảng 35–40 giây. Chỉ POST route bên trái và writeFile/rename bên phải.*

API nhận tên và email từ body JSON. Dù form đã kiểm tra input, server vẫn validate lại vì request có thể được gửi trực tiếp ngoài giao diện. Nếu hợp lệ, API gọi StudentStore để thêm sinh viên.

Store đọc danh sách, kiểm tra email trùng và cấp ID bằng ID lớn nhất cộng một. Những lần ghi được xếp hàng trong một tiến trình. Dữ liệu được ghi vào file tạm rồi rename để thay file chính, nên API chỉ trả 201 sau khi việc lưu đã hoàn tất.

Response là đối tượng Student có id, name và email. Server trả dữ liệu JSON; React trên browser sẽ dùng dữ liệu đó để cập nhật giao diện. Em quay lại frontend để xem chuyện gì xảy ra sau response này.

## Slide 10 — Sau POST, React cập nhật danh sách

*Khoảng 45–50 giây. Đi theo sequence diagram từ trên xuống; chỉ dòng functional update ở code bên phải.*

Sequence diagram thể hiện thứ tự xử lý. Form gọi onAddStudent của App, App gửi POST và chờ API trả Student có ID. Khi request thành công, App cập nhật students rồi page. Hàm callback hoàn tất, và handleSubmit của form tiếp tục để xóa input.

Dòng setStudents nhận một callback, dùng previous để tạo mảng mới chứa danh sách cũ và Student vừa nhận. Đây là functional update: React cung cấp state mới nhất cho callback. Cách này tạo mảng mới thay vì dùng push để thay đổi trực tiếp mảng state.

setPage chuyển tới trang cuối để người dùng thấy sinh viên mới. React render lại StudentList với props mới; đó là cập nhật giao diện trong document hiện tại, không phải reload trang. Các mũi tên ngang nét đứt trong sơ đồ là response hoặc bước hoàn tất. Đây là luồng thành công; nếu có lỗi thì form xử lý ra sao?

## Slide 11 — Nếu thêm sinh viên thất bại thì sao?

*Khoảng 30–35 giây. Chỉ ba trường hợp lỗi và đoạn finally.*

Có ba tình huống chính. Input sai thì form chặn trước khi gửi POST. Email trùng thì server trả 409, và form hiển thị message từ response. Nếu mất kết nối hoặc việc lưu thất bại, form báo lỗi và cho phép thử lại.

Điểm quan trọng là reset tên và email chỉ nằm trong nhánh thành công. finally chỉ mở lại khóa submit và trạng thái saving. Vì vậy khi lỗi, người dùng vẫn còn input để sửa, còn state danh sách chưa được thêm Student từ request đó.

Nếu kết nối mất sau khi server đã lưu, cần reload để kiểm tra trước khi gửi lại. Đến đây mình đã hiểu cả luồng thành công và thất bại. Em dùng DevTools để đối chiếu những gì code cho thấy với hành vi của trang.

## Slide 12 — Kiểm tra CSR bằng HTML response và DOM

*Khoảng 35–40 giây. Chỉ ảnh Response trước, ảnh Elements sau. Bổ sung đúng hai file ảnh được ghi trên slide.*

Ảnh bên trái là HTML response của request document /students. Phần root còn rỗng, chưa có bảng và tên sinh viên. Đây là nội dung server gửi về ban đầu.

Ảnh bên phải là tab Elements sau khi trang tải xong. Lúc này root đã có bảng và các hàng sinh viên. Elements hiển thị DOM hiện tại, sau khi React chạy, lấy dữ liệu và render.

Vì vậy, chỉ nhìn Elements có dữ liệu chưa đủ để nói trang dùng SSR. Trong Block 4, sự khác nhau giữa HTML response và DOM, cùng createRoot và GET API, cho thấy UI được tạo trên client. Còn khi thêm sinh viên, Network sẽ cho mình thấy cơ chế cập nhật trang rõ hơn.

## Slide 13 — Quan sát Network khi submit

*Khoảng 40–45 giây. Đối chiếu hai ảnh Network. Giữ filter All và Preserve log khi chụp.*

Trước submit, log có document, JavaScript, CSS và GET API để tải danh sách. Sau submit xuất hiện POST /api/students với type là fetch và status 201. Payload chứa tên, email; response trả lại Student có ID. Trong khoảng submit, không có document request mới.

Kết quả này khớp với preventDefault, fetch và cập nhật state đã trình bày. Tuy nhiên, chỉ riêng việc không reload chưa đủ để phân loại CSR, vì một trang SSR cũng có thể dùng fetch. Nhóm em kết hợp dấu hiệu này với HTML response và client render ở slide trước.

Nếu chạy development, có thể thấy thêm WebSocket của Vite HMR. Kết nối đó dùng để cập nhật code khi phát triển; dữ liệu sinh viên vẫn dùng HTTP API. Cuối cùng, em tóm lại kết quả kiểm thử và những điểm nhóm rút ra.

## Slide 14 — Kết quả kiểm thử và những điểm cần nhớ

*Khoảng 30–35 giây. Chỉ kết quả test và kết luận. Các số test có ngày chạy ghi trên slide.*

Nhóm đã xác nhận bảy test API, storage và pagination, bốn test React UI trong jsdom, một test runtime kiểm tra cả development và production. Build production cũng thành công. Các kiểm thử này hỗ trợ kiểm tra logic; ảnh DevTools giúp đối chiếu trực tiếp trên browser.

Điểm cần nhớ là App giữ state, component con nhận props và React render giao diện trên browser. API chịu trách nhiệm kiểm tra, lưu dữ liệu và trả JSON. Khi thêm sinh viên thành công, frontend cập nhật state để giao diện thay đổi.

Ứng dụng hiện còn đơn giản: tải toàn bộ danh sách và lưu JSON trong một tiến trình. Khi mở rộng, nhóm có thể thêm database, sửa/xóa và phân trang ở API. Qua bài này, nhóm em cần hiểu và giải thích được cơ chế, kể cả khi có AI hỗ trợ. Em cảm ơn thầy/cô và các bạn.
