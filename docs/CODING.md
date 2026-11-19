# Thi đấu lập trình

## Chạy thử

Chạy `start-local.ps1`, mở `http://localhost:3000/coding`. Cần Docker Desktop chạy Linux containers. Lần đầu tải Judge0 khá lớn; cần dự trù khoảng 15–20 GB trống trên ổ chứa dữ liệu Docker. Có thể đặt Disk image location của Docker Desktop trên ổ D.

1. Dùng ít nhất **3 tài khoản đã xác minh email**: một người tổ chức và hai người thi. Dùng các profile trình duyệt khác nhau để giữ ba phiên đăng nhập riêng.
2. Người tổ chức vào **Tạo phòng**, nhập tên, số người thi tối đa, thời lượng, chọn công khai/riêng tư và một hoặc nhiều đề từ kho. Có thể xem trước và đổi thứ tự đề.
3. Người thi vào phòng công khai từ **Khám phá phòng**, hoặc nhập mã 6 chữ số. Phòng chỉ nhận người mới khi đang chờ và còn chỗ. Người tổ chức không chiếm chỗ.
4. Khi có ít nhất hai người thi, người tổ chức bắt đầu. Đề được mở đồng thời cho tất cả; người tổ chức xem bảng điểm trực tiếp và hoạt động nộp bài.
5. Người thi chuyển giữa các đề, chọn **C / C++17 / Java / Python 3** trong trình soạn thảo, **Chạy thử** với ví dụ và **Nộp bài** để chấm test ẩn. Mỗi đề và mỗi ngôn ngữ có bản nháp riêng. Mỗi đề giữ một kết quả tốt nhất chung cho mọi ngôn ngữ.
6. Hết giờ, mọi người giải xong/rời cuộc thi hoặc người tổ chức kết thúc sớm: chấm nốt bài đã nhận, rồi chốt bảng điểm. Người thi xem lại code của mình.

## Phạm vi

- 1–20 đề do người tổ chức chọn, 2–30 người thi, thời lượng nguyên từ 5–180 phút. Một đồng hồ chung cho cả cuộc thi. Người tổ chức không tham gia thi, không chạy/nộp bài và không có trong bảng xếp hạng của phòng mới. Người thi tự chọn ngôn ngữ cho từng bài nộp; những người cùng phòng có thể dùng ngôn ngữ khác nhau.
- Bản hiện tại dùng C11/C++17 (GCC 9.2), Java (OpenJDK 13.0.1) và Python 3.8.1 từ Judge0 CE 1.13.1. Java cần `public class Main`. Có code khởi đầu tương ứng và tô màu cú pháp theo ngôn ngữ. Lịch sử và màn hình xem lại code giữ đúng ngôn ngữ từng lần nộp.
- Phòng công khai xuất hiện ở **Khám phá phòng** khi đang chờ/đang thi; phòng đang thi và phòng đầy không nhận người mới. Phòng riêng chỉ vào bằng mã. Người đã vào tìm lại phòng ở **Đang tham gia**. Người tổ chức quản lý ở **Phòng tôi tổ chức**; phòng kết thúc nằm trong **Lịch sử thi đấu**.
- Bộ đề được chụp lại ngay khi tạo phòng, giữ đúng thứ tự đã chọn. Sửa kho đề về sau không đổi đề của cuộc thi đã tạo. Trước lúc bắt đầu chỉ người tổ chức xem được bộ đề đã chọn; danh sách phòng chỉ trả số lượng đề.
- 5 đề mẫu do dự án tự định nghĩa: tổng mảng, phần tử lớn nhất, chuỗi đối xứng, đếm phần tử khác nhau và tổng đoạn con lớn nhất. Sửa/thêm đề tại `services/coding/src/seed.js`. Seed dùng `setOnInsert` để không ghi đè đề đã có; cập nhật đề cũ cần thay đổi dữ liệu có chủ đích.
- Mỗi đề tối đa 100 điểm, tính theo tỷ lệ test đúng và làm tròn hai chữ số thập phân. Tổng điểm là tổng kết quả tốt nhất của từng đề. Bài sai hơn/lặp lại không giảm hoặc cộng dồn điểm. Bằng tổng điểm: người đạt tổng điểm đó sớm hơn đứng trước, theo thời điểm server nhận bài. Thời gian xếp hàng chấm không ảnh hưởng mốc tính hạng.
- Giải đúng một đề không kết thúc lượt thi; người thi vẫn làm những đề còn lại. Đề đã đúng toàn bộ test không nhận thêm bài.
- Code và kết quả chạy thử chỉ người nộp được đọc. Không có test ẩn hoặc code người khác trong API phòng hay Socket.IO.
- Tải lại trang giữ bản nháp trên trình duyệt và nhận lại trạng thái từ server. Rời phòng khi đang thi sẽ không được nộp tiếp. Mất kết nối không tự bỏ lượt.
- Lựa chọn ngôn ngữ được nhớ cho từng người trong từng phòng. Khi đổi đề vẫn giữ lựa chọn đó; code lưu riêng theo người/phòng/đề/ngôn ngữ. Bản nháp C++ từ phiên bản cũ vẫn được đọc lại, không bị xóa. Bài nộp cũ chưa có trường `language` được hiểu là C++.
- Bài server đã nhận trước hạn vẫn được chấm khi hết giờ. Giao diện hiện đang chấm trước khi chốt kết quả.
- Người tổ chức có thể mời người thi rời phòng khi đang chờ; người bị mời rời không vào lại phòng đó. Rời tự nguyện lúc đang chờ sẽ nhường chỗ và vẫn có thể vào lại trước khi bắt đầu.
- Tạo cuộc thi mới từ kết quả sẽ mở màn hình tạo phòng với cài đặt/bộ đề cũ. Người tổ chức có thể chỉnh lại rồi tạo mã phòng mới; không tự kéo người khác vào.
- Phòng từ phiên bản một đề cũ được lưu trữ với cờ `legacy`, giữ bài nộp và điểm của thể lệ trước (người tạo từng tham gia). Phòng cũ đang chờ cũng được đưa vào lịch sử; không khởi động lại bằng thể lệ mới. Migration tại `migrate.js` chạy một lần theo `version`, không xóa dữ liệu gốc.

## Đọc source

| File                            | Vai trò                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `services/coding/src/models.js` | Đề, phòng, bài nộp; database riêng `ptitsocial_coding`   |
| `controllers.js`                | Tạo/vào/bắt đầu/rời/kết thúc phòng, nhận bài             |
| `engine.js`                     | Trạng thái phòng và dữ liệu được phép gửi cho người dùng |
| `rules.js`                      | Kiểm tra cài đặt và cách xếp hạng                        |
| `worker.js`                     | Lấy hàng đợi từng bài, gọi Judge0, cập nhật điểm         |
| `judge.js`                      | Gọi API Judge0, biên dịch/chạy trong sandbox             |
| `realtime.js`                   | Xác thực socket, kiểm tra thành viên, báo phòng thay đổi |
| `migrate.js`                    | Chuyển phòng cũ sang lịch sử tương thích và giữ bài làm  |
| `apps/web/src/pages/coding`     | Danh sách, phòng chờ/thi đấu, kết quả                    |
| `apps/web/src/features/coding`  | API client, hook phòng, Monaco và CSS                    |

Một tiến trình Coding dùng khóa phòng trong bộ nhớ để xử lý các request đồng thời. Worker chấm lần lượt, tối đa một bài đang chờ/chấm mỗi người; hàng đợi tối đa 24 bài, mỗi người tối đa 20 lần chạy/nộp mỗi phút. Đây là thiết kế cho localhost; khi tăng lên nhiều instance phải thay khóa bằng cơ chế dùng chung và tách hàng đợi worker.

## Bộ chấm

Judge0 CE 1.13.1 tự chạy, không dùng API trả phí. Docker Compose gồm API, worker, PostgreSQL và Redis, chỉ API chấm mở tại `127.0.0.1:2358`; frontend không gọi trực tiếp. Secret sinh tại `scripts/configure-local.cjs`, lưu trong file `.env`/`infra/judge0/judge0.conf` được Git bỏ qua.

Monaco dùng asset từ `apps/web/public/monaco`, được copy từ package khi start/build; không phụ thuộc CDN. Không có code người dùng được thực thi trong Node.js hoặc trình duyệt.

Docker Desktop dùng cgroup v2; cấu hình Judge0 dùng giới hạn theo tiến trình của isolate. Network bị tắt, output tối đa 64 KB, worker container có trần RAM vật lý 1 GB. Hồ sơ trong `services/coding/src/languages.js` do server quyết định, không nhận compiler ID/flags/giới hạn từ trình duyệt:

| Ngôn ngữ | CPU so với giới hạn cơ sở của đề | Địa chỉ bộ nhớ ảo mỗi tiến trình | Số tiến trình/luồng tối đa |
| -------- | -------------------------------- | -------------------------------- | -------------------------- |
| C/C++    | ×1                               | Theo đề, hiện là 256 MB          | 2 (shell và chương trình)  |
| Python   | ×3                               | Theo đề, hiện là 256 MB          | 2                          |
| Java     | ×2                               | 2 GB, heap JVM tối đa 128 MB     | 32                         |

CPU tối đa 10 giây; wall time = CPU ×2 +1, tối đa 20 giây. Giới hạn CPU theo tiến trình/luồng, không phải tổng CPU toàn nhóm. Java cần vùng địa chỉ ảo lớn hơn lượng RAM thực dùng. `infra/judge0/start-api.sh` chạy trình tự khởi động của Judge0 và cấu hình lại lệnh Java sau mỗi lần seed; `configure-languages.rb` cố định heap, metaspace, Serial GC và số CPU JVM sử dụng. Không tải thêm image hay dùng API trả phí. Compilation được giới hạn CPU 10 giây, wall 20 giây, địa chỉ ảo 2 GB trong worker 1 GB RAM. Đây là cấu hình localhost; cần đánh giá sandbox, quota và triển khai trước khi công khai trên Internet.

## API

Tất cả cần đăng nhập và xác minh email. Tiền tố `/api/v1/coding`, response `{ data: ... }`.

| Method | Đường dẫn                                     | Chức năng                                                                                                                                |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/status`                                     | Trạng thái kết nối Judge0                                                                                                                |
| GET    | `/problems`                                   | Kho đề công khai, có ví dụ, không có test ẩn                                                                                             |
| GET    | `/rooms?view=discover\|mine\|joined\|history` | Phòng công khai/của người tổ chức/đang tham gia/lịch sử, tối đa 100 phòng gần nhất                                                       |
| POST   | `/rooms`                                      | `{title,maxPlayers,durationMinutes,visibility,problemIds:[id,...]}`                                                                      |
| POST   | `/rooms/join`                                 | Vào bằng `{code}`                                                                                                                        |
| POST   | `/rooms/:id/join`                             | Tham gia phòng công khai từ danh sách                                                                                                    |
| GET    | `/rooms/:id`                                  | Trạng thái theo vai trò, bộ đề, bảng điểm, tối đa 200 lần chạy/nộp của mình; người tổ chức thêm 30 hoạt động nộp gần nhất, không có code |
| POST   | `/rooms/:id/start`                            | Người tổ chức bắt đầu                                                                                                                    |
| POST   | `/rooms/:id/leave`                            | Thành viên rời phòng                                                                                                                     |
| POST   | `/rooms/:id/kick`                             | Người tổ chức mời người thi `{userId}` rời phòng chờ                                                                                     |
| POST   | `/rooms/:id/end`                              | Người tổ chức kết thúc                                                                                                                   |
| POST   | `/rooms/:id/run`                              | Chạy ví dụ với `{problemId,code,requestId,language:'cpp'}`                                                                               |
| POST   | `/rooms/:id/submit`                           | Chấm test ẩn, cùng dạng body                                                                                                             |
| GET    | `/submissions/:id/code`                       | Chỉ đọc code bài của chính mình                                                                                                          |

`requestId` là UUID để gửi lại request không tạo bài nộp trùng. Socket.IO qua `/coding-socket`, dùng token xác thực và `room:subscribe {roomId}`; nhận `room:updated` rồi tải trạng thái phòng. Polling 2 giây dự phòng khi socket ngắt.

Khi chạy/nộp bài gửi `language: 'c' | 'cpp' | 'java' | 'python'`. Bỏ qua trường này thì mặc định C++ để tương thích bài nộp cũ. Metadata bài nộp và endpoint xem code trả lại ngôn ngữ đã chọn. Cùng `requestId` nhưng đổi ngôn ngữ/code/đề sẽ bị từ chối để không nhầm bài cũ.

Kiểm tra: `npm.cmd run test:coding`, `npm.cmd run test:coding:integration`, `npm.cmd run test:coding:languages` (hai lệnh tích hợp cần app và Judge0 đang chạy). Test ngôn ngữ kiểm tra chạy thật, lỗi biên dịch/cú pháp, timeout và chấm test ẩn của cả bốn ngôn ngữ trong cùng một phòng. Test tích hợp tạo tài khoản/phòng riêng và dọn đúng dữ liệu fixture sau khi chạy.
