# Quiz trực tiếp

Vào `/quiz` sau khi đăng nhập và xác minh email. Mỗi người làm bài theo tiến độ riêng, chủ phòng điều phối.

## Dùng thử

1. **Tạo bộ đề**: tên, câu hỏi, 4 lựa chọn, tích một hoặc nhiều đáp án đúng, thời gian và giải thích.
2. **Lưu nháp** khi chưa hoàn thiện; **Lưu và sẵn sàng** để mở phòng. Đề riêng tư chỉ chủ sở hữu được mở. Đề công khai xuất hiện ở **Khám phá quiz**, người khác được mở phòng nhưng không sửa đề gốc.
3. **Mở phòng**: chọn số người, xáo đáp án và thưởng tốc độ. Gửi mã 6 chữ số.
4. Đăng nhập hai tài khoản bằng trình duyệt thường và ẩn danh. Người chơi vào **Quiz → Nhập mã → Tham gia**, chủ phòng **Bắt đầu quiz**.
5. Người chơi chọn và chốt đáp án; xem phản hồi rồi chuyển câu. Chủ phòng xem tiến độ và có thể kết thúc sớm.
6. Kết thúc có xếp hạng, xem lại từng câu và lịch sử. Người hoàn thành sớm có kết quả tạm thời đến khi cả phòng kết thúc.

Tạo hai đề mẫu công khai:

```powershell
node scripts/seed-quiz.cjs
```

Script dùng tài khoản demo có sẵn `an@example.com` / `Backbook@123`, không tạo tài khoản và không ghi đè đề cùng tên. Máy mới: đăng ký, xác minh qua Mailpit rồi đặt `QUIZ_SEED_EMAIL` và `QUIZ_SEED_PASSWORD`. Người chơi thử trên máy hiện tại có thể dùng `binh@example.com` / `Backbook@123`.

## Tạo bộ đề nhanh

Trang soạn đề có hai lựa chọn **Dán đề hàng loạt** và **Nhập Excel**. Cả hai đều có bước xem trước, báo lỗi theo câu/dòng và chỉ thêm khi tất cả câu hợp lệ. Câu nhập được thêm cuối danh sách; câu trống ban đầu được thay bằng đề vừa nhập. Không ghi đè câu đã soạn. Sau khi nhập, vẫn cần bấm lưu bộ đề.

### Dán văn bản

```text
Câu 1: HTML dùng để làm gì?
A. Tạo cấu trúc trang web
B. Quản lý cơ sở dữ liệu
C. Chỉnh sửa ảnh
D. Quản lý máy chủ
Đáp án: A
Thời gian: 30
Giải thích: HTML mô tả cấu trúc nội dung trang web.
```

Hỗ trợ tiêu đề `Câu 1:` hoặc `1.`, lựa chọn `A.` / `A)` / `A:`, đáp án đúng A–D. Nếu A và B cùng đúng, ghi `Đáp án: A, B` (cũng hỗ trợ dấu chấm phẩy). Câu hỏi, lựa chọn và giải thích có thể xuống dòng. `Thời gian` và `Giải thích` tùy chọn; thời gian trống dùng mặc định đặt trong hộp nhập. Có nút điền mẫu để dùng thử. Tối đa 200.000 ký tự.

### Excel

**Nhập Excel → Tải file mẫu** tải `.xlsx` gồm sheet `Cau hoi` và hướng dẫn. Xóa hai câu ví dụ, điền mỗi dòng một câu, giữ dòng tiêu đề. Các cột: `Câu hỏi`, `A`, `B`, `C`, `D`, `Đáp án đúng`, `Thời gian`, `Giải thích`; hai cột cuối có thể để trống. Đáp án đúng ghi A/B/C/D; nhiều đáp án ghi `A, B`. Thời gian là số nguyên 5–180, không dùng công thức. File tối đa 2 MB, tổng số câu sau khi thêm không vượt 100. File được đọc trong trình duyệt; API lưu bộ đề tiếp tục kiểm tra dữ liệu khi lưu.

Kiểm tra bộ phân tích và thao tác thêm:

```powershell
npm.cmd run test:quiz:import
```

## Quy tắc

### Bản soạn tạm và rời phòng

- Trang soạn đề lưu tạm vào `localStorage` ngay khi chỉnh sửa. Khóa gồm ID tài khoản và ID bộ đề (hoặc `new`), nên các tài khoản/bộ đề có bản tạm riêng. Tải lại hoặc quay lại trang sẽ khôi phục nội dung. Bản tạm chỉ có trên trình duyệt đó, có thể mất khi xóa dữ liệu trình duyệt; chưa đồng bộ sang máy khác.
- Bấm **Lưu nháp / Lưu và sẵn sàng** để lưu MongoDB, sau đó xóa bản tạm. **Bỏ bản lưu tạm** khôi phục nội dung đã lưu trên server (hoặc làm trống đề mới), cần xác nhận. Lỗi đầy bộ nhớ trình duyệt được hiển thị, không ngăn lưu lên server.
- Người chơi **Rời phòng** khi chờ sẽ giải phóng chỗ; được nhập mã tham gia lại trước lúc bắt đầu. Rời giữa bài sẽ giữ điểm/bài đã làm và lịch sử, nhưng không được tiếp tục lượt chơi đó.
- Phòng tự kết thúc khi tất cả người chơi đã hoàn thành hoặc chủ động rời. Tắt tab/mất kết nối không tính là chủ động rời: thành viên được quay lại, đồng hồ vẫn chạy trên server.
- Chủ phòng có hai lựa chọn: **Rời trang, giữ phòng** để quay lại qua lịch sử, hoặc **Kết thúc phòng và rời** để chốt phòng cho mọi người.

- Tối đa 100 câu/đề, 4 lựa chọn/câu, một hoặc nhiều đáp án đúng; 5–180 giây/câu. Đề sẵn sàng phải đủ nội dung, ít nhất một đáp án đúng và không trùng lựa chọn. Đề nháp cho phép chưa chọn đáp án đúng.
- Người chơi thấy chỉ dẫn chọn một hoặc chọn nhiều. Với câu nhiều đáp án đúng, chọn đủ các đáp án đúng và không chọn sai mới có điểm; chọn thiếu hoặc chọn thừa được 0 điểm. Thứ tự chọn không ảnh hưởng. Xáo trộn vị trí đáp án không đổi ID của lựa chọn.
- Đề/phòng/bài làm cũ có `correctIndex`/`selectedIndex` vẫn đọc được, không cần sửa dữ liệu. Đề mới dùng `correctIndices`, bài làm dùng `selectedIndices`. API trước khi chốt chỉ trả `selectionMode`, không trả các ID đáp án đúng. Sau khi chốt và khi xem lại hiển thị toàn bộ đáp án đúng và đáp án đã chọn.
- Phòng 1–100 người; host không tính điểm. Chỉ nhận người mới khi đang chờ. Thành viên cũ được quay lại bằng mã phòng.
- Đúng: 700 điểm + tối đa 300 thưởng tốc độ nếu bật. Sai/hết giờ: 0. Chuỗi đúng không nhân điểm. Cùng điểm xếp cùng hạng.
- Server tính thời gian và tự ghi hết giờ cả khi đóng tab. Câu sau chỉ bắt đầu khi bấm chuyển câu.
- Phòng giữ bản chụp đề lúc tạo. Sửa/xóa đề gốc không đổi phòng/kết quả đã lưu.
- Refresh giữ tiến độ và hạn giờ. Nộp trùng cùng câu không cộng điểm lần hai. API người chơi không trả đáp án đúng/giải thích trước khi chốt hoặc hết giờ; xem toàn bộ sau khi hoàn thành hoặc phòng kết thúc.
- Chờ tối đa 24 giờ. Giới hạn khi chạy = tối đa của **90 phút** và **tổng thời gian các câu + 30 giây/câu đọc phản hồi + 15 phút dự phòng**, làm tròn lên theo phút. Ví dụ 100 câu × 180 giây có giới hạn 365 phút. Giao diện hiển thị giới hạn trước khi tạo và giờ kết thúc khi phòng đã bắt đầu. Phòng đang chạy từ phiên bản cũ giữ nguyên hạn giờ đã lưu.
- Host được loại người ở phòng chờ, người bị loại không nhập lại được. Phần “Thời gian và cách tính điểm” trong phòng giải thích điểm cơ bản/thưởng tốc độ, câu nhiều đáp án, hết giờ và mất kết nối.

## Source và API

- `services/quiz/src/models`: Quiz, QuizRoom, QuizAttempt; database `ptitsocial_quiz`.
- `services/quiz/src/domain`: kiểm tra đề, chấm điểm, khóa theo phòng, trạng thái và hết giờ.
- `services/quiz/src/controllers`: đề, phòng, bài làm và lịch sử.
- `services/quiz/src/realtime.js`: Socket.IO, xác minh tài khoản và quyền thành viên.
- `apps/web/src/features/quiz`: API client, hook realtime, modal, CSS.
- `apps/web/src/pages/quiz`: thư viện, soạn đề, phòng và kết quả.

Tiền tố `/api/v1/quiz`, cần tài khoản đã xác minh. Response `{ status: 'success', data: ... }`.

| Method | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET / POST | `/quizzes` | Liệt kê/tạo; GET có `view=mine/discover`, `status=draft/ready`, `search` |
| GET / PUT / DELETE | `/quizzes/:quizId` | Đọc để sửa/cập nhật/xóa mềm đề của mình |
| POST | `/rooms` | `{ quizId, maxPlayers, shuffleOptions, speedBonus }` |
| POST | `/rooms/join` | `{ code }` |
| GET | `/rooms/:roomId` | Trạng thái theo quyền host/player |
| POST | `/rooms/:roomId/start` | Host bắt đầu |
| POST | `/rooms/:roomId/answer` | `{ questionId, selectedIndices: [0,1] }`; ID theo `options[].id`; vẫn hỗ trợ `selectedIndex` cũ |
| POST | `/rooms/:roomId/next` | `{ questionId }` |
| POST | `/rooms/:roomId/end` | Host hủy/dừng |
| POST | `/rooms/:roomId/leave` | Người chơi chủ động rời; host dùng `/end` |
| DELETE | `/rooms/:roomId/players/:userId` | Loại người khi chờ |
| GET | `/rooms/:roomId/results` | Kết quả của mình; host chọn `?userId=...` |
| GET | `/history` | Phòng mình tạo/tham gia |

Gateway chuyển `/quiz-socket/` tới Quiz :8004. Client phát `room:subscribe` với `{roomId}`, nhận `room:updated` rồi tải lại dữ liệu theo quyền. Có polling dự phòng mỗi 2 giây. Chat tiếp tục dùng `/socket.io/`.

## Kiểm tra và giới hạn

```powershell
npm.cmd run test:quiz
npm.cmd run test:quiz:editor
# Hệ thống đang chạy:
npm.cmd run test:quiz:integration
npm.cmd run test:quiz:load
```

Test tích hợp tạo/dọn tài khoản, đề và phòng riêng. Kiểm tra WebSocket qua gateway, phân quyền, ẩn đáp án, tiến độ độc lập, snapshot, nộp trùng đồng thời, timeout, dung lượng, loại người, kết thúc sớm và kết quả.

`test:quiz:load` tạo 31 tài khoản thử đã xác minh (1 host, 30 người chơi), vào cùng phòng, mở 31 WebSocket, làm 5 câu với lượt nộp đồng thời, gửi trùng, một số câu sai và 5 kết nối ngắt/nối lại. Có đọc trạng thái theo thông báo (gom trong 300 ms, một request đang chạy/client) và polling mỗi 2 giây. Script kiểm tra đủ điểm/bài làm rồi dọn dữ liệu thử theo ID; báo thời gian phản hồi p95, lớn nhất và lưu báo cáo ở `.local-logs/quiz-load-report.json`. Đây là tải HTTP/Socket.IO trên máy local, không phải 30 trình duyệt render giao diện và không chứng minh khả năng chạy 100 người hay triển khai nhiều máy.

Lượt đo ngày 14/11/2026 trên máy phát triển: 30 người chơi, 31 WebSocket, 5 câu; 961 request trong 12,1 giây, p95 770 ms, lớn nhất 890 ms, không có request lỗi; đủ điểm của 30 người và hạn giờ sau nối lại đều khớp. Các số này là kết quả của một lượt đo local với workload nêu trên, không phải cam kết hiệu năng trên máy khác.

Chạy **một process Quiz** trên localhost. Khóa nằm trong process; chưa hỗ trợ nhiều replica, transaction nhiều document hay outbox. MongoDB giữ dữ liệu, worker khôi phục hạn giờ sau restart; process chết giữa các lần ghi có thể cần đối soát. Chưa có chống gian lận thi cử với nhiều tài khoản/trao đổi ngoài hệ thống.
