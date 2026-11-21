# PTITSocial — giao diện React

Frontend của mạng xã hội hỗ trợ học tập và kết nối sinh viên PTITSocial. Hướng dẫn chạy toàn bộ hệ thống nằm tại [README gốc](../../README.md).

## Cấu trúc src

- `app/`: Redux store và các slice.
- `features/`: component, hook và xử lý theo chức năng.
- `pages/`: trang giao diện gắn với URL.
- `routes/`: điều hướng, xác thực và kết nối thời gian thực.
- `shared/`: thành phần UI, icon, tiện ích và hook dùng chung.
- `setupProxy.js`: chuyển API, upload và socket từ cổng 3000 đến Gateway.

## Lệnh chạy từ thư mục gốc repository

```powershell
npm.cmd --prefix apps/web ci
npm.cmd run start:web
npm.cmd run test:web
npm.cmd run build:web
```

Frontend riêng cần Gateway và các dịch vụ backend đang chạy. Máy mới nên dùng `start-local.ps1` ở thư mục gốc để tạo cấu hình và chạy toàn bộ hệ thống.

Các biến cấu hình nằm trong `apps/web/.env.example`. Không commit `.env.local`, `build/`, `node_modules/` hay key riêng.
