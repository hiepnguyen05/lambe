# Kiểm tra Lambe trên realme RMX3261 — 09/11/2026

Phạm vi: bản Android **profile** ARM64, Android 11 (API 30), backend Docker qua
`adb reverse tcp:5000 tcp:5000`. Cài đè APK, giữ dữ liệu app. Không lưu token,
tọa độ hay ảnh màn hình trong báo cáo.

## Kết quả đã xác minh

| Tình huống | Bằng chứng | Kết quả |
| --- | --- | --- |
| Đăng nhập tài khoản thợ test | Firebase OTP test qua reCAPTCHA, backend trả hồ sơ hiện có | Đạt sau khi sửa số điện thoại seed |
| Bật nhận đơn | UI online, Android `GeolocatorLocationService` ở foreground, Redis có một heartbeat và điểm geo | Đạt |
| App ở nền 35 giây | Service vẫn foreground, heartbeat mới nhất cách thời điểm đo 16,8 giây | Đạt |
| Khóa màn 35 giây | `mWakefulness=Asleep`, service vẫn foreground, heartbeat mới nhất cách thời điểm đo 9,3 giây | Đạt |
| Tắt nhận đơn | Heartbeat và điểm geo của thợ biến mất; service dừng | Đạt |
| Force-stop khi online | Service dừng ngay; sau 142,7 giây heartbeat đã quá TTL 120 giây và process vẫn tắt | Đạt giới hạn TTL |
| Mở lại sau force-stop | UI báo offline; PostgreSQL có 0 availability session đang mở | Đạt |

Lúc bắt đầu bật nhận đơn, heartbeat cách thời điểm đo 22,4 giây. Các lần đo ở
nền và màn khóa xác nhận đã có heartbeat mới; đây là bằng chứng app vẫn gửi vị
trí trong hai trạng thái này trên **một** mẫu máy, chưa phải kết luận cho mọi
thiết bị hay phiên bản Android. Sau TTL, bản ghi Redis cũ vẫn tồn tại cho tới
khi có truy vấn tìm kiếm dọn theo cơ chế lazy cleanup; `isOnline` và lọc kết
quả đều so thời điểm heartbeat với TTL. Đã dọn bản ghi thử nghiệm sau phép đo.
Chưa gọi API tìm thợ từ tài khoản khách trong lượt này.

## Hiệu năng bản profile

Nguồn số đo: [JSON thiết bị](android-rmx3261-profile-2026-11-09.json), 5 lần
khởi động lạnh process với cache/phiên vẫn giữ, chờ 10 giây trước khi lấy PSS.

| Chỉ số | Lần này | Mốc 04/11 |
| --- | ---: | ---: |
| `am start -W` TotalTime trung vị | 2.065 ms | 2.042 ms |
| PSS trung vị | 159,98 MiB | 167,46 MiB |
| PSS thấp nhất–cao nhất | 157,46–160,87 MiB | 166,98–170,09 MiB |
| APK profile ARM64 | 58,91 MiB | 58,91 MiB |

Các build và trạng thái thiết bị không được cô lập để chứng minh thay đổi RAM
hay startup do một commit. `am start -W` không đo thời gian đến lúc thao tác
được; PSS là bộ nhớ cả process. APK profile không phải dung lượng tải từ Play.
Máy đang sạc USB nên không đo mức hao pin. Chưa đo FPS/jank, map/video, EN_ROUTE,
chế độ tiết kiệm pin và kết thúc đơn. Năm mẫu trên được lấy **trước** bản sửa
logout bên dưới; không dùng chúng làm số đo hiệu năng sau bản sửa.

## Kiểm tra bổ sung: đăng xuất khi đang online

Trên bản APK trước sửa, đăng xuất từ mode đối tác đã về màn đăng nhập nhưng
Android FGS vẫn chạy, Redis còn heartbeat và PostgreSQL còn một availability
session mở. Sau hơn 12 giây service vẫn chạy. Đã force-stop app và dọn dữ liệu
online test trước khi sửa.

Bản sửa dừng coordinator GPS và gọi API tắt nhận đơn trước khi xóa phiên đăng
nhập, tại cả hai màn đăng xuất. Cài đè APK profile mới, đăng nhập/bật nhận đơn
trở lại và kiểm tra trên cùng thiết bị:

| Đường đăng xuất | Foreground service | Redis heartbeat | Session backend mở |
| --- | --- | --- | ---: |
| Từ mode đối tác | Đã dừng | Không còn | 0 |
| Từ mode khách sau khi thợ chuyển mode nhưng vẫn online | Đã dừng | Không còn | 0 |

Coordinator có thêm `stopAll()` để hủy receiving và EN_ROUTE trong một lần
dọn. Test fake sensor kiểm tra không còn timer/upload sau khi dừng; 29/29 test
location đạt. Router gọi `stopAll()` trước khi xóa trạng thái auth khi refresh
token bị từ chối. Trên máy thật, thu hồi **duy nhất phiên test mới nhất** trực
tiếp trong DB, sau đó mở màn đơn để nhận 401: app chuyển về màn đăng nhập và
FGS dừng. Vì thu hồi trực tiếp trong DB không gọi API offline, heartbeat Redis
cũ vẫn còn cho tới TTL 120 giây; đã đóng availability session và dọn Redis sau
phép thử. Đây là kiểm tra nhánh phiên bị thu hồi, chưa đo hết hạn token tự nhiên.
Nếu API offline không truy cập được, app vẫn dừng GPS và hoàn tất logout;
backend sẽ loại heartbeat cũ theo TTL, chưa xác minh riêng nhánh lỗi mạng này.

## Lỗi dữ liệu thử nghiệm đã sửa

Script `backend/scripts/bootstrap-local-test-accounts.sql` trước đây lưu số
điện thoại dạng `+84...`, nhưng `normalizeVietnamesePhone()` ở backend đổi số
Firebase thành `0...` trước khi tra `users.phone`. App vì thế đưa tài khoản thợ
đã tồn tại sang “Hoàn tất đăng ký”. Đã thống nhất hai số test trong script và
PostgreSQL local về `0777777777` / `0999999999`. Đăng nhập lại qua Firebase
thành công, không bypass OTP. Cần giữ cùng định dạng khi tái tạo DB test.

## Còn cần kiểm tra

- Gọi API tìm thợ từ tài khoản khách sau force-stop để đối chứng lọc TTL end-to-end.
- Chế độ tiết kiệm pin, pin khi không cắm USB và các hãng Android khác.
- EN_ROUTE, order hoàn thành/hủy, token hết hạn tự nhiên và offline API lỗi trên thiết
  bị thật: stream, service, heartbeat phải dừng theo trạng thái thực tế.
- Độ mượt khung hình và RAM trên màn bản đồ, feed và chat.
