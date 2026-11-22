# PTITSocial

**Xây dựng mạng xã hội hỗ trợ học tập và kết nối sinh viên.**

Bài tập lớn học phần **Lập trình Web — INT1434-20261-CT01**, nhóm **06**, Học viện Công nghệ Bưu chính Viễn thông. Giảng viên hướng dẫn: **ThS. Nguyễn Quang Huy**.

Dự án sử dụng **MERN Stack** (MongoDB, Express, React, Node.js), tổ chức theo **microservices** trong một monorepo.

## Chức năng chính

| Nhóm chức năng        | Nội dung                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Tài khoản và hồ sơ    | Đăng ký, xác minh email, đăng nhập, khôi phục mật khẩu, sửa hồ sơ và ảnh                                           |
| Kết nối và bảng tin   | Tìm người dùng, kết bạn, đăng bài có ảnh, chọn người xem, cảm xúc, bình luận và chia sẻ                            |
| Tin nhắn và thông báo | Hội thoại cá nhân/nhóm, ảnh và tệp, trả lời/chuyển tiếp, trạng thái đã đọc, online và thông báo                    |
| Quiz                  | Soạn đề, dán nhiều câu hoặc nhập Excel; phòng bằng mã, nhiều đáp án đúng, chấm điểm và lịch sử                     |
| Thi đấu lập trình     | Chủ phòng chọn nhiều đề và điều hành riêng; người thi chọn C, C++, Java hoặc Python; chạy thử, nộp bài và xếp hạng |
| Hỏi đáp và tài liệu   | Đặt câu hỏi, trả lời, tương tác, chia sẻ và tìm kiếm tài liệu học tập                                              |
| Phòng học và hẹn học  | Phòng tập trung, Pomodoro, chat, micro qua LiveKit, địa điểm và buổi hẹn học                                       |
| Hỗ trợ học tập        | Trợ lý AI, lộ trình học tập và flashcard                                                                           |

## Cài và chạy trên Windows

Chuẩn bị **Node.js 22 trở lên**, npm và **Docker Desktop** đang chạy Linux containers. Cần Internet ở lần đầu để tải dependencies và Docker images. Judge0 biên dịch/chấm bài trong container, không cần cài trình biên dịch lên Windows.

Tại thư mục gốc dự án, chạy PowerShell:

```powershell
npm.cmd ci
npm.cmd --prefix apps/web ci
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

| Địa chỉ                      | Mục đích                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| http://localhost:3000        | Website                                                    |
| http://localhost:8000/health | Trạng thái Gateway và các dịch vụ                          |
| http://localhost:8025        | Mailpit: thư xác minh và khôi phục mật khẩu trên localhost |

Script tạo cấu hình còn thiếu và secret ngẫu nhiên cho máy mới. `.env` và dữ liệu người dùng không nằm trong Git. Máy cài mới bắt đầu với database trống: đăng ký trên website, mở thư trong Mailpit và xác minh bằng cùng profile trình duyệt đã đăng ký.

Từ lần tiếp theo, dùng `npm.cmd run dev`. Dừng hệ thống, giữ dữ liệu bằng `npm.cmd run stop`.

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` như các lệnh trên.

## Cấu trúc mã nguồn

```text
apps/web/                  React frontend
  src/app/                 Redux store và state
  src/features/            Component/hook theo chức năng
  src/pages/               Trang giao diện
  src/routes/              Điều hướng, kiểm tra phiên và socket
  src/shared/              UI, icon và tiện ích dùng chung
services/
  gateway/                 API Gateway và WebSocket proxy
  accounts/                Tài khoản, hồ sơ và quan hệ bạn bè
  content/                 Bài viết, hỏi đáp, tài liệu và tương tác
  messaging/               Hội thoại, tin nhắn, thông báo, online
  quiz/                    Bộ đề, phòng Quiz và kết quả
  coding/                  Phòng thi, bài nộp và chấm lập trình
  study/                   Phòng học, địa điểm và hẹn học
  learning/                AI, lộ trình và flashcard
packages/service-kit/      HTTP nội bộ, xác thực, xử lý lỗi và dữ liệu công khai
infra/                     Cấu hình hạ tầng Docker
scripts/                   Cấu hình, khởi động/dừng và công cụ dữ liệu
tests/                     Kiểm thử backend và luồng tích hợp
docs/                      Kiến trúc, API và hướng dẫn từng chức năng
compose.yaml               MongoDB, Mailpit, LiveKit và Judge0
```

## Dịch vụ và cơ sở dữ liệu

| Thành phần | Cổng local       | Database                               |
| ---------- | ---------------- | -------------------------------------- |
| Web        | 3000             | Gọi Gateway                            |
| Gateway    | 8000             | Không sở hữu database                  |
| Accounts   | 8001             | `ptitsocial_accounts`                  |
| Content    | 8002             | `ptitsocial_content`                   |
| Messaging  | 8003             | `ptitsocial_messaging`                 |
| Quiz       | 8004             | `ptitsocial_quiz`                      |
| Coding     | 8005             | `ptitsocial_coding`                    |
| Study      | 8006             | `ptitsocial_study`                     |
| Learning   | 8007             | `ptitsocial_learning`                  |
| Mailpit    | 8025 / SMTP 1025 | Hộp thư kiểm thử                       |
| LiveKit    | 7880             | Âm thanh thời gian thực                |
| Judge0 API | 2358             | PostgreSQL và Redis riêng trong Docker |

Mỗi dịch vụ có `package.json`, `src/server.js`, cấu hình và `/health` riêng. Dịch vụ giao tiếp qua HTTP nội bộ; frontend gọi API và socket qua Gateway. Một MongoDB local phục vụ bảy database tách biệt.

## Cấu hình tùy chọn và phạm vi demo

- **Gemini:** đặt `GEMINI_API_KEYS` trong `services/learning/.env`. Chưa có key thì AI báo chưa sẵn sàng; flashcard thủ công và lộ trình tĩnh vẫn dùng được. Không đưa key thật lên GitHub.
- **Quản lý tài liệu:** đặt `DOCUMENT_MODERATOR_IDS` trong `services/content/.env` bằng danh sách `_id` được phân quyền, cách nhau bằng dấu phẩy.
- **Thông báo:** thông báo trong ứng dụng dùng Socket.IO. Firebase push mặc định tắt; nếu cần thì cấu hình Firebase của chính dự án bằng các biến trong `apps/web/.env.example` và `FCM_SERVER_KEY` phía Messaging.
- **Nhiều tài khoản:** dùng các profile trình duyệt độc lập. Thi lập trình cần một chủ phòng và ít nhất hai người thi; chủ phòng không thi cùng người chơi.
- **Triển khai:** cấu hình mặc định dành cho localhost; triển khai production cần cấu hình hạ tầng, HTTPS và secret phù hợp.

## Chia sẻ phiên dùng thử

Trong VS Code Ports, chuyển tiếp cổng **3000** và đặt Public. Đặt `PUBLIC_APP_URL` trong `.env` gốc bằng địa chỉ tunnel hiện tại rồi khởi động lại. API, ảnh và socket đi qua cùng cổng web.

Giữ Mailpit ở Private vì chứa thư xác minh và mã khôi phục. Máy chủ và Docker phải tiếp tục chạy trong lúc dùng thử. Micro cần LiveKit công khai có TLS/WebRTC phù hợp khi truy cập qua Internet; chuyển tiếp riêng cổng web không cung cấp đường truyền âm thanh.

## Kiểm thử

Các kiểm thử không cần khởi động toàn bộ hệ thống:

```powershell
npm.cmd run test:unit
npm.cmd run test:web
npm.cmd run build:web
```

Các luồng tích hợp cần ứng dụng và Docker đang chạy:

```powershell
npm.cmd run test:integration
npm.cmd run test:quiz:integration
npm.cmd run test:coding:integration
npm.cmd run test:coding:languages
```

Một số bộ kiểm thử trình duyệt dùng Chrome đã cài trên máy. Kiểm thử AI có mô phỏng provider; kiểm tra Gemini thật cần key và quota riêng. Các lệnh khác nằm trong `package.json`.

## Thành viên nhóm 06

| Sinh viên        | Mã sinh viên |
| ---------------- | ------------ |
| Nguyễn Mạnh Công | B23DCAT032   |
| Nguyễn Huy Hoàng | B23DCAT112   |
| Nguyễn Đức Mạnh  | B23DCAT182   |
| Lê Duy Trường    | B23DCAT307   |

## Tài liệu

- [Kiến trúc và dữ liệu](docs/ARCHITECTURE.md)
- [API và định tuyến](docs/API.md)
- [Hướng dẫn đọc và sửa source](docs/CODE-GUIDE.md)
- [Quiz](docs/QUIZ.md)
- [Thi đấu lập trình](docs/CODING.md)
- [Phòng học và hẹn học](docs/STUDY-MODULES.md)
- [AI và lộ trình](docs/AI-LEARNING.md)
- [Flashcard](docs/FLASHCARDS.md)
- [Làm việc nhóm](docs/TEAM-WORKFLOW.md)
