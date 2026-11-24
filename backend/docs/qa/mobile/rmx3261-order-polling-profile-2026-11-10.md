# RMX3261 · Kiểm tra APK profile sau tối ưu mạng · 10/11/2026

## Môi trường

- Android RMX3261, bản `app-profile.apk` build lại ngày 10/11, API
  `http://localhost:5000/api` qua ADB reverse `tcp:5000`.
- Backend, PostgreSQL và Redis của Lambe healthy; `/api/health` trả 200 với
  `database=up`, `cache=up` trên host và trình duyệt thiết bị.
- Đăng nhập tài khoản đối tác thử nghiệm bằng Firebase OTP, chuyển sang mode
  đối tác. PostgreSQL có hai tài khoản test cũ, không cần tái tạo dữ liệu.
- [Dữ liệu đo 5 lần](android-rmx3261-profile-2026-11-10.json) dùng script
  `mobile/tool/measure-android.ps1`, mỗi lần khởi động lạnh process và chờ
  10 giây trước khi đo PSS. Máy cắm USB lúc đo.

## Kết quả

| Chỉ số | 09/11 | 10/11 |
| --- | ---: | ---: |
| Trung vị Android `am start -W` TotalTime | 2.065 ms | 2.114 ms |
| Trung vị PSS toàn process | 159,98 MiB | 154,47 MiB |
| PSS nhỏ nhất–lớn nhất | 157,46–160,87 MiB | 152,61–155,27 MiB |
| APK profile ARM64 | 58,91 MiB | 58,91 MiB |

Đây là số đo màn khởi động/đăng nhập trong điều kiện hiện tại; mức chênh không
đủ để kết luận phần tối ưu polling đã giảm RAM. `am start -W` không đo thời
gian đến khi màn tương tác được. APK profile không phải kích thước tải từ store.

| Kiểm tra trên bản mới | Kết quả |
| --- | --- |
| Cài đè APK, giữ dữ liệu app | Thành công |
| Mở app và đăng nhập Firebase bằng số thử nghiệm | Thành công |
| Chuyển mode đối tác, tải dashboard | Thành công |
| Bật nhận đơn | UI online; một phiên availability mở; Android FGS chạy |
| App ở nền 35 giây | Màn chính Android hiện; FGS còn chạy; heartbeat mới nhất 9 giây |
| Tắt nhận đơn | UI offline; 0 phiên availability mở; FGS dừng |

Database hiện có **0 đơn hàng**, nên chưa thể nghiệm thu trực tiếp việc dừng
poll/SSE trên màn theo dõi đơn, hoặc xử lý GPS khi đơn `EN_ROUTE` hoàn thành/hủy.
Các nhánh này vẫn có test notifier/widget nhưng cần một đơn tạo qua API thật
để đo request/phút và tài nguyên trên thiết bị. Chưa đo pin vì máy cắm USB;
chưa thử chế độ tiết kiệm pin, màn khóa, bản đồ hay video ở lượt này. Các mục
NET-012, LOC-006, BG-AND-006 và BASE-006 vẫn mở.

## Sự cố Docker trong lúc chuẩn bị

Lambe và một dự án khác cùng dùng tên project Compose mặc định `backend`, làm
container PostgreSQL bị thay thế qua lại. Đã đặt `name: lambe` trong Compose
Lambe và gắn lại hai named volume cũ bằng tên rõ ràng, giữ dữ liệu. Đã khôi phục
container PostgreSQL của dự án còn lại từ volume gốc, xác nhận schema có 30
bảng và API của dự án đó trả 200. Sau đó dựng lại Lambe dưới network riêng;
Lambe `/api/health` trở lại 200. Không xóa named volume nào.
