# Đặt lịch theo nhân viên tổ chức — P5C

Cập nhật 28/10/2026. Base `/api`. Dùng Bearer User Access Token của Lambe;
token nội bộ không thay token khách/worker. Đây là contract backend đã triển
khai; chưa triển khai giao diện mobile ở batch này.

## 1. Định danh và nguyên tắc

| Field | Ý nghĩa |
| --- | --- |
| `serviceId` | Dịch vụ danh mục chung của Lambe; dùng khi discovery |
| `providerId` | Đối tác, cũng là tổ chức sở hữu giá, dịch vụ, voucher và ví |
| `providerServiceId` | Dịch vụ do đối tác cung cấp; discovery trả trong `service.id` |
| `memberId` | Người thực hiện thuộc tổ chức; bắt buộc với quote/create tổ chức |
| `assignedMemberId` | Người đã chọn được lưu bất biến trong đơn |
| `assignedMember` | Snapshot công khai `id,displayName,avatarUrl` của người đó |

Một tổ chức trả được nhiều thẻ cùng providerId. Client dùng khóa
`providerId:memberId`; không khử trùng theo providerId. Đối tác cá nhân giữ
luồng cũ: không gửi memberId, các field member/organization bổ sung là null.
Không tạo profile, giá, ví hoặc thu nhập riêng cho worker.

Khách không tự đặt dịch vụ của mình, của tổ chức mình sở hữu hoặc chọn chính
mình làm worker. Owner chỉ nhận/thực hiện khi chính owner là member được chọn
và đủ điều kiện. Không tự động đổi người sau khi tạo/nhận đơn.

## 2. API lựa chọn và lịch

| Method | Path | Quyền / dữ liệu |
| --- | --- | --- |
| POST | `/discovery/providers/search` | Khách đăng nhập; tìm cả cá nhân và worker tổ chức |
| GET | `/providers/:providerId/members` | Công khai; tối đa 50 member xét theo ID, chỉ dịch vụ đủ chuyên môn |
| GET | `/providers/:providerId/members/:memberId` | Công khai; đúng tổ chức và đủ điều kiện, nếu không trả 404 |
| GET | `/providers/:id/availability` | Khách; query providerServiceId, memberId, customerAddressId, date, limit? |
| POST | `/orders/quote` | Khách; báo giá theo người, dịch vụ, địa chỉ, thời gian |
| POST | `/orders` | Khách; quoteToken và header idempotency-key bắt buộc |
| GET | `/me/provider/memberships/:id/calendar` | Member xem mình hoặc owner xem thành viên của tổ chức |

Danh sách public không phải cam kết lịch trống hoặc online. Response member
gồm `id,displayName,avatarUrl,experienceYears,organization,services[]`.
Mỗi service gồm `providerServiceId,serviceId,name,priceAmount,durationMinutes,
status,categoryId`. Không trả CCCD, giấy tờ, điện thoại, GPS thật hoặc số dư ví.
Muốn đặt phải kiểm tra discovery/availability/quote ở địa chỉ và giờ cụ thể.

Discovery body ví dụ (UUID lấy từ API thật, ngày phải còn trong tương lai):

```json
{
  "serviceId": "41a85643-b755-442e-b2c1-060889ab381c",
  "customerAddressId": "dfeb00bc-9be1-49ca-8c81-86999227901a",
  "bookingType": "SCHEDULED",
  "scheduledAt": "2026-11-01T14:00:00+07:00",
  "radiusKm": 10,
  "limit": 20
}
```

Có thể dùng latitude/longitude thay địa chỉ đã lưu theo ProviderSearchDto;
nếu có customerAddressId thì server ưu tiên địa chỉ đã lưu. `providerId`/`memberId` là bộ lọc tùy chọn khi chọn thợ
trước. Bán kính tìm kiếm của khách và bán kính hiệu lực của worker đều phải
thỏa; hiệu lực worker là min(bán kính riêng, bán kính tổ chức).

Thẻ tổ chức gồm `id=providerId,providerId,memberId,member,organization,
providerType=ORGANIZATION,displayName,avatarUrl,experienceYears,service,
distanceKm,estimatedTravelDistanceKm,estimatedTravelFeeAmount,available,
reason,expectedStartAt,expectedEndAt,suggestedSlots,requiresProviderConfirmation`.
Tên/ảnh thẻ là worker, organization chứa tên/ảnh tổ chức. `member` còn có
experienceYears. Không dùng `id` của thẻ làm providerServiceId.

ASAP cần SQL session hiện hành và heartbeat còn TTL, GPS Redis đúng session/
membershipVersion; online flag lưu trên máy không đủ. SCHEDULED không bắt
worker online: dùng tâm phục vụ tổ chức, lịch tuần/nghỉ và lịch bận của worker.
Kiểm tra ACTIVE, canProvideServices, tài khoản, KYC/chứng chỉ, phân công dịch vụ,
setup, công tắc tổ chức và ví khả dụng. Chứng chỉ phải còn hạn tới cuối công việc.

Kết quả có thể `available=false` kèm tối đa 3 giờ gợi ý. Chỉ enabled CTA đặt
khi available=true; đổi giờ phải quote lại. Hai bộ ứng viên cá nhân/worker
được xét tối đa 300 mỗi bộ (`meta.candidateLimit=600`), trả theo limit khách
yêu cầu; searchLimited cho biết tìm kiếm bị giới hạn, không phải tổng số thợ.
Đọc discovery không giữ lịch. Khoảng cách discovery là đường chim bay, phí ở
thẻ là ước tính; phí chính thức lấy quote (OSRM nếu khả dụng, fallback có nhãn).

Availability hiện yêu cầu địa chỉ đã lưu và date YYYY-MM-DD theo
Asia/Ho_Chi_Minh, limit mặc định 20/tối đa 48; trả memberId và các slot gợi ý.
Địa chỉ nhập tức thời dùng discovery/quote, không tự gán customerAddressId giả.

## 3. Quote → tạo đơn → chờ nhận

```json
{
  "providerServiceId": "6b601aac-663b-4ee2-a23c-c087f7d373d0",
  "memberId": "216a1b81-4061-42be-b08a-3497522fb430",
  "customerAddressId": "dfeb00bc-9be1-49ca-8c81-86999227901a",
  "bookingType": "SCHEDULED",
  "scheduledAt": "2026-11-01T14:00:00+07:00"
}
```

Gửi POST /orders/quote. Response data có provider, memberId/member, tên/giá/
thời lượng dịch vụ, distanceKm/travelDistanceKm/distanceSource, phí di chuyển,
subtotal/discount/total, voucher, expectedStartAt/expectedEndAt, available,
reason, suggestedSlots và quoteToken. Token null khi không available; hiệu
lực 5 phút khi có. Frontend không tính tổng/hoa hồng để gửi làm giá chính thức.

POST /orders giữ nguyên body đã quote, thêm quoteToken và contactName,
contactPhone, customerNote tùy nhu cầu. Header `idempotency-key` dài 8–128 ký
tự chữ/số/gạch dưới/gạch ngang. Retry lỗi mạng cùng nội dung giữ nguyên key;
đổi member/dịch vụ/giờ/địa chỉ/voucher phải quote lại và dùng key mới.

Token gắn user, member+membershipVersion, dịch vụ/nhà cung cấp, địa chỉ, thời
gian và voucher. Server kiểm tra lại giá, lịch, số dư và vị trí khi tạo/nhận.
Request thành công lưu snapshot tên/ảnh tổ chức, worker và user/version của
người thực hiện; user/version nội bộ không lộ qua presenter khách.

201 trả `PENDING_PROVIDER` và providerResponseDeadlineAt. Lúc này chỉ giữ chỗ
chờ đúng worker accept/reject, chưa báo “Đặt lịch thành công”. Theo dõi trạng
thái qua notification/SSE và refetch chi tiết; chỉ chuyển sang tiến trình sau
ACCEPTED. REJECTED/EXPIRED hiển thị lý do và nút tìm người khác.

## 4. Quyền và thực hiện đơn

| Đối tượng | Đọc đơn | Nhận/từ chối, trạng thái, GPS, ảnh, hủy/đổi lịch/add-on |
| --- | --- | --- |
| Khách của đơn | Đơn của mình | API khách hiện có, không gọi API worker |
| Assigned worker | Đơn của mình, cả lịch sử theo snapshot user | Có, đúng version ACTIVE và đúng trạng thái |
| Owner tổ chức | Các đơn thuộc tổ chức | Chỉ khi bản thân là assigned worker; không làm thay |
| Worker khác | Không | Không |
| Internal | Theo API/role vận hành riêng | Không giả làm user của worker |

GET `/me/provider/orders` trả đơn worker được phân công; owner đọc các đơn
của tổ chức. GET `.../:id` ẩn địa chỉ chính xác/điện thoại trước accept.
Các route hiện có giữ nguyên: POST accept/reject/en-route/arrive/start/complete,
cancel, cancellation-request, contact-attempt, reschedule-decision,
payment-dispute và API add-on. Xem Swagger/booking-api.md cho body từng route.

Luồng chính PENDING_PROVIDER → ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS
→ COMPLETED. ARRIVED dùng GPS theo quy tắc hiện có, không bắt ảnh đến nơi;
ảnh BEFORE_SERVICE/AFTER_SERVICE và xác nhận tiền theo contract hiện hành.
POST `/me/provider/orders/:id/evidence/:type` lưu uploadedByUserId nội bộ;
GET ảnh riêng chỉ cho đúng bên tham gia có quyền. Không dùng URL public.

PUT `/me/provider/orders/:id/location` chỉ assigned worker gửi GPS trong
giai đoạn theo dõi. Khách đọc GET `/me/orders/:id/tracking` hoặc SSE events.
Session online nhận đơn mới tách tracking đơn đang làm: offline hoặc công tắc
tổ chức tạm dừng không ngăn hoàn thành đơn đã accept khi worker/tổ chức vẫn
ACTIVE. Suspend member hoặc khóa tài khoản/tổ chức chặn thao tác nghiệp vụ;
báo cáo an toàn vẫn cho đúng participant gửi, hỗ trợ cần can thiệp.

Thông báo yêu cầu đơn/đổi lịch/add-on/hủy/thanh toán gửi đúng worker được chọn
thay vì owner mặc định. Luồng ví/vận hành của owner không cấp cho worker.
Chat tư vấn giữ ở cấp tổ chức. P5E.1 ngày 29/10 đã thêm phòng riêng theo đơn
cho assigned worker; dùng order.conversationId và
[contract chat mới](organization-order-chat-api.md). Review/feed tổng hợp
theo member và handoff khi suspend còn thuộc các bước P5E sau.

## 5. Lịch riêng, cạnh tranh và ví chung

GET `/me/provider/memberships/:id/calendar?from=<ISO>&to=<ISO>` tối đa 31 ngày,
500 khoảng, trả `{startAt,endAt,kind:BUSY|TIME_OFF,estimated}` và meta
memberId/timezone/limit/limited. Không chứa orderId, tên/địa chỉ khách hay ghi
chú nghỉ của người khác. Dùng danh sách đơn có quyền để mở chi tiết.

Hai worker khác nhau nhận được hai đơn cùng giờ. Cùng worker phải trống cả
thời lượng dịch vụ và đệm di chuyển; đổi lịch/add-on cũng xét cùng nguồn lịch,
nghỉ, chứng chỉ còn hạn và đơn thực hiện bị kéo dài. Legacy block chưa gắn
member là nghĩa vụ chung, chặn mọi worker của tổ chức theo application guard.

PostgreSQL có exclusion riêng cho lịch legacy và lịch theo member, trigger
kiểm tra calendar/order cùng người, assignment/snapshot không được sửa.
Transaction khóa provider → user → member → order/wallet theo use case; lịch
được recheck dưới khóa. Giữ khóa ghi ngắn ở cấp tổ chức để bảo vệ legacy/ví
chung, chưa tuyên bố tất cả ghi của worker cùng tổ chức chạy song song.
Không gọi Redis/OSRM/upload trong transaction giữ khóa booking create/accept.
GPS được lấy trước rồi kiểm tra lại session/độ mới bằng SQL dưới khóa.

Ví vẫn một ví tổ chức. Discovery/quote kiểm tra sơ bộ khả dụng; accept giữ
hoa hồng atomically, không cho tổng hold vượt số dư khi nhiều worker accept.
Complete capture đúng một lần; lưu cashCollectedByUserId/cashCollectedAt, số
tiền nằm trong snapshot order. Worker thu tiền hộ, không nhận số dư ví hoặc
quyền rút/nạp/thay giá. Báo cáo tiền thu hộ/đối soát theo worker chưa có ở P5C.

Rời tổ chức, sửa phân công/lịch, thêm nghỉ hoặc mở lại KYC kiểm tra nghĩa vụ
assigned member cộng legacy chung; không bị chặn bởi riêng đơn worker khác.
Rejoin tăng version: không hồi sinh quyền thực hiện đơn của version trước.

## 6. Rematch

GET `/me/orders/:id/rematch-candidates` trả orderDraft và candidates. Đã thử
worker A chỉ loại cặp tổ chức:A, vẫn đề xuất được B cùng tổ chức. Đơn cá nhân
giữ loại theo provider. Không chuyển assigned member trên đơn cũ.

Chọn candidate → POST /orders/quote với providerServiceId mới, memberId mới,
bookingType/scheduledAt và **đúng orderDraft.inlineAddress**. Không thay bằng
customerAddressId dù cùng địa chỉ: token bind cách biểu diễn và snapshot.
POST `/me/orders/:id/retry` body providerServiceId, memberId, quoteToken và
idempotency-key mới. Server dùng snapshot liên hệ/ghi chú của source, tạo đơn
mới cùng bookingGroup, vẫn PENDING_PROVIDER chờ người mới nhận.

## 7. Lỗi và cách xử lý UI

- 400: UUID/body, thiếu member cho tổ chức, gắn member cho cá nhân, tự đặt,
  thời gian/địa chỉ sai. Sửa input; không tự chuyển worker ngầm.
- 401: token thiếu/hết hạn; refresh theo auth contract rồi gửi lại an toàn.
- 403/404: không có quyền hoặc đối tượng không thuộc phạm vi; không dò ID khác.
- 409: lịch, giá, version/session, ví hoặc trạng thái đã thay đổi; hiển thị
  message, refetch và quote lại. Không giữ nút xác nhận với token cũ.
- 503: dịch vụ phụ thuộc không khả dụng; giữ form, báo có thể thử lại. Không
  dựng GPS/availability giả để vượt qua.

## 8. Migration, kiểm thử và rollback

Migration `20261028120000_member_booking` bổ sung field nullable, index,
constraint và trigger. Không tự gán member cho đơn cũ, không sửa số dư, không
tạo user/KYC/GPS giả. Schema validate đạt; diff test DB không có sai lệch field/
index/FK P5C. Diff toàn schema còn tên FK/index/default cũ ngoài batch, không
tự chạy SQL đổi chúng như một phần P5C.

Kiểm thử: 739 unit toàn backend; 20 HTTP integration mới qua AppModule với
PostgreSQL + Redis DB 15; 34 booking cá nhân; 21 membership + 23 KYC + 31 năng
lực (chạy riêng từng suite); 8 E2E đăng ký đối tác. Rehearsal migration kiểm
tra legacy, hai worker cùng giờ, overlap, immutable assignment và consistency.
Các kiểm thử không thay load test production. Chạy gộp ba suite member trên
Node 24 Windows đã gặp tiến trình native dừng; từng suite riêng đều đạt.
Đã đối chiếu trên Node 22 Linux trong Docker: **75/75 chạy gộp đạt**. Runner
Docker dùng TEST_DATABASE_URL tới DB test và TEST_REDIS_URL=redis://redis:6379/15;
không dùng Redis DB 0 hoặc lambe_db cho test.

Docker local đã áp migration P5C, backend healthy, health/Swagger HTTP 200.
Swagger có 298 HTTP operation, gồm đủ hai route public member và member calendar.
Calendar thiếu JWT trả 401. Đối soát giữ nguyên 8 user, 1 provider, 1 wallet,
1 member, 19 order; không có assigned order tự phát sinh hoặc seed vào dữ liệu
ứng dụng. Migration rehearsal không đồng nghĩa đã diễn tập rollback image.

Không rollback thẳng về image P5B khi còn đơn assigned: image cũ không hiểu
quyền worker và có thể cho owner thao tác sai. Phải xử lý hết nghĩa vụ đơn/
hold/tranh chấp bằng bản hiểu member, khóa luồng tổ chức ở mức mà image cũ
hiểu (không chỉ công tắc member-receiving), rồi mới đánh giá rollback. Giữ
schema/snapshot lịch sử, không drop cột để ép image cũ chạy. Local image P5B
trước nâng cấp: b4217bb3ec1ab974c15b71c7183b6e96c8ff98f0f9f2564cf263bb371689db1c.
Đây là runbook hạn chế rollback; chưa diễn tập rollback image end-to-end,
ORG-025 vẫn mở. [Báo cáo tài chính P5D](organization-finance-api.md) đã bổ sung
ngày 29/10/2026; P5E chat/review/feed/handoff còn mở.
