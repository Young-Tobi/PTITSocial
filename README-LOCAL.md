# Chạy PTITSocial trên localhost

Mở folder `D:\PTIT\Kì 7\Lập trình web\BTL\PTITSocial` bằng **File → Open Folder** trong VS Code.

## Cách nhanh nhất trong VS Code

- **Bật:** nhấn **Ctrl + Shift + B**. Task `PTITSocial: Start localhost` khởi động toàn bộ dịch vụ và mở website khi sẵn sàng.
- **Tắt:** chọn **Terminal → Run Task… → PTITSocial: Stop localhost**.

Các task dùng đường dẫn của folder đang mở. Nút **Go Live** của Live Server chỉ phục vụ trang tĩnh, không khởi động backend, MongoDB hay Mailpit của dự án.

## Chạy bằng một terminal

Trong terminal PowerShell tại thư mục gốc của repo:

```powershell
npm.cmd run dev
```

- Website: http://localhost:3000
- Trạng thái backend theo cấu hình hiện tại: http://localhost:8010/health
- Hỏi đáp học thuật: http://localhost:3000/questions
- Kho tài liệu: http://localhost:3000/documents
- Email thử nghiệm: http://localhost:8025

Không cần mở bảy terminal. Các dịch vụ chạy nền; đóng terminal khởi động sẽ không tắt localhost. Dùng lệnh dừng bên dưới khi xong.

Script dùng Node.js và các công cụ đã có trong `.local-tools`: MongoDB ở `.local-tools/mongodb`, Mailpit ở `.local-tools/mailpit`. Nó đọc cổng từ cấu hình hiện có, không gọi `configure-local.cjs`, không ghi lại `.env` và không yêu cầu Docker. Cần cài sẵn dependencies ở root và `apps/web`.

Dữ liệu MongoDB nằm trong `.local-tools/mongo-data`; lịch sử email nằm trong `.local-tools/mailpit-data/mailpit.db`. Script dùng lại các dữ liệu này. Nếu thiếu công cụ, dữ liệu hoặc cấu hình, script báo lỗi để bạn kiểm tra, thay vì tự tạo một database mới.

Gọi lệnh bật lần nữa khi ứng dụng đã chạy sẽ dùng lại các tiến trình đang chạy của folder này. Nếu cổng bị ứng dụng khác chiếm, script báo lỗi và không tắt ứng dụng đó.

Frontend nằm trong `apps/web`; backend đang hoạt động nằm trong `services`. Bản backend cũ được giữ ở `legacy/backbook-server` để tham khảo và khôi phục, không chạy đồng thời.

Dừng mà giữ dữ liệu:

```powershell
npm.cmd run stop
```

Lệnh dừng tắt các tiến trình đã được launcher ghi nhận, dừng MongoDB qua lệnh shutdown và giữ nguyên dữ liệu, file đã tải lên, lịch sử email.

Log của từng dịch vụ nằm trong `.local-logs`. Khi cần chạy mà không tự mở trình duyệt:

```powershell
npm.cmd run dev -- -NoBrowser
```

Hai lệnh PowerShell trực tiếp `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1` và `... -File .\stop-local.ps1` vẫn dùng được.

Chi tiết: [README chính](README.md), [kiến trúc](docs/ARCHITECTURE.md), [hướng dẫn đọc source](docs/CODE-GUIDE.md).
