# Focus Room và Study Spot

## Media, giao diện và gợi ý vị trí

- Cả Focus Room và Study Spot dùng bảng màu đỏ PTIT để đồng bộ với giao diện chính.
- Focus Room dùng montage thư viện chuyển động dài 5 phút và bốn bản lo-fi lưu cục bộ. Credit, giấy phép và mô tả dựng video nằm tại `apps/web/public/study-media/README.md`.
- Phòng riêng tư không xuất hiện trong danh sách công khai; khách cần cả mã trong link mời và mật khẩu. Backend chỉ lưu bcrypt hash của mật khẩu.
- Chủ phòng có thể cho phép hoặc khóa micro toàn phòng và tắt micro từng thành viên. Khi micro bị khóa, backend từ chối trạng thái bật mic và LiveKit token mới không có quyền publish audio.
- LiveKit local quảng bá `127.0.0.1` và UDP `7882`, tránh gửi địa chỉ riêng của Docker container cho trình duyệt localhost.
- Study Spot có `GET /locations/nearby?lat=...&lng=...`, nhận tọa độ tự do từ thanh tìm kiếm hoặc click bản đồ, rồi sắp xếp nơi học theo khoảng cách. Thanh tìm kiếm chỉ gọi Photon khi người dùng submit, không tự động gửi truy vấn theo từng phím.

Hai phân hệ được tích hợp trực tiếp vào PTITSocial. React vẫn dùng tài khoản hiện có; mọi API đi qua Gateway và service `study` xác thực JWT bằng Accounts. Service mới sở hữu database `ptitsocial_study`, chỉ giữ `user_projections` công khai để hiển thị tên và ảnh đại diện, không tạo collection tài khoản thứ hai.

## Kiến trúc và tệp chính

- `services/study/src/models`: 7 model nghiệp vụ và một user projection.
- `services/study/src/controllers`: REST cho phòng, địa điểm, review, Meetup và đăng ký.
- `services/study/src/utils/socket.js`: presence, chat, trạng thái mic, Pomodoro, kick/end room.
- `apps/web/src/pages/focus`: khám phá, tạo và màn phòng học.
- `apps/web/src/pages/studySpot`: bản đồ, chi tiết địa điểm và quản lý Meetup.
- `apps/web/src/features/study`: HTTP client và bộ âm thanh môi trường Web Audio.
- `apps/web/src/assets/study`: bốn ảnh nền được tạo riêng cho dự án.

Repository hiện tại không có phân hệ nhóm học hoặc lịch học, nên chưa có model/API tương ứng để tái sử dụng. Tích hợp hiện tại giữ nguyên Accounts, Content và Messaging; chỉ bổ sung route Gateway, navigation và service mới.

## Dữ liệu và ràng buộc

Focus Room dùng `focusrooms`, `focusroomparticipants`, `focusroommessages`. Pomodoro nằm trong room để backend là nguồn thời gian duy nhất. Study Spot dùng `studylocations`, `studylocationreviews`, `studymeetups`, `studymeetupregistrations`.

- Một user chỉ có một participant record trong mỗi room và một review trong mỗi location.
- Room/Meetup dùng cập nhật có điều kiện để giữ chỗ, không vượt giới hạn khi có request đồng thời.
- Chỉ participant đang active đọc/gửi chat và nhận token âm thanh.
- Chỉ host điều khiển Pomodoro, kick hoặc kết thúc room; chỉ organizer duyệt đăng ký.
- Dữ liệu location mẫu có `isSample: true`, `verified: false` và mô tả rõ chưa xác minh.

## API qua Gateway

Tất cả endpoint dưới đây yêu cầu tài khoản đã đăng nhập và xác minh email.

```text
GET|POST  /api/v1/study/focus-rooms
GET        /api/v1/study/focus-rooms/:roomId
POST       /api/v1/study/focus-rooms/:roomId/join
POST       /api/v1/study/focus-rooms/:roomId/leave
POST       /api/v1/study/focus-rooms/:roomId/livekit-token

GET        /api/v1/study/locations
GET        /api/v1/study/locations/:locationId
PUT        /api/v1/study/locations/:locationId/review
DELETE     /api/v1/study/reviews/:reviewId
POST       /api/v1/study/meetups
GET        /api/v1/study/meetups/mine
POST       /api/v1/study/meetups/:meetupId/request
PATCH      /api/v1/study/registrations/:registrationId/decision
PATCH      /api/v1/study/registrations/:registrationId/cancel
PATCH      /api/v1/study/meetups/:meetupId/cancel
```

Realtime dùng Socket.IO path `/study-socket.io`; không dùng chung room hoặc event với Messaging.

## Chạy và dữ liệu demo

```powershell
npm.cmd install
npm.cmd --prefix apps/web install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

`start-local.ps1` khởi động MongoDB, Mailpit, LiveKit dev, bốn backend service, Gateway và React; sau đó chạy seed idempotent. Có thể seed thủ công bằng `npm.cmd run seed:study`.

LiveKit local dùng `ws://localhost:7880`, key `devkey`, secret `secret`. Đây chỉ là thông tin dev mặc định; secret chỉ nằm trong `.env` backend và không được đóng gói vào React.

Khi dùng LiveKit Cloud hoặc server triển khai thật, đặt trong `.env` gốc rồi chạy lại `node scripts/configure-local.cjs`:

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

Ở production cần HTTPS/WSS và cấu hình ICE/TURN/firewall phù hợp. Không dùng `devkey/secret` ngoài localhost.

## Kịch bản demo hai tài khoản

1. A mở `/focus`, tạo room; B mở link mời hoặc tham gia room public.
2. Hai phía thấy participant, chat và Pomodoro; cho phép microphone khi trình duyệt hỏi. Mic mặc định tắt.
3. Mỗi phía tự chọn nền và bật âm thanh môi trường. Âm thanh này do Web Audio phát tại thiết bị, không được publish lên LiveKit.
4. A mở `/study-spots`, chọn location mẫu và tạo Meetup ở tương lai.
5. B xin tham gia; A vào `/study-meetups` để duyệt; B có thể hủy đăng ký và viết review tại trang location.

Số suất Meetup là giới hạn đăng ký, không phải số ghế trống thực tế tại địa điểm.
