# Flashcard ôn tập thông minh

## Cách sử dụng

Vào **Góc học tập → Flashcard** tại `/learning/flashcards`.

1. Bấm **Tạo bộ thẻ**, nhập tên, câu hỏi và đáp án rồi lưu. Có thể thêm, sửa, xóa thẻ.
2. Hoặc chọn một bài Guide rồi bấm **Tạo bằng AI**. Trong bài Guide cũng có liên kết **Tạo Flashcard từ bài này**. Gemini chỉ nhận bài Guide thuộc tài khoản hiện tại, không tìm kiếm thêm tài liệu. Xem và chỉnh lại các thẻ gợi ý trước khi lưu.
3. Mở bộ thẻ → **Bắt đầu ôn** → tự trả lời → **Hiện đáp án** → chọn **Quên / Khó / Nhớ**.
4. Màn hình hiển thị số thẻ đến lịch, số thẻ đã ôn hôm nay và lịch tiếp theo. Danh sách cập nhật mỗi 30 giây khi mở trang; đây là nhắc ôn trong trang, không gửi email hay thông báo khi đã đóng trình duyệt.

Thẻ thủ công và ôn tập không cần API AI. Tạo thẻ AI dùng chung cấu hình Gemini, cơ chế đổi khóa khi lỗi và hạn mức hỏi của Learn with AI.

## Quy tắc đặt lịch

Đây là thuật toán lặp lại ngắt quãng đơn giản tự triển khai, không phải SM-2 hay FSRS.

| Đánh giá | Lịch ôn tiếp theo                                                              |
| -------- | ------------------------------------------------------------------------------ |
| Quên     | Sau 10 phút; đặt lại chuỗi nhớ                                                 |
| Khó      | Khoảng cách hiện tại × 1,2, làm tròn lên, tối thiểu 1 ngày                     |
| Nhớ      | Lần nhớ đầu: 1 ngày; lần hai: 3 ngày; tiếp theo: tối thiểu 7 ngày rồi nhân đôi |

Khoảng cách tối đa là 365 ngày, tính từ thời điểm đánh giá. Ngày thống kê dùng múi giờ Việt Nam (UTC+7). Đổi nội dung câu hỏi hoặc đáp án sẽ đặt lại lịch thẻ đó; sửa tên bộ thẻ không làm mất tiến độ. Mức “đã nhớ” đếm các thẻ có chuỗi nhớ lớn hơn 0, không phải điểm kiểm tra tự động.

## Giải thích với thầy

“Em thêm chức năng Flashcard để chuyển kiến thức trong Guide thành bài tự ôn. Frontend React cho phép tạo thẻ thủ công hoặc yêu cầu Gemini tạo bản nháp. Backend Express kiểm tra tài khoản, kiểm tra dữ liệu, tính lịch ôn và lưu vào MongoDB. Khi ôn, người dùng tự đánh giá; server cập nhật thời điểm ôn tiếp theo. Dữ liệu lịch ôn nằm ở server nên vẫn còn sau khi tải lại trang hoặc đăng nhập trên máy khác.”

Các kỹ thuật cần hiểu:

- **Thiết kế REST API:** tạo bộ thẻ bằng POST, đọc bằng GET, sửa bằng PUT, xóa bằng DELETE và gửi lượt ôn bằng POST.
- **Phân quyền theo chủ sở hữu:** mọi truy vấn bộ thẻ và Guide đều kèm ID người dùng đã xác thực ở server. Không dùng ID người dùng do frontend gửi để quyết định quyền.
- **AI có cấu trúc:** yêu cầu Gemini trả JSON theo schema `cards: [{ front, back }]`, kiểm tra số lượng và độ dài, cho người dùng duyệt trước khi lưu. Không cắt nội dung Guide để tạo bản nháp.
- **Đồng thời và optimistic locking:** frontend gửi `version`; server chỉ cập nhật nếu phiên bản chưa thay đổi, đồng thời tăng phiên bản. Tab dùng dữ liệu cũ nhận HTTP 409 và phải tải lại.
- **Idempotency:** mỗi lượt ôn có `requestId`; gửi lại cùng lượt sẽ không cộng số lần ôn hoặc dời lịch thêm. Lưu 100 lượt gần nhất; lượt cũ đã rời danh sách vẫn bị chặn bởi phiên bản cũ.
- **Ghi nguyên tử:** các thẻ và nhật ký ôn nằm trong cùng document bộ thẻ, được cập nhật bằng một lệnh MongoDB. Không cần transaction nhiều collection hay MongoDB replica set cho thao tác ôn.
- **React Query:** cache theo người dùng, cập nhật chi tiết sau khi lưu và làm mới danh sách; lỗi mạng giữ nguyên thẻ để thử lại, không tự coi là đã ôn thành công.

## Demo ngắn

1. Tạo bộ thẻ Python gồm hai câu hỏi, ôn một thẻ “Nhớ” và một thẻ “Quên”.
2. Cho xem lịch 1 ngày và 10 phút; tải lại trang chứng minh tiến độ đã lưu.
3. Mở hai tab cùng bộ thẻ, sửa ở một tab rồi sửa ở tab còn lại để minh họa xử lý xung đột.
4. Chọn Guide → tạo bằng AI → sửa một đáp án → lưu. Nếu Gemini hết hạn mức, chức năng thủ công vẫn dùng được.

## Mã nguồn và kiểm thử

- `services/learning/src/flashcards.js`: model, API, kiểm tra dữ liệu và lịch ôn.
- `services/learning/src/provider.js`: schema và prompt tạo thẻ Gemini.
- `apps/web/src/pages/learning/Flashcards.jsx`: danh sách, trình sửa và màn hình ôn.
- `npm run test:flashcards`: thuật toán và kiểm tra dữ liệu.
- `node tests/learning-integration.cjs`: kiểm thử API với dữ liệu riêng và Gemini giả lập; cần các dịch vụ localhost và MongoDB đang chạy. Không dùng API key thật trong kiểm thử này.
- `npm --prefix apps/web test -- --watchAll=false --runInBand --testPathPattern=Flashcards.test.jsx`: luồng giao diện.

Giới hạn hiện tại: tối đa 100 thẻ/bộ, AI gợi ý tối đa 12 thẻ/lượt; tự đánh giá mức nhớ, không tự chấm đáp án. Chưa có chia sẻ bộ thẻ hoặc nhắc ôn ngoài trình duyệt.
