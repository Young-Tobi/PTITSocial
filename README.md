# PTITSocial

Repository nhóm (private): [Young-Tobi/PTITSocial](https://github.com/Young-Tobi/PTITSocial).

Mạng xã hội dành cho sinh viên, dùng React, Express, Node.js và MongoDB. Backend được tách thành năm dịch vụ và một API Gateway; mỗi dịch vụ sở hữu database riêng.

## Cấu trúc

```text
apps/web/                  React: giao diện đang sử dụng
  src/pages/               Các trang gắn với URL
  src/features/            Component và hook theo chức năng
  src/shared/              UI, icon, tiện ích dùng chung
  src/app/                 Redux store và state
  src/routes/              Điều hướng và kiểm tra phiên đăng nhập
services/
  gateway/                 Định tuyến HTTP và WebSocket
  accounts/                Tài khoản, hồ sơ, kết bạn, theo dõi, tìm kiếm
  content/                 Bài viết, bình luận, lượt thích, ảnh
  messaging/               Chat, tin nhắn, thông báo và trạng thái online
  quiz/                    Bộ đề, phòng quiz trực tiếp, chấm điểm và lịch sử
  coding/                  Phòng thi lập trình, hàng đợi chấm và xếp hạng
packages/service-kit/      Xử lý lỗi, HTTP client, xác thực và bản sao dữ liệu công khai
scripts/                   Khởi động, dừng, cấu hình, chuyển dữ liệu
tests/                     Kiểm tra ranh giới dịch vụ và luồng tích hợp
docs/                      Kiến trúc, API và hướng dẫn đọc source
legacy/backbook-server/    Backend cũ để tham khảo/chuyển dữ liệu; không chạy cùng bản mới
compose.yaml               MongoDB, Mailpit và Judge0 (API/worker/PostgreSQL/Redis)
```

## Chạy local

Cần Node.js 22 và Docker Desktop. Trong thư mục gốc:

```powershell
npm.cmd install
npm.cmd --prefix apps/web ci
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

- Website: http://localhost:3000
- Gateway và trạng thái dịch vụ: http://localhost:8000/health
- Hộp thư thử nghiệm: http://localhost:8025

Script tự tạo cấu hình local nếu chưa có. Các file `.env`, dữ liệu upload, log và bản sao lưu không được đưa vào Git. Nếu dùng PowerShell bị chặn `npm.ps1`, gọi `npm.cmd` như các lệnh trên.

Dừng mà vẫn giữ dữ liệu:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\stop-local.ps1
```

Máy đang làm bài đã được chuyển dữ liệu từ bản cũ, bao gồm tài khoản và các nội dung bạn tạo. Khi cài mới với MongoDB trống, đăng ký tài khoản qua website và xác minh email trong Mailpit.

## Dịch vụ

| Thành phần | Cổng | Database               |
| ---------- | ---- | ---------------------- |
| Web        | 3000 | Gọi Gateway            |
| Gateway    | 8000 | Không kết nối database |
| Accounts   | 8001 | `ptitsocial_accounts`  |
| Content    | 8002 | `ptitsocial_content`   |
| Messaging  | 8003 | `ptitsocial_messaging` |
| Quiz       | 8004 | `ptitsocial_quiz`      |
| Coding | 8005 | `ptitsocial_coding` |
| Judge0 API | 2358 | PostgreSQL riêng trong Docker |

Từng dịch vụ có `package.json`, `src/server.js`, `.env` và `/health` riêng. Có thể chạy riêng bằng `npm.cmd run start:accounts`, `start:content`, `start:messaging`, `start:quiz`, `start:coding`, `start:gateway`. Khi gọi từ root bằng npm workspace, working directory được đặt vào dịch vụ tương ứng.

Một MongoDB local phục vụ năm database tách biệt; không có dịch vụ nào truy vấn trực tiếp database của dịch vụ khác. Các bản sao tên, avatar và quan hệ theo dõi chỉ phục vụ đọc, được đồng bộ qua API nội bộ.

## Kiểm tra

```powershell
npm.cmd run test:architecture
npm.cmd run test:quiz
npm.cmd run test:coding
npm.cmd --prefix apps/web test -- --watchAll=false --runInBand
# Cần hệ thống đang chạy:
npm.cmd run test:integration
npm.cmd run test:quiz:integration
npm.cmd run test:coding:integration
npm.cmd run test:coding:languages
npm.cmd run build:web
```

Nếu Gateway chạy ở cổng khác, đặt `$env:TEST_API_URL='http://localhost:8010'` trước khi chạy kiểm tra tích hợp.

Kiểm tra tích hợp bao gồm xác minh email, kết bạn, ảnh, bình luận, WebSocket, quyền đọc tin nhắn và trạng thái đã đọc riêng cho từng thành viên nhóm. Các kiểm thử giao diện kiểm tra tên tiếng Việt, bài chia sẻ đã mất bài gốc và cập nhật trạng thái đọc. Bộ kiểm tra tích hợp tạo tài khoản thử riêng rồi dọn dữ liệu, email trong Mailpit và ảnh local của lần chạy đó; không xóa dữ liệu người dùng hiện có.

## Chuyển dữ liệu cũ

```powershell
npm.cmd run migrate:legacy
# Kiểm tra các ID cũ đã có trong database mới:
npm.cmd run check:migration
```

Lệnh sao chép từ database `backbook`, giữ nguyên ObjectId và không sửa database nguồn. Những bản ghi đã có trong database mới không bị ghi đè. Bản sao lưu nằm ở `.local-backups/`; ảnh được sao chép vào `services/content/uploads/`.

Đây là bước chuyển sang dùng hệ thống mới, không phải đồng bộ hai chiều. Sau khi chuyển, tiếp tục làm việc với các database `ptitsocial_*`.

## Đọc tiếp

- [Kiến trúc và quyền sở hữu dữ liệu](docs/ARCHITECTURE.md)
- [Đường đi của API](docs/API.md)
- [Nên đọc và sửa file nào](docs/CODE-GUIDE.md)
- [Quiz: dùng thử, API và chấm điểm](docs/QUIZ.md)
- [Thi đấu lập trình: dùng thử, bộ chấm và API](docs/CODING.md)
- [Làm việc nhóm: clone, chia nhánh và Pull Request](docs/TEAM-WORKFLOW.md)
- [Ghi chú giao diện](PTITSOCIAL-DESIGN.md)

Source ban đầu được phát triển từ [Backbook frontend](https://github.com/msobkyy/backbook) và [Backbook backend](https://github.com/msobkyy/backbook-server). Giữ nguồn tham khảo này trong báo cáo môn học.
## Thi đấu lập trình cùng bạn bè

Mở `/coding` sau khi chạy localhost. Một người tổ chức tạo phòng công khai/riêng tư và chọn nhiều đề; ít nhất hai người thi tham gia (tổng cộng 3 tài khoản đã xác minh email). Người tổ chức điều hành riêng; người thi tự chọn C, C++17, Java hoặc Python 3 trên Monaco và chấm bằng Judge0 CE tự chạy. Xem [hướng dẫn tính năng và bộ chấm](docs/CODING.md).

