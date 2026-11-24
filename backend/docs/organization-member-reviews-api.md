# Đánh giá đối tác và chuyên viên — P5E.2

Cập nhật 29/10/2026. Phạm vi ORG-063: một đánh giá của khách cho đơn hoàn
tất, đồng thời đóng góp vào điểm đối tác và điểm chuyên viên đã thực hiện.
Không tạo hai review, không yêu cầu khách nhập hai lần. Chỉ triển khai backend;
client Flutter/React cần nối theo contract dưới đây.

## 1. Quy tắc và nguồn dữ liệu

- Chỉ customer sở hữu đơn `COMPLETED` được gửi. Owner, worker hoặc người khác
  không có quyền đánh giá thay khách; tài khoản đối tác vẫn có thể đánh giá
  đơn họ đặt với tư cách khách của một đối tác khác.
- Backend sao chép `providerId`, `assignedMemberId`, version, tên/ảnh của
  người thực hiện từ snapshot bất biến của đơn. Không lấy tên hiện tại từ
  danh sách nhân viên, không nhận trường phân công từ client.
- `OrderReview.orderId` unique. Khóa hàng đơn trước khi kiểm tra/tạo review;
  tạo review và `ORDER_REVIEW_CREATED` nằm trong cùng transaction. Hai yêu
  cầu đồng thời chỉ một yêu cầu thành công; yêu cầu còn lại nhận `409`.
- Điểm đối tác = trung bình tất cả review của `providerId`; điểm chuyên viên
  = trung bình review của cặp `providerId/memberId`. Ví dụ worker A nhận 5/3,
  B nhận 1 thì A=4 với 2 review, B=1 với 1 review, tổ chức=3 với 3 review.
  Không lấy trung bình đơn giản của các điểm trung bình nhân viên.
- Cùng member rời rồi gia nhập lại vẫn giữ uy tín từ các nhiệm kỳ trước;
  từng review giữ version của đơn cũ. Không gom theo `userId` xuyên tổ chức.
- Đơn cá nhân hoặc legacy chưa phân công: `assignedMember=null`, chỉ đóng
  góp cho đối tác; không gán ngược cho owner/nhân viên hiện tại.
- Đổi tên, đổi ảnh, nghỉ việc hoặc khóa sau khi phục vụ không làm đổi người
  thực hiện trong review. Lịch sử review member còn công khai khi họ nghỉ;
  endpoint review không phải chứng nhận member còn nhận được đơn.
- Chưa có review: `count=0`, `averageRating=null`, không phải 0 hay 5 sao.

## 2. Gửi đánh giá

`POST /api/me/orders/:id/review`, Bearer **User Access Token**.

```json
{ "rating": 4, "comment": "Chuyên viên làm việc cẩn thận, đúng giờ." }
```

`rating` bắt buộc là JSON integer 1–5, không phải chuỗi; `comment` tùy chọn,
trim, tối đa 1.000 ký tự. Không gửi `providerId`, `customerId`, `memberId`,
`membershipVersion`, tên/ảnh hoặc `createdAt`; field thừa bị từ chối.

HTTP `201`, envelope chuẩn (lược timestamp trong ví dụ):

```json
{
  "statusCode": 201,
  "success": true,
  "data": {
    "id": "1f52d81e-6977-4818-a4f6-d160f8245358",
    "rating": 4,
    "comment": "Chuyên viên làm việc cẩn thận, đúng giờ.",
    "createdAt": "2026-10-29T05:00:00.000Z",
    "assignedMember": {
      "id": "216a1b81-4061-42be-b08a-3497522fb430",
      "displayName": "Nguyễn Văn An",
      "avatarUrl": null
    }
  }
}
```

HTTP `400`: body/UUID sai, có field thừa; `401`: JWT không hợp lệ; `404`:
không có đơn thuộc khách hiện tại; `409`: chưa hoàn tất hoặc đã đánh giá.
Không trả thông tin đơn khác cho người gọi. Nếu mất phản hồi sau khi gửi,
đọc lại `GET /api/me/orders/:id`: `data.review` có cùng cấu trúc như trên.
Không tạo review thứ hai để xử lý retry. API chưa có sửa/xóa review tự phục vụ.

## 3. Đọc công khai

| Method | Endpoint | Phạm vi |
| --- | --- | --- |
| GET | `/api/providers/:id/reviews` | Đối tác cá nhân hoặc toàn tổ chức; giữ đường dẫn cũ |
| GET | `/api/providers/:providerId/members/:memberId/reviews` | Chỉ chuyên viên thuộc đúng tổ chức |

Không cần JWT. Các path ID là UUID v4. Query: `limit` integer 1–50, mặc định
20; `cursor` là `nextCursor` của lần trước, không phải page/offset.

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "count": 1,
    "averageRating": 4,
    "reviews": [{
      "id": "1f52d81e-6977-4818-a4f6-d160f8245358",
      "rating": 4,
      "comment": "Chuyên viên làm việc cẩn thận, đúng giờ.",
      "createdAt": "2026-10-29T05:00:00.000Z",
      "assignedMember": {
        "id": "216a1b81-4061-42be-b08a-3497522fb430",
        "displayName": "Nguyễn Văn An",
        "avatarUrl": null
      }
    }],
    "nextCursor": null
  }
}
```

`count/averageRating` tính toàn bộ phạm vi, không chỉ trang hiện tại. Hai
query tổng hợp/trang chạy trong một snapshot `REPEATABLE READ`. Sắp xếp
`createdAt DESC, id DESC`; cursor kiểm tra trong đúng provider/member trước
khi phân trang. Cursor của worker/tổ chức khác, không tồn tại, sai UUID hoặc
limit sai nhận `400`; member không thuộc tổ chức nhận `404`.

Không tự động trả orderId, customerId, userId, số điện thoại, địa chỉ, GPS,
membershipVersion hoặc KYC trong hai API danh sách review. `comment` là nội
dung khách chủ động đăng, phải render dạng text; không xem như HTML. UI nên
nhắc khách không đưa giấy tờ, SĐT hoặc địa chỉ riêng vào nhận xét.

## 4. Hồ sơ và tìm thợ

- `GET /api/providers/:providerId/members` và `.../:memberId` bổ sung
  `reviewSummary: { count, averageRating }` của chính member.
- `POST /api/discovery/providers/search`: thẻ worker tổ chức có top-level
  `reviewSummary` cùng cấu trúc. `member.id`/`memberId` là người được chấm;
  không dùng điểm toàn tổ chức để thay cho điểm worker.
- Tổng hợp theo một query `GROUP BY memberId` cho cả tập ứng viên, tránh
  gọi aggregate cho từng worker/dịch vụ. Không có ứng viên thì không query
  bảng review. Điểm không tự thay đổi thuật toán xếp hạng hoặc giữ lịch.
- `GET /api/providers/:id/public`: `stats.rating` là điểm đối tác thực tế,
  **nullable khi chưa có review**, `stats.reviewCount=0`. Mảng `reviews` gần
  nhất bổ sung `assignedMember`; các field tác giả đang có vẫn giữ contract.
  Lỗi query review không bị chuyển thành điểm/đếm giả.
- Thẻ cá nhân trong discovery chưa được bổ sung `reviewSummary` ở batch này.
  Client không được tự suy ra điểm hoặc số review từ kinh nghiệm, vị trí hay
  từ việc thiếu field. Không có dữ liệu thì ẩn badge; không gán mặc định 5 sao.

## 5. Migration, vận hành và kiểm chứng

Migration `20261029110000_order_member_reviews` chạy trong transaction. Kiểm
tra review hiện có phải khớp customer/provider của đơn hoàn tất trước khi
backfill. Nếu không khớp thì dừng để điều tra; không xóa hoặc sửa nội dung
review để vượt qua kiểm tra. Đơn assigned được backfill đúng snapshot; legacy
giữ null. Giữ nguyên ID, rating, comment, createdAt và số review.

FK giữ member đã được review; CHECK/trigger bảo vệ tuple, đơn hoàn tất và
attribution bất biến ngay cả khi ghi trực tiếp vào DB. DB vẫn chặn rating
ngoài 1–5 và nhiều review trên cùng đơn. Index `(providerId, createdAt, id)`
thay index hai cột cũ; thêm `(memberId, createdAt, id)` cho phân trang.

Không thêm env/dependency, không sửa ví/hoa hồng/payout. Không tự gửi push
review ở batch này. Kiểm duyệt/report/trả lời review nằm ngoài ORG-063.
Aggregate chính xác vẫn tăng chi phí theo lịch sử review; chưa có kết quả
load test hay materialized counter. QA tải/FCM/rollback còn riêng trong kế hoạch.

Rollout cần phối hợp image/schema và tạm ngừng ghi review trong cửa sổ đổi
image. Image cũ không ghi tuple member nên không tương thích ghi review
assigned sau migration. Rollback phải dùng hotfix hiểu snapshot; không xóa
review/cột mới hoặc sửa lịch sử để chạy image cũ. Rehearsal không thay thế
diễn tập rollback image có dữ liệu thực.

Lệnh PowerShell kiểm thử (chỉ DB thử, Redis DB 15):

```powershell
$env:NODE_ENV='test'
$env:TEST_DATABASE_URL='postgresql://postgres:postgres_password@localhost:5433/lambe_booking_test_member_reviews_20261029_01'
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:REDIS_ENABLED='true'
$env:REDIS_URL='redis://127.0.0.1:6379/15'
$env:TEST_REDIS_URL=$env:REDIS_URL
$env:FIREBASE_ENABLED='false'
npm run test:organization-reviews:migration
npm run test:organization-reviews
```

Rehearsal tạo schema riêng trong DB `lambe_booking_test_*`, kiểm tra backfill,
legacy/nội dung, unique, FK và trigger rồi rollback toàn bộ schema. Đừng
chạy integration/seed trên `lambe_db`. Migration trên DB thử cũ ở vòng phát
triển trước có checksum bản nháp; dùng DB thử mới nêu trên cho bản cuối.

Nghiệm thu: typecheck/typecheck:test/lint và 743 unit (129 suites) đạt trên
Docker Node 22; 181 integration/E2E gồm 19 review, 13 chat tổ chức, 18 finance,
20 booking tổ chức, 34 booking cá nhân, 75 membership/KYC/capabilities và 2
SSE chat đều đạt. Rehearsal và cả 56 migration trên DB thử mới thành công.
Image đã cập nhật, health OK, Swagger 305 operation. DB ứng dụng giữ nguyên
8 user, 1 provider/member, 19 order, 1 chat, 31 message, 2 review; tổng balance
165.000đ/held 5.000đ không đổi. Chỉ đọc kiểm tra phân trang hai review hiện có,
không seed dữ liệu test vào DB ứng dụng.
