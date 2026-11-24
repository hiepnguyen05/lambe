# Kiểm thử đặt ngay hai thiết bị và GPS nền · 12/11/2026

## Môi trường

- Khách hàng: Android emulator x86_64, tài khoản test `0999999999`.
- Đối tác: RMX3261 ARM64, tài khoản test `0777777777`.
- Mobile: APK profile build từ cùng source; emulator gọi
  `http://10.0.2.2:5000/api`, điện thoại thật gọi API cổng 5000 qua ADB reverse.
- Backend `lambe_server`, PostgreSQL và Redis đều healthy trong Docker.
- Đơn kiểm thử: `b9fe9ba6-1095-4ff2-b737-60a069675423`, dịch vụ Cắt tóc nam
  cơ bản, tổng tiền 115.000đ, loại ASAP.

## Luồng đã kiểm chứng

| Bước | Kết quả |
| --- | --- |
| Backend tạo đơn `PENDING_PROVIDER` qua quote và create API | Thành công |
| Điện thoại thợ nhận popup đơn mới | Thành công, khoảng 10 giây |
| Thợ chấp nhận | Backend `ACCEPTED`; khách hiện “Thợ đã nhận đơn” |
| Thợ bắt đầu di chuyển | Backend `EN_ROUTE`; Android location FGS hoạt động |
| Khách mở theo dõi trực tiếp | Bản đồ, vị trí, tiến trình, đối tác và giá hiện đúng |
| Thợ xác nhận đã đến | Backend `ARRIVED`; khoảng cách ghi nhận 2 m |
| Khách nhận trạng thái mới | Tự đổi sang “Chuyên viên đã đến nơi” |

## Lỗi phát hiện và sửa

`CustomerOrderTrackingScreen` dùng `Stack` với child không positioned đầu tiên
là `SizedBox.shrink()`. Vì `Stack` không có ràng buộc kích thước riêng, body co
về 0 và chỉ còn AppBar, dù dữ liệu và tracking API vẫn hoạt động.

Đã thêm `fit: StackFit.expand` cho body Stack. Đây là thay đổi tối thiểu tại
đúng nguyên nhân, không đổi API, state management hoặc luồng dữ liệu. Kết quả:

- `flutter analyze` file thay đổi: không có issue.
- 5/5 test tracking/map đạt.
- APK profile x86_64 build, cài đè và kiểm chứng trực quan thành công.

## GPS và chạy nền

- Trong `EN_ROUTE`, Redis có khóa
  `lambe:orders:tracking:b9fe9ba6-1095-4ff2-b737-60a069675423` với TTL; Android
  foreground location service hoạt động.
- Khi sang `ARRIVED`, khóa tracking hết hạn và `dumpsys location` cho thấy yêu
  cầu GPS chủ động được gỡ tại đúng thời điểm xác nhận đến nơi.
- Khi app thợ chạy nền nhưng vẫn online, heartbeat tăng từ
  `1794489092696` lên `1794489222710`; tọa độ idle tiếp tục được làm mới.
- Khi tắt/khóa màn hình, heartbeat tiếp tục tăng sau một chu kỳ 60 giây.
- Khi mô phỏng rút sạc và bật Battery Saver thật (`low_power=1`), RMX3261 đình
  chỉ heartbeat nền. Redis state tự hết TTL, vì vậy backend loại thợ khỏi tập
  online thay vì phân đơn dựa trên vị trí cũ. Đã tắt Battery Saver và reset mô
  phỏng pin về trạng thái sạc thật sau phép thử.
- Khi tắt nhận đơn, state và heartbeat Redis bị xóa. Location service không còn
  foreground và Android Location Manager không còn request của Lambe.
- 36/36 test coordinator/dashboard location đạt, gồm background, logout,
  offline, terminal order, one-sensor, single-flight và chống GPS cũ đến muộn.

## Helper kiểm thử

`backend/scripts/create-local-test-order.mjs` hỗ trợ dừng tại
`PENDING_PROVIDER`, `ACCEPTED` hoặc `EN_ROUTE`, và thao tác đơn có sẵn. Đã bỏ
`process.exit()` khỏi các nhánh sớm; Prisma luôn disconnect trong `finally` để
không còn lỗi libuv sau khi script đã in kết quả. `node --check` đạt.

## Giới hạn còn mở

- Chưa hoàn tất force-stop và chưa đo hao pin dài hạn khi rút sạc. ADB của
  RMX3261 mất kết nối sau bước reset pin/màn khóa trước khi chạy force-stop;
  BG-AND-006 vẫn mở và không được suy diễn là hoàn tất.
- Chưa đo request/phút đồng thời ở Home, Chat, tracking và provider online;
  NET-012 chưa hoàn tất.
- Chưa chạy tiếp `IN_PROGRESS -> COMPLETED` trên hai thiết bị vì luồng yêu cầu
  bằng chứng ảnh trước/sau dịch vụ và thu tiền; state machine nhánh này đã có
  test tự động nhưng chưa được coi là nghiệm thu thiết bị thật.
- Tuyến đường chưa được đánh giá trong chuyến di chuyển thực tế vì hai tọa độ
  thử nghiệm gần như trùng nhau.
