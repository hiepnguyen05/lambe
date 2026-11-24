# Kiểm chứng chat và AI chatbot

Cập nhật 30/10/2026. Đây là hướng dẫn tái hiện kiểm thử, không phải xác nhận
đã nghiệm thu production hoặc hoàn thành kiểm tra trên thiết bị thật.

## Tài liệu và phạm vi

- [Chat REST/SSE và ảnh](customer-provider-chat-design.md).
- [Chatbot AI, giá và refresh card](ai-consultation-api.md).
- [UI mobile/frontend](../../tailieuUI.md), mục “Chat và chatbot AI — bổ sung chức năng 30/10/2026”.
- [Nghiệp vụ](../../tailieunghiepvu.md), mục 30.
- [Checklist chính](../../tasks/ke-hoach-cai-tien-he-thong.md), CHAT-021, AI-027 và AI-T04.

Đợt này không có migration/dependency mới. Các bài kiểm tra chat/Feed tổ chức
chỉ là hồi quy bản đang có; P5 vẫn tạm ngưng phát triển.

## Bằng chứng lần chạy đã hoàn tất

| Bộ kiểm tra | Kết quả ngày 30/10 |
| --- | ---: |
| Backend typecheck source/test, ESLint | Đạt trong image Docker Node 22 |
| Backend unit | 774 test, 133 suite đạt |
| AI HTTP + PostgreSQL, Gemini giả lập | 21 đạt |
| Chat tổ chức hồi quy | 13 đạt |
| Feed hồi quy | 23 đạt |
| Booking hồi quy | 34 đạt |
| Chat SSE E2E | 2 đạt |
| Tổng integration/E2E trong phạm vi trên | 93 đạt |
| Toàn bộ Flutter | 215 test đạt; flutter analyze sạch |

Docker đã cập nhật, health OK, Swagger có 312 HTTP operation. Route refresh
AI thiếu JWT trả 401. Đối chiếu dữ liệu/số dư trước–sau đạt; không thêm fixture
vào DB ứng dụng. Các con số này là mốc đã kiểm chứng, không tự tăng theo code
được viết thêm sau mốc này.

## 1. Chạy kiểm tra không gửi dịch vụ thật

Chạy unit/static check từ thư mục backend:

```powershell
npm run check
```

Integration phải dùng DB riêng có tên `lambe_booking_test_*`, Redis DB15 và
NODE_ENV=test. Fixture sẽ tạo dữ liệu và có thể giữ dữ liệu trong DB thử.
Không trỏ DATABASE_URL hoặc TEST_DATABASE_URL tới lambe_db. Cả hai URL phải
cùng trỏ DB thử; không chỉ đặt TEST_DATABASE_URL rồi chạy Prisma với .env app.

Ví dụ PowerShell chạy trong backend, khi Docker PostgreSQL/Redis đang healthy:

```powershell
# Chọn tên mới nếu DB này đã có; không drop DB ứng dụng để làm sạch test.
docker exec lambe-postgres createdb -U postgres lambe_booking_test_chat_ai_manual
if ($LASTEXITCODE -ne 0) { throw 'Chưa tạo được DB thử riêng; kiểm tra Docker hoặc chọn tên DB khác.' }

$testDb = 'postgresql://postgres:postgres_password@postgres:5432/lambe_booking_test_chat_ai_manual'
$testArgs = @(
  'compose', 'run', '--rm', '--no-deps',
  '-e', 'NODE_ENV=test',
  '-e', "DATABASE_URL=$testDb",
  '-e', "TEST_DATABASE_URL=$testDb",
  '-e', 'REDIS_ENABLED=true',
  '-e', 'REDIS_URL=redis://redis:6379/15',
  '-e', 'TEST_REDIS_URL=redis://redis:6379/15',
  '-e', 'FIREBASE_ENABLED=false',
  '-e', 'GEMINI_ENABLED=false',
  'migrate'
)

# Image migrate cần chứa source/test hiện tại.
docker compose build migrate
if ($LASTEXITCODE -ne 0) { throw 'Build image kiểm thử thất bại.' }

& docker @testArgs npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Migration DB thử thất bại.' }

& docker @testArgs npm run test:ai-consultation
if ($LASTEXITCODE -ne 0) { throw 'AI integration thất bại.' }

& docker @testArgs npm run test:e2e -- --runInBand --runTestsByPath test/chat-realtime.e2e-spec.ts
if ($LASTEXITCODE -ne 0) { throw 'Chat SSE E2E thất bại.' }
```

Các tên container, tài khoản và password ví dụ theo Compose phát triển hiện
tại; điều chỉnh cho môi trường test của bạn. `--no-deps` yêu cầu Postgres/
Redis đã chạy. Redis DB15 chỉ dùng test, các suite cùng DB/Redis chạy tuần tự.
Không thực hiện `up` backend app với testArgs. Helper test giả lập Firebase,
mail/upload và Gemini; không dùng cấu hình giả lập này để gửi thông báo thật.

Flutter chạy trong thư mục mobile:

```powershell
flutter analyze
flutter test

# Khi chỉ cần kiểm tra phần đang sửa:
flutter test test/features/shared/chat
flutter test test/features/customer/ai_consultation
```

Không chạy nhiều tiến trình Flutter build/test cùng lúc trên cùng workspace.
Các lệnh trên không cần flutter clean hoặc build APK. Backend không đổi sau
khi sửa Markdown thì không cần dựng lại container chỉ để cập nhật tài liệu.

## 2. Ma trận kiểm tra chat trên hai thiết bị/tài khoản

| Tình huống | Kết quả cần quan sát |
| --- | --- |
| A gửi text, ảnh hoặc thẻ dịch vụ cho B | A có một bubble đang gửi; B nhận đúng một message qua SSE |
| HTTP mất phản hồi sau khi server đã lưu | SSE/call đồng bộ thay bubble tạm; không báo lỗi cho tin đã nhận canonical |
| Lỗi gửi rồi nhấn Gửi lại | Giữ clientMessageId/payload; không có message/sequence mới cho cùng ý định |
| Cùng ID nhưng đổi text/ảnh | Backend trả 409; không tự biến thành tin mới |
| Retry trong khi đang gửi | Không mở thêm request gửi song song |
| SSE ngắt rồi nối lại | Dùng afterSequence từ tin canonical cao nhất; không lấy sequence pending |
| Redis gián đoạn | DB vẫn lưu tin; fallback sync tiếp tục, không hứa độ trễ dưới một giây |
| Tải trang cũ, gửi tin mới rồi tải tiếp | Cursor lịch sử còn nguyên, không lặp/mất trang do cập nhật state |
| Nhiều ảnh lỗi | Cache retry bị giới hạn 3 nhóm/20 MiB; nhóm bị loại cần chọn ảnh lại |
| Thoát phòng/đăng xuất | Dọn stream, timer và dữ liệu ảnh tạm theo vòng đời notifier |
| Tài khoản không thuộc phòng | REST/SSE từ chối, không hiện nội dung của người khác |

Đo từ thao tác gửi đến lúc thiết bị nhận thực sự hiển thị, không chỉ thời
gian HTTP trả về. Ghi môi trường, mạng, số mẫu và p50/p95 nếu đo nhiều lần.
Widget/E2E local không thay cho nghiệm thu CHAT-T07/C01/C03 trên thiết bị.

## 3. Ma trận kiểm tra AI và gợi ý cũ

| Tình huống | Kết quả cần quan sát |
| --- | --- |
| Hỏi kiểu tóc/nail/makeup | Tư vấn cụ thể trước, tối đa một follow-up; không tự đặt đơn |
| Chấp nhận tìm thợ | Chọn địa chỉ/thời gian còn thiếu; Discovery là nguồn thợ/giá |
| Hỏi giá rõ ràng | Khung giá catalog, không dùng giá tự sinh từ model |
| User nhắc dịch vụ mới | Ưu tiên dịch vụ mới, không ép theo gợi ý cũ |
| Service/category/provider/account/offering ngừng ACTIVE | Refresh loại card/action không còn hợp lệ |
| Feed bị ẩn/xóa hoặc mất liên kết dịch vụ | Không mở ảnh mẫu bằng card cũ |
| Giá thay đổi | Hiện giá mới sau refresh; snapshot/text DB gốc không bị viết lại |
| Quay lại app với nhiều assistant message | Một GET lịch sử; ghép result, không burst hàng chục request |
| Hai lần refresh trả kết quả ngược thứ tự | Phản hồi cũ không ghi đè lần kiểm tra mới |
| Card không còn nằm trong 50 tin server trả | Kiểm tra riêng trước sử dụng, giữ tư vấn để đọc |
| Refresh mạng lỗi/401/404/409/429 | Chặn thao tác chưa được kiểm tra; giữ dữ liệu và cho thử lại phù hợp |
| Analytics lỗi sau kiểm tra hợp lệ | Không chặn điều hướng |
| Gemini timeout/503 | API dùng fallback, giữ tin user; không tự retry vô hạn |
| Câu hỏi ngoài phạm vi/PII/claim thương mại | Kiểm tra cả reply, follow-up, nguồn và payload gửi adapter |

AI-004/005 còn mở: các mẫu nhận diện không chứng minh mọi claim ngầm hoặc PII
lạ đều bị chặn. AI-T01/C01–C03 cần đánh giá chuyên môn và trải nghiệm thực tế.

## 4. Đánh giá Gemini thật có chủ đích

Chỉ khi đã cấu hình key ở backend và chấp nhận dùng quota:

```powershell
npm run ai:evaluate -- --live
```

Lệnh gửi năm câu hỏi giả lập, không đọc lịch sử/địa chỉ khách và tắt web search
cho lần đánh giá. Không đưa key vào tham số hoặc gửi key cho mobile. Không tự
chạy trong CI. Process trả lỗi nếu chưa đủ năm câu có advice; không coi đó
là kết quả kiểm thử integration giả lập thất bại.

Đợt đã chạy có 4/5 phản hồi ở mỗi vòng, gặp timeout/503; retry riêng tóc sau
đó thành công. Mẫu thành công khoảng 3,1–10,6 giây. Số mẫu nhỏ, không chứng
minh SLA hay chất lượng ổn định ở mọi chủ đề. Không tăng timeout chỉ để che
việc dịch vụ bên ngoài phản hồi chậm. Ghi nhận câu hỏi giả lập, thời gian,
lỗi và đánh giá chất lượng; không đưa PII/token vào báo cáo.

## 5. Chẩn đoán nhanh

- Chat không cập nhật: kiểm tra token/phạm vi, kết nối SSE, afterSequence và
  Redis; dùng REST afterSequence để phân biệt lỗi đồng bộ với lỗi lưu tin.
- Ảnh lỗi hiển thị: tải lại messages để nhận URL ký mới; không biến URL private
  thành public hoặc chuyển sang preset công khai để khắc phục tạm.
- Gửi lại trả 409: kiểm tra ID/payload/bytes có bị thay đổi hay không; chỉ tạo
  ID mới khi người dùng thực sự tạo ý định gửi mới.
- Card AI biến mất: đọc response refresh và trạng thái catalog/provider/Feed;
  không tự thêm card từ cache để bỏ qua bộ lọc.
- AI chậm/503: kiểm tra log tổng quát và degradedMode; tách thời gian Gemini
  với thời gian DB/API Lambe. Không log credential hoặc body riêng tư.

Khi bàn giao, ghi phiên bản image/commit nếu có, DB/Redis test sử dụng, bộ test
đã chạy và các checkpoint chưa xác minh. Các con số từ đợt trước không tự
nghiệm thu cho thay đổi code mới.

### Đồng bộ tài liệu P6 — 31/10/2026

Hợp đồng [Observability API](observability-api.md) bổ sung cách đọc metrics
chat/AI đúng scope và đơn vị. Counter SSE duration là tuổi kết nối, không phải
latency tin nhắn; CTA offered/selected không phải tỷ lệ đặt đơn. SQL counters
và latency của baseline chỉ thuộc dữ liệu/đường chạy đã đo.

P6 đã kiểm chứng Redis reconnect và race handoff subscriber bằng regression,
thêm fault test Redis instance riêng; production vẫn có thể fail-closed 503
bởi rate protection. Hướng dẫn UI giữ danh sách/cursor/bản nháp khi lỗi, retry
cùng ID và xử lý quyền nằm ở phần P6 của [tài liệu UI](../../tailieuUI.md).
Các giới hạn/requestId/log/cache và test-target bắt buộc nằm tại
[runbook](quality-operations-runbook.md).

Mốc P6 sau mốc chat/AI 30/10: check 808 unit backend, 319 trường hợp E2E/
integration duy nhất, 215 Flutter test. Đây là bằng chứng lưu trong
[báo cáo nghiệm thu](quality-verification-2026-10-30.md), không phải một lượt
chạy mới của đợt chỉnh Markdown và không thay hai thiết bị thật/iOS/APNs hoặc
đánh giá chuyên môn AI. P5 vẫn tạm ngưng, không tự đóng các checkbox còn mở.
