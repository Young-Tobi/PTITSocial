# Hỏi đáp học thuật

Module này phụ trách các chức năng hỏi đáp và thông báo phản hồi. Mở `/questions` bằng biểu tượng **?** trên thanh điều hướng. Dùng đăng nhập, xác minh email, hồ sơ công khai và chuông thông báo của base qua các API có sẵn.

## Phạm vi mã nguồn

| Thư mục | Nội dung |
| --- | --- |
| `apps/web/src/features/academic/` | Trang, component văn bản, điều hướng và thông báo hỏi đáp |
| `services/content/src/features/academic/` | API, model, kiểm tra dữ liệu, sở thích và gửi thông báo |
| `services/messaging/src/features/academic/` | Adapter lưu thông báo hỏi đáp và phát sự kiện |
| `tests/academic/` | Kiểm tra API, trình duyệt, phân quyền, quyền sở hữu dữ liệu và gửi lại thông báo |
| `scripts/academic/` | Chuyển dữ liệu từ bản hỏi đáp trước khi tách module |

Chỉ 6 file ứng dụng gốc cần thêm điểm nối, tổng cộng 9 dòng:

| File gốc | Phần thêm |
| --- | --- |
| `apps/web/src/routes/pagesData.jsx` | Import và nối danh sách route riêng: 2 dòng |
| `apps/web/src/features/navigation/components/header/Header.jsx` | Import và đặt liên kết hỏi đáp: 2 dòng |
| `apps/web/src/routes/IsLoggedIn.js` | Import và đăng ký listener thông báo hỏi đáp: 2 dòng |
| `services/content/src/server.js` | Gọi module đăng ký API hỏi đáp: 1 dòng |
| `services/messaging/src/server.js` | Gọi module đăng ký endpoint thông báo nội bộ: 1 dòng |
| `services/gateway/src/routes.js` | Chuyển `/api/v1/academic/*` đến Content: 1 dòng |

Ngoài ra, `package.json` và lockfile khai báo Playwright và lệnh kiểm tra; README/API chỉ dẫn đến tài liệu này. Các thay đổi trước đây vào đăng ký tên, reaction tin nhắn, Mailpit, model tài khoản, model thông báo, notification client, giao diện thông báo chung và tiện ích upload chung đã được bỏ khỏi phần đóng góp này. Những file đó giữ nguyên bản base.

Các điểm nối vẫn cần phối hợp khi merge nhánh nhóm. Tách module giảm phạm vi xung đột; không có nghĩa là có thể ghép vào ứng dụng mà không đăng ký route, menu hoặc listener.

## Hành vi và dữ liệu

- Đăng câu hỏi với tiêu đề 10–200 ký tự, nội dung 20–20.000 ký tự, môn học và tối đa 5 thẻ. Nội dung nhập và hiển thị dưới dạng văn bản thuần, giữ xuống dòng.
- Người khác trả lời; thành viên trao đổi bằng bình luận một cấp dưới câu trả lời. Không tự trả lời câu hỏi của mình.
- Mỗi người có một lượt Hữu ích/câu trả lời, bấm lại để hủy, không tự bình chọn. Có chỉ mục duy nhất để chống trùng.
- Chủ câu hỏi chọn, đổi hoặc bỏ lời giải; lời giải phải thuộc câu hỏi đó. Trạng thái giải quyết suy ra từ `acceptedAnswer`.
- Tìm theo tiêu đề/nội dung; kết hợp môn, thẻ, trạng thái và khoảng ngày theo Asia/Ho_Chi_Minh. Mặc định 20 mục/trang, tối đa 50. Tìm theo từ, chưa có tìm gần đúng.
- Gợi ý theo môn (+2 điểm) và mỗi thẻ trùng (+1 điểm), rồi theo thời gian. Không có câu phù hợp thì lấy câu mới nhất.

Content sở hữu `questions`, `answers`, `answercomments`, `answervotes` và `academic_interests`. Sở thích nằm trong collection riêng theo ID tài khoản; không bổ sung trường vào User hoặc trả sở thích trong hồ sơ công khai. Các tên collection của nội dung cũ được giữ để không mất câu hỏi/câu trả lời.

## Nội dung văn bản

Phần đính kèm ảnh, công cụ chèn mã/liên kết và xem trước Markdown đã được gỡ. Câu hỏi và câu trả lời chỉ nhập/hiển thị văn bản thuần; HTML và cú pháp Markdown được hiển thị nguyên văn, không tạo ảnh, khối mã hoặc liên kết hoạt động.

API tạo câu hỏi nhận JSON, từ chối multipart (415) và trường images (400). Các chức năng trả lời, bình luận, Hữu ích, chọn lời giải, tìm kiếm/lọc, gợi ý và thông báo phản hồi được giữ lại.

Không chạy thao tác xóa dữ liệu cũ: nội dung đã lưu vẫn còn nguyên văn, tệp ảnh cũ vẫn ở storage nhưng không hiển thị trong Hỏi đáp. Upload ảnh của các chức năng base không thay đổi.

## API

Các endpoint dưới `/api/v1/academic` yêu cầu đăng nhập và email đã xác minh. Tác giả lấy từ phiên xác thực. Kết quả thành công là `{status: 'success', data}`, danh sách có thêm `page`, `limit`, `total`.

| Method | Route sau `/api/v1/academic` | Dữ liệu |
| --- | --- | --- |
| GET | `/subjects` | Danh mục môn học |
| GET / PUT | `/interests` | `{subjects: string[], tags: string[]}`; tối đa 10 môn, 20 thẻ, chỉ tài khoản hiện tại |
| GET | `/questions` | `q`, `subject`, `tags` cách nhau dấu phẩy, `status=resolved/unresolved`, `from/to=YYYY-MM-DD`, `page`, `limit` |
| POST | `/questions` | JSON: `title`, `body`, `subject`, `tags` là mảng; trả 201 |
| GET | `/questions/recommended` | Tối đa 6 câu gợi ý |
| GET | `/questions/:id` | Chi tiết và lời giải được chọn |
| GET / POST | `/questions/:id/answers` | Danh sách phân trang / `{body}` 10–20.000 ký tự |
| GET / POST | `/answers/:id/comments` | Danh sách phân trang / `{body}` 1–1.000 ký tự |
| PUT / DELETE | `/answers/:id/helpful` | Đặt/hủy lượt Hữu ích của người hiện tại |
| PUT | `/questions/:id/accepted-answer` | `{answerId}` hoặc `{answerId: null}`; chỉ chủ câu hỏi |

Dữ liệu sai trả 400, chưa đăng nhập 401, thiếu quyền 403, nội dung không tồn tại 404.

## Thông báo phản hồi

Câu trả lời mới báo cho chủ câu hỏi. Bình luận báo cho chủ câu hỏi và tác giả câu trả lời, loại người gửi và loại trùng. Thông báo gồm tên người phản hồi, tiêu đề câu hỏi và liên kết `/questions/:id`.

Content gọi endpoint riêng `POST /internal/academic-notifications` của Messaging, được bảo vệ bởi `internalOnly` của base. Messaging dùng model adapter riêng `AcademicNotification` để lưu vào inbox `notifications` với `type=comment`, tương thích API danh sách, đánh dấu đã xem và biểu tượng chuông gốc. Metadata riêng là `academicKind` và `academicEventKey`; không sửa schema `Notification` hoặc client thông báo chung của base.

Socket.IO phát `academic_notification` đến phòng cá nhân của đúng người nhận. Listener riêng của module cập nhật chuông, danh sách, thông báo nổi tiếng Việt và dữ liệu câu hỏi đang mở. Thông báo được lưu cho người đang offline.

Cờ gửi chờ được lưu cùng phản hồi; lỗi dịch vụ không khiến người dùng phải đăng lại phản hồi. Content thử gửi lại khi khởi động và mỗi 30 giây, với khóa sự kiện duy nhất để tránh thông báo trùng. Không gửi hồi tố cho phản hồi cũ.

## Chuyển dữ liệu và kiểm tra

Máy đã từng dùng bản hỏi đáp trước khi tách module cần chạy khi MongoDB hoạt động và `.env` các service đã có:

```powershell
npm.cmd run migrate:academic
```

Script sao lưu dữ liệu liên quan vào `.local-backups/academic-data-*`, chuyển sở thích từ Accounts sang collection riêng của Content, chuyển loại thông báo cũ sang định dạng tương thích base, giữ ID/nội dung/thời gian/trạng thái đã xem. Chạy lại không tạo trùng. Máy cài mới có database trống không cần chuyển dữ liệu.

```powershell
npm.cmd run test:academic
npm.cmd run test:architecture
# Cần hệ thống local, MongoDB và Mailpit:
$env:TEST_API_URL='http://localhost:8010' # Đổi theo cổng Gateway thực tế, mặc định test là 8000
npm.cmd run test:academic:browser
npm.cmd run test:academic:notifications
npm.cmd run test:academic:checklist
npm.cmd run build:web
```

Hai lệnh kiểm thử trình duyệt đều chạy kiểm thử API trước. Dùng Chrome đã cài, hoặc `TEST_BROWSER_CHANNEL=msedge`; hỗ trợ `TEST_WEB_URL`, `TEST_MAIL_URL`, `TEST_MONGO_URL`. Test tạo tài khoản riêng và dọn tài khoản, nội dung, sở thích, thông báo và email thử sau khi chạy. Chỉ chạy trên môi trường phát triển. Ảnh chụp kiểm thử lưu tại `.local-tools/qa/academic/` và `.local-tools/qa/academic-notifications/`.

`test:academic:checklist` kiểm tra đặt câu hỏi văn bản, trả lời/thảo luận, bình chọn, chọn lời giải, bộ lọc, phân trang và gợi ý. Kết quả và ảnh chụp nằm trong `.local-tools/qa/academic-checklist/`.

`test:academic:browser` kiểm tra văn bản giữ xuống dòng sau tải lại, HTML/Markdown không được thực thi, không còn công cụ đính kèm, cùng các luồng hỏi đáp trên desktop và mobile. Kiểm thử API xác nhận multipart và trường ảnh bị từ chối mà không tạo câu hỏi dở dang.
