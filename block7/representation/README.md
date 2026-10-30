# Block 7 — bài trình bày ngắn

Mở trực tiếp `index.html` trong trình duyệt, không cần build hoặc cài thư viện.

- 8 slide, khoảng 6 phút, phong cách dựa trên `block6/presentation`.
- Chuyển bằng nút Trước/Sau, phím mũi tên, Page Up/Down, Home/End hoặc danh sách chọn slide. Click vùng nội dung để dùng phím nếu focus đang ở dropdown/nút.
- Có nút toàn màn hình; có thể dùng F11. Ctrl+P in/lưu PDF, mỗi slide một trang.
- URL `#slide-7` mở thẳng phần demo full-text/fuzzy.
- Để demo trực tiếp, chạy web/API block7 riêng. Liên kết API trên slide 7 dùng cổng mặc định 3006.
- Các đoạn code là lược trích từ source hiện tại, xuống dòng lại để dễ trình bày; tên file và hàm nằm ở đầu mỗi khung.
- Các trường Network và kết quả tìm kiếm là hướng dẫn quan sát/kỳ vọng, không phải ảnh chụp request mới.
- Chỉ tạo tài liệu HTML/CSS/JS; không chạy test trong lượt này.

Nội dung: quyết định ba kiểu UI → code số trang → code client paging/Tải thêm → observer và chống response cũ → bảng tổng hợp tìm/lọc/sort tại server hoặc client → DevTools paging → DevTools full-text/fuzzy → lỗi và cách chứng minh.

Slide 5 (`#slide-5`) tóm tắt bốn khu vực: thực đơn, quản trị món, quản trị đầu bếp/nguyên liệu và bộ chọn trong form. Bảng nêu cách tìm/lọc, kiểu sắp xếp và nơi xử lý; bên dưới là thứ tự xử lý cùng dấu hiệu đối chiếu trong Network.

Cập nhật: món dùng server paging; bảng và picker đầu bếp/nguyên liệu dùng client paging. Slide 3 trích useClientPagedList/useOptions; slide 6 hướng dẫn đối chiếu response toàn bộ khoảng 20 mục và không có fetch mới khi đổi trang/Tải thêm/cuộn tiếp.
