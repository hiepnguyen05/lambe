# Đo mobile trên Android thật

Ngày bắt đầu 04/11/2026. Mẫu đầu: realme RMX3261, Android 11/API 30,
ARM64, khoảng 3 GB RAM. Dùng profile để đo runtime. Debug/universal APK chỉ
phục vụ phát triển, không dùng làm số đo dung lượng tải production.

## Lặp lại phép đo

1. Kết nối thiết bị có USB debugging, xác nhận bằng `adb devices -l`.
2. Chạy backend Docker; kiểm tra cổng thực tế bằng `docker port lambe_server 5000/tcp`.
   Cho máy thật đi qua `adb -s <serial> reverse tcp:5000 tcp:<host-port>`.
   Nếu host dùng 5001, reverse tới 5001; bản profile vẫn dùng URL localhost:5000.
3. Build và cài profile cùng chữ ký bằng `adb install -r`. Nếu chữ ký khác,
   dừng; không uninstall hoặc clear dữ liệu để ép cài.

```powershell
cd D:\Project\Lambe\mobile
$measureTemp = Join-Path (Get-Location).Path '.dart_tool\java-tmp'
New-Item -ItemType Directory -Path $measureTemp -Force | Out-Null
$env:TEMP = $measureTemp
$env:TMP = $measureTemp
$env:JAVA_TOOL_OPTIONS = '-Djava.io.tmpdir=' + $measureTemp + ' -Djdk.net.unixdomain.tmpdir=' + $measureTemp
flutter build apk --profile --target-platform android-arm64 --dart-define=API_BASE_URL=http://127.0.0.1:5000/api
```

Các biến trên chỉ áp dụng vào tiến trình PowerShell hiện tại. Profile Android
cho phép HTTP riêng localhost/127.0.0.1/10.0.2.2 để test qua USB/emulator;
network-security config này không đóng gói vào release.

4. Lấy trace first frame bằng công cụ Flutter có sẵn; giữ raw trace trong
   thư mục build được ignore. Báo cáo chỉ xuất các số thời gian, không xuất
   log tài khoản, GPS, token hay nội dung khách hàng.

```powershell
flutter run --profile --no-pub --trace-startup -d <serial> --dart-define=API_BASE_URL=http://127.0.0.1:5000/api
```

5. Chạy script lấy mẫu Android Activity startup/PSS. Script force-stop và
   khởi động lại riêng Lambe, giữ dữ liệu và cache đĩa. Cần kết thúc tác vụ
   đang làm trong app trước khi đo. Không chạy cùng một phép đo khác.

```powershell
& .\tool\measure-android.ps1 -Serial <serial> -BuildMode profile -Runs 5 -SettleSeconds 10 `
  -ApkPath .\build\app\outputs\flutter-apk\app-profile.apk `
  -OutputPath D:\Project\Lambe\backend\docs\qa\mobile\android-profile-samples.json
```

Script chỉ ghi metadata thiết bị, trạng thái sạc, số đo tiến trình Lambe và
SHA256/kích thước APK; không ghi serial hoặc đọc dữ liệu ứng dụng khác.

## Ý nghĩa và giới hạn

- Flutter timeToFirstFrame: frame Flutter đầu, không phải màn Home sẵn sàng.
  Splash vẫn có thể tiếp tục auth/địa chỉ/điều hướng sau đó.
- `am start -W`: thời gian Android Activity, không thay thế Flutter frame hoặc TTI.
- PSS: toàn tiến trình, gồm native/graphics/shared pages; không chỉ Dart heap.
- Các lượt cold process còn giữ cache đĩa, shader và phiên đã có. Mẫu ít chỉ
  là số tham chiếu; không dùng để tuyên bố đạt P95 trên mọi máy.
- Sạc USB và nhiệt độ phải ghi cùng số đo. Chưa được kết luận pin %/giờ từ
  phiên có sạc, không reset hoặc giả lập battery stats để tạo kết quả đẹp.
- APK profile ARM64 không đồng nghĩa download size AAB từ Play. So sánh các
  lần cùng build mode/ABI/toolchain; không gán chênh debug/profile thành cải
  thiện của code. Phân tích release/AAB vẫn thuộc SIZE-001 và SIZE-007/008.

BASE-006 chỉ hoàn thành sau khi có frame/jank, RAM, network, pin và size cho
các kịch bản bắt buộc. Chạy app thành công hoặc lấy PSS màn đầu không đóng
QA cuộn Feed/Chat, map, upload, online idle, EN_ROUTE, màn hình khóa/force-stop
hay nghiệm thu iOS. Profile đo theo hướng dẫn
[Flutter build modes](https://docs.flutter.dev/testing/build-modes).
