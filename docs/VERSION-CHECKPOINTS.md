# Mốc phiên bản PTITSocial

## checkpoint-2026-11-14-vi-chat

Mốc mã nguồn ngày 14/11/2026, trước đợt bổ sung chức năng tiếp theo.

Các chức năng đã hoàn thành:

- Quyền xem bài viết: Công khai, Bạn bè, Bạn bè được chọn; kiểm tra quyền ở backend.
- Danh sách chọn người xem chỉ hiển thị bạn bè đã chấp nhận kết bạn.
- Biểu tượng quyền xem đồng bộ trên bài viết và phần tạo bài.
- Cho phép bôi đen và sao chép nội dung.
- Trả lời tin nhắn bằng trích dẫn; chuyển tiếp đến bạn bè hoặc cuộc trò chuyện khác.
- Menu dấu ba chấm trên tin nhắn; thời gian chỉ hiện khi rê chuột; bỏ bong bóng đang nhập.
- Gửi ảnh có xem trước và chú thích, chọn emoji, gửi tài liệu Word/PDF và các tệp được hỗ trợ.
- Giới hạn ảnh 10 MB, tài liệu 25 MB; kiểm tra quyền tải tệp theo thành viên cuộc trò chuyện.
- Việt hóa giao diện, thông báo, lỗi nhập liệu, chủ đề chat và email hệ thống.
- Sửa lỗi tin thông báo khi đổi chủ đề hoặc tên nhóm.

Kiểm tra đã thực hiện: 13 kiểm thử giao diện/ngôn ngữ, kiểm tra kiến trúc,
kiểm tra tích hợp API và Socket.IO, kiểm tra email và bản build frontend.
Bản build thành công, còn các cảnh báo lint của dự án.

Mốc Git lưu mã nguồn và tài liệu. Cấu hình `.env`, dữ liệu MongoDB, tệp đã tải lên,
thư viện cài đặt và nhật ký không nằm trong mốc mã nguồn.

Các chức năng mới tiếp tục phát triển từ mốc này. Không tự động hoàn tác dữ liệu
người dùng khi cần đối chiếu hoặc khôi phục mã nguồn.
