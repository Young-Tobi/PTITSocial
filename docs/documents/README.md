# Kho tài liệu học tập cộng đồng

Module độc lập với Hỏi đáp học thuật. Mở `/documents` hoặc biểu tượng sách trên thanh điều hướng. Chỉ tài khoản đã đăng nhập và xác minh email được sử dụng, bao gồm xem trước và tải tệp.

## Các chức năng

- Chọn nhiều tệp PDF, DOCX hoặc PPTX và bấm đăng một lần, tối đa 20 MB cho mỗi tệp. Mỗi tệp thành một tài liệu có tên riêng và dùng chung thông tin phân loại. Nếu có lỗi, biểu mẫu hiển thị kết quả từng tệp và chỉ gửi lại những tệp chưa đăng thành công. Tên 5–200 ký tự, mô tả 20–5.000 ký tự, môn học và chủ đề bắt buộc; tối đa 5 từ khóa (2–30 ký tự/từ), nguồn/tác giả tối đa 1.000 ký tự. Người đăng phải xác nhận quyền chia sẻ.
- Tìm tên/mô tả/từ khóa; kết hợp môn học, chủ đề, định dạng và khoảng ngày Việt Nam. Sắp xếp mới nhất/cũ nhất/Hữu ích nhất, 20 tài liệu/trang. Bộ lọc lưu trên URL. Tìm theo từ, chưa có tìm gần đúng.
- PDF xem trước bằng trình duyệt, hỗ trợ HTTP Range. DOCX/PPTX tải xuống; không sử dụng dịch vụ chuyển đổi bên ngoài.
- Lưu/bỏ yêu thích. Một lượt Hữu ích/tài khoản/tài liệu, có thể hủy, không tự bình chọn. Nhận xét một cấp 1–1.000 ký tự; người viết xóa nhận xét của mình.
- Người đăng sửa thông tin hoặc xóa. Tệp không thay tại chỗ để tránh kế thừa đánh giá cho nội dung mới.
- Báo cáo tài liệu: lý do và mô tả 5–1.000 ký tự; chỉ một báo cáo đang chờ/tài khoản/tài liệu. Người quản lý ẩn/khôi phục, bác hoặc đánh dấu đã xử lý, ghi người/thời gian/lý do.
- Tài liệu bị ẩn không xuất hiện trong danh sách công khai/yêu thích và không thể tải/xem trước. Chủ tài liệu và người quản lý vẫn xem được thông tin trạng thái. Không tự ẩn theo số báo cáo.

Các màn hình: `/documents`, `/documents/new`, `/documents/mine`, `/documents/saved`, `/documents/:id`, `/documents/:id/edit`, `/documents/moderation`.

## Tích hợp và dữ liệu

Frontend trong `apps/web/src/features/documents/`, backend trong `services/content/src/features/documents/`. Điểm nối vào base: menu Header, danh sách route frontend, đăng ký module Content và chuyển `/api/v1/documents/*` tại Gateway. Không dùng component, model hoặc storage của Q&A.

Các collection do Content sở hữu: `study_documents`, `document_favorites`, `document_votes`, `document_comments`, `document_reports`, `document_cleanup`. MongoDB tạo collection và chỉ mục qua Mongoose; không cần chuyển dữ liệu cũ. Unique index bảo vệ bình chọn/yêu thích và báo cáo đang chờ. Lượt Hữu ích tính từ các bản ghi vote, không lưu bộ đếm trùng lặp.

API dưới `/api/v1/documents`:

| API | Nội dung |
| --- | --- |
| GET `/catalog` | Môn học, chủ đề, lý do báo cáo và quyền quản lý hiện tại |
| GET `/`, `/mine`, `/saved` | `q`, `subject`, `topic`, `format`, `from`, `to`, `sort=newest/oldest/helpful`, `page` |
| POST `/` | Multipart `file`, `title`, `description`, `subject`, `topic`, `keywords` JSON mảng, `source`, `rightsConfirmed=true` |
| GET/PATCH/DELETE `/:id` | Chi tiết / sửa toàn bộ metadata bằng JSON / xóa của người đăng |
| GET `/:id/preview`, `/:id/download` | Tệp có kiểm tra quyền và trạng thái; preview chỉ PDF |
| PUT/DELETE `/:id/favorite`, `/:id/helpful` | Đặt/hủy lựa chọn của tài khoản hiện tại |
| GET/POST `/:id/comments` | Phân trang / nhận xét `{body}` |
| DELETE `/comments/:commentId` | Xóa nhận xét của mình |
| POST `/:id/reports` | `{reason, body}` |
| GET `/moderation/reports` | `status=pending/dismissed/resolved`, `page`; chỉ người quản lý |
| PATCH `/moderation/reports/:reportId` | `{status: dismissed/resolved, resolution}` |
| PATCH `/moderation/documents/:id/status` | `{status: hidden/published, reason}` |

Kết quả JSON `{status, data}`, danh sách thêm `total`, `page`, `limit`. Sai dữ liệu 400, chưa đăng nhập 401, thiếu quyền 403, không tồn tại/không còn chia sẻ 404, trùng báo cáo hoặc xung đột 409, không hỗ trợ preview 415. Upload giới hạn 30 yêu cầu/tài khoản/15 phút.

## Lưu trữ và cấu hình

Tệp nằm ở `services/content/private-documents/` (đã bỏ khỏi Git), không nằm dưới `/uploads`. Chỉ trả tệp qua API xác thực với `Cache-Control: private, no-store`, `nosniff`, đúng Content-Type và Content-Disposition. Tên lưu UUID; không nhận đường dẫn người dùng làm tên lưu.

Cấu hình trong `services/content/.env`:

```dotenv
# Danh sách MongoDB ID tài khoản được quản lý riêng Kho tài liệu, cách nhau bằng dấu phẩy.
DOCUMENT_MODERATOR_IDS=
# Không bắt buộc: thư mục lưu tệp riêng; giữ mặc định khi chạy local.
# DOCUMENT_STORAGE_DIR=D:/private-study-documents
```

Sau khi đổi cấu hình cần khởi động lại Content. Nếu danh sách quản lý trống, không tài khoản nào có quyền quản lý; không tự cấp quyền theo email. Không thêm role vào tài khoản chung. Không lưu mật khẩu admin vào source hoặc tài liệu này.

`pdf-lib` đọc PDF, từ chối mã hóa/cấu trúc lỗi và các mục JavaScript, hành động mở, tệp nhúng. `yauzl` đọc gói Office; kiểm tra CRC, số mục, kích thước giải nén, cấu trúc và loại tài liệu. `saxes` kiểm tra XML; từ chối DTD/entity, macro, OLE và quan hệ ngoài không an toàn. Không giải nén theo đường dẫn trong ZIP. Kiểm tra này không phải quét virus hay xác nhận bản quyền; quyền chia sẻ được xác nhận bởi người đăng và xử lý qua báo cáo.

Trước ghi tệp, lưu bản ghi dọn dẹp để có thể khôi phục sau lỗi/khởi động lại. Upload/lưu thất bại dọn tệp ngay; lỗi dọn được thử lại định kỳ. Xóa đánh dấu `deleted` trước để chặn truy cập, rồi dọn tệp và dữ liệu liên quan; lỗi được thử lại mỗi 30 giây. Bản ghi upload chưa hoàn tất được xét sau 5 phút và chỉ dọn khi không có tài liệu tham chiếu. Cần sao lưu đồng thời database Content và thư mục tệp khi vận hành.

## Kiểm thử

```powershell
npm.cmd run test:documents
npm.cmd run test:architecture
$env:TEST_API_URL='http://localhost:8010'
# Điền mật khẩu tài khoản admin@gmail.com đã được cấu hình quản lý kho trên máy thử.
$env:TEST_DOCUMENT_ADMIN_PASSWORD='...'
npm.cmd run test:documents:integration
npm.cmd run test:academic:checklist
npm.cmd run test:academic:notifications
npm.cmd run build:web
```

Chỉ chạy integration trên môi trường phát triển có MongoDB/Mailpit và Chrome. Bộ kiểm thử dùng tài khoản sinh viên tạm, kiểm tra API và giao diện, sau đó dọn tài liệu/tương tác/tài khoản/email thử. Tài khoản quản lý và dữ liệu thật được giữ lại. Ảnh kiểm thử tại `.local-tools/qa/documents/`. Bộ test chạy bằng Node.js 24 đang có trên máy.

Triển khai lần này chỉ ở thư mục dự án gốc; không đồng bộ sang `D:\Github\PTITSocial`.
