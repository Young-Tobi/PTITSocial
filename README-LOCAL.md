# Chạy PTITSocial trên localhost

Source đã được tổ chức lại. Xem [README chính](README.md) để biết cấu trúc, cách chạy và các lệnh kiểm tra.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

- Website: http://localhost:3000
- Trạng thái backend: http://localhost:8000/health
- Email thử nghiệm: http://localhost:8025

Các tài khoản và dữ liệu cũ trên máy hiện tại đã được chuyển sang ba database mới. Hai tài khoản mẫu `an@example.com`, `binh@example.com` vẫn dùng mật khẩu `Backbook@123` nếu bạn chưa tự đổi.

Frontend nằm trong `apps/web`; backend đang hoạt động nằm trong `services`. Bản backend cũ được giữ ở `legacy/backbook-server` để tham khảo và khôi phục, không chạy đồng thời.

Dừng mà giữ dữ liệu:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\stop-local.ps1
```

Chi tiết: [kiến trúc](docs/ARCHITECTURE.md), [hướng dẫn đọc source](docs/CODE-GUIDE.md).
