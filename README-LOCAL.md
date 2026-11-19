# Chạy PTITSocial trên localhost

Mở thư mục repository trong VS Code. Cần Node.js 22 và Docker Desktop đang chạy.

Lần đầu cài:

```powershell
npm.cmd install
npm.cmd --prefix apps/web ci
```

Bật hệ thống:

```powershell
npm.cmd run dev
```

Hoặc chạy `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1`. Task **Ctrl + Shift + B** trong VS Code gọi cùng script này. Không dùng nút Go Live để khởi động ứng dụng MERN.

- Website: http://localhost:3000
- Gateway và trạng thái bảy dịch vụ: http://localhost:8000/health
- Email thử nghiệm: http://localhost:8025

Docker chạy MongoDB, Mailpit, Judge0 và LiveKit. Node chạy Accounts (8001), Content (8002), Messaging (8003), Quiz (8004), Coding (8005), Study (8006), Learning (8007) và Gateway (8000). Script tạo cấu hình thiếu, giữ các secret đã có và ghi log vào `.local-logs`.

Các chức năng mới có trong menu **Chức năng học tập** ở header và sidebar bảng tin. Mẫu địa điểm học tập chỉ được tạo khi kho địa điểm còn trống.

Dừng mà giữ database và file đã tải lên:

```powershell
npm.cmd run stop
```

AI cần key riêng trong `services/learning/.env`. Quyền quản lý tài liệu dùng `DOCUMENT_MODERATOR_IDS` trong `services/content/.env`. Không đưa các file `.env` lên Git. Chi tiết cấu hình và giới hạn micro khi chia sẻ qua Internet nằm trong [README chính](README.md).

Khi chia sẻ bằng VS Code Ports, chỉ cần Public cổng **3000** và cấu hình `PUBLIC_APP_URL` trong `.env` root. Giữ Mailpit **8025** ở Private vì hộp thư chứa mã xác nhận và khôi phục mật khẩu.
