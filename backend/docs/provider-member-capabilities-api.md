# Năng lực thực hiện của thành viên tổ chức — P5B

Cập nhật 28/10/2026. Base URL `/api`; dùng **User Access Token** của Lambe.
Swagger: `Provider Member Capabilities`, `Provider Member Availability`.
22 HTTP operation mới. KYC dùng [contract P5A.2](provider-member-verification-api.md).

## Phạm vi và giới hạn chuyển tiếp

Đã có cấp/thu hồi dịch vụ theo member, lịch tuần, lịch nghỉ, bán kính riêng,
online/heartbeat/GPS và công tắc nhận đơn chung của tổ chức. Không tạo ví hay
giá riêng cho worker. Không tự gán dịch vụ khi duyệt KYC: owner phải cấp quyền.

**P5C đã nối Discovery, quote và đơn vào từng member.** Xem
[Organization Booking API](organization-booking-api.md): capacity theo worker,
quote gắn version, chỉ người được chọn nhận/từ chối/thực hiện đơn. Đơn legacy
không gắn member vẫn giữ lịch chung và quyền provider cũ.
Các API provider cá nhân cũ tiếp tục sử dụng contract hiện có; không thay bằng
API member và không backfill KYC/dịch vụ/GPS giả cho owner.

Thay danh sách dịch vụ/lịch tuần hoặc thêm lịch nghỉ bị chặn nếu member còn
đơn mở, calendar tương lai, hold, tranh chấp/sự cố hoặc yêu cầu hủy chưa xong.
Đơn có assigned member khác không chặn thay đổi của mình. Nghĩa vụ legacy
chưa phân công vẫn được kiểm tra bảo thủ ở cấp tổ chức.
Tắt nhận đơn/online không tự hủy đơn cũ. Hủy lịch nghỉ không tự bật online.

## Định danh và quyền

`memberId` lấy từ `GET /api/me/provider/memberships` hoặc danh sách thành viên
của owner. Không dùng userId/providerId để thay cho memberId. Chỉ áp dụng với
`providerType=ORGANIZATION`. JWT xác định actor; không nhận actor/role từ body.

| API | Quyền |
| --- | --- |
| Cấp/thu hồi dịch vụ, service-options, công tắc chung | Owner ACTIVE của đúng tổ chức |
| Xem/sửa lịch tuần, xem/thêm/hủy lịch nghỉ | Bản thân hoặc owner đúng tổ chức |
| Online, heartbeat, offline, xem availability, cấu hình bán kính | Chỉ chính member đó, kể cả owner cũng không làm thay người khác |

Owner sửa lịch/nghỉ phép cho người khác bắt buộc `reason` từ 5–300 ký tự, có
audit actor/reason. Bản thân có thể không gửi reason. Tài khoản khác không được
xem lịch/GPS/KYC của worker. Không trả số dư ví tổ chức cho worker; chỉ có
blockerCode. Việc owner tự làm dịch vụ vẫn cần KYC của chính owner và các bước
cấp dịch vụ/lịch như worker. Membership LEFT không dùng được API này.

## Danh sách API

Viết tắt `M=/api/me/provider/memberships/:memberId`,
`O=/api/me/provider/members/:memberId`. Các cặp đường dẫn lịch/dịch vụ đi qua
cùng use case và cùng kiểm tra quyền, không phải hai bản dữ liệu khác nhau.

| Method | Đường dẫn | Mục đích |
| --- | --- | --- |
| GET | `O/service-options` | Owner xem các dịch vụ member đã đề nghị xác minh, kèm khả năng cấp |
| GET | `M/services` | Member xem các dịch vụ được cấp/đã thu hồi trong lần gia nhập này |
| GET | `O/services` | Owner xem cùng danh sách của member |
| PUT | `O/services` | Owner thay toàn bộ danh sách dịch vụ được cấp |
| GET | `M/working-hours` | Member xem lịch tuần |
| GET | `O/working-hours` | Owner xem lịch tuần của member |
| PUT | `M/working-hours` | Member thay lịch tuần |
| PUT | `O/working-hours` | Owner thay lịch tuần, cần reason nếu sửa người khác |
| GET | `M/time-offs` | Member xem lịch nghỉ |
| GET | `O/time-offs` | Owner xem lịch nghỉ của member |
| POST | `M/time-offs` | Member thêm lịch nghỉ |
| POST | `O/time-offs` | Owner thêm lịch nghỉ cho member |
| DELETE | `M/time-offs/:timeOffId` | Member hủy lịch nghỉ, không hard delete |
| DELETE | `O/time-offs/:timeOffId` | Owner hủy lịch nghỉ, cần reason nếu sửa người khác |
| GET | `M/receiving-settings` | Bán kính riêng, bán kính tổ chức và hiệu lực |
| PUT | `M/receiving-settings` | Cấu hình bán kính riêng |
| GET | `M/availability` | Online, phiên hiện hành và điều kiện nền |
| POST | `M/availability/online` | Bắt đầu phiên bằng GPS mới |
| POST | `M/availability/heartbeat` | Cập nhật GPS đúng phiên, không hồi sinh phiên hết hạn |
| POST | `M/availability/offline` | Kết thúc đúng phiên |
| GET | `/api/me/provider/member-receiving` | Owner xem công tắc nhận đơn chung qua member |
| PUT | `/api/me/provider/member-receiving` | Owner tạm dừng/mở lại nhận đơn qua member |

Response dùng envelope `{statusCode,success,data,timestamp}`; lịch tuần có
`meta.timeZone="Asia/Ho_Chi_Minh"`. POST thêm nghỉ trả 201; thao tác khác trả 200.

## Dịch vụ được cấp

PUT `O/services`:

```json
{
  "providerServiceIds": ["b476f4b1-1781-4006-a8ca-b5fd06877736"],
  "reason": "Phân công theo chuyên môn đã được duyệt."
}
```

Danh sách là ProviderService ID của tổ chức, tối đa 50, UUID v4, không trùng.
Không gửi serviceId danh mục chung; không gửi priceAmount, memberId hay quyền
trong body. `[]` thu hồi toàn bộ. Update nguyên tử, giữ record thu hồi với
enabled=false. Đổi danh sách kết thúc phiên online; worker phải bật lại.

Trước khi cấp, backend kiểm tra member ACTIVE/canProvideServices, KYC APPROVED
đúng membershipVersion, dịch vụ từng được khai trong KYC, offering/service/
category ACTIVE, giá nằm trong khung, kinh nghiệm, chứng chỉ còn hạn và đủ
portfolio đã được duyệt. Worker không tự cấp quyền và không sửa giá tổ chức.
Database cũng chặn gán dịch vụ của tổ chức khác.

GET services trả tối đa 100 record, enabled trước, gồm:
`providerServiceId,serviceId,name,priceAmount,durationMinutes,status,categoryId,
enabled,eligible,blockerCode`. `eligible` ở đây là tư cách member/chuyên môn
của dịch vụ, **không phải** kết luận đủ điều kiện cho một đơn cụ thể; cần thêm
availability, khoảng cách, lịch đặt và điều kiện tài chính trong P5C.
GET service-options trả các trường dịch vụ/eligible/blockerCode tương tự,
không có enabled và không trả chứng chỉ/CCCD. Chỉ liệt kê dịch vụ đã được đề
nghị xác minh trong hồ sơ hiện hành; cần mở lại KYC nếu muốn bổ sung chuyên môn.

Không cần cron đổi cờ assignment khi chứng chỉ hết hạn. Điều kiện được kiểm
tra lại ở list, cấp quyền, online, heartbeat và status: dịch vụ mất chứng chỉ
trở thành eligible=false. Một chứng chỉ hết hạn không chặn dịch vụ khác vẫn
đủ điều kiện. Mở lại cả hồ sơ KYC thì toàn bộ năng lực bị chặn tới khi duyệt lại.

## Lịch tuần và lịch nghỉ

PUT working-hours:

```json
{
  "workingHours": [
    {"dayOfWeek": 1, "startMinute": 480, "endMinute": 720},
    {"dayOfWeek": 1, "startMinute": 780, "endMinute": 1200}
  ],
  "reason": "Thay đổi ca theo đề nghị của thành viên."
}
```

0=Chủ nhật, 1=Thứ hai,…6=Thứ bảy; giờ Việt Nam, không phụ thuộc timezone thiết
bị. Tối đa 21 ca, 0 ≤ startMinute < endMinute ≤ 1440. Các ca sát nhau được
phép; chồng ca bị chặn ở application và exclusion constraint PostgreSQL.
Ca qua đêm tách hai ngày. `[]` là không có ca nào, không thể online. Thay lịch
kết thúc phiên online. Online ngoài ca hiện tại bị chặn.

POST time-offs: `{startAt,endAt,reason?}`; ISO 8601 có `Z`/offset, endAt sau
startAt, bắt đầu trong tương lai và không quá 366 ngày tới, tối đa 90 ngày/lần.
Tối đa 100 khoảng nghỉ chưa kết thúc. Không cho hai khoảng nghỉ chưa hủy chồng
nhau; thời điểm endAt không thuộc khoảng nghỉ `[startAt,endAt)`.

GET time-offs nhận `from,to,page,limit`; mặc định from=hiện tại, to=from+90
ngày, cửa sổ tối đa 366 ngày, page 1–1000, limit 1–50 (mặc định 20).
Trả các khoảng chưa hủy giao với cửa sổ: `id,startAt,endAt,reason`.
DELETE nhận JSON `{reason?}`, soft-cancel bằng cancelledAt, lặp lại an toàn.
Không gửi giấy tờ hay lý do sức khỏe nhạy cảm vào ghi chú nghỉ phép.

## Bán kính và online

PUT receiving-settings: `{receivingRadiusKm:5}`; số nguyên 1–50 km, không vượt
bán kính tổ chức tại lúc lưu. Nếu chưa cấu hình riêng, dùng bán kính tổ chức.
Effective luôn là min(riêng hoặc tổ chức, tổ chức), kể cả khi tổ chức giảm bán
kính sau đó. Thay đổi kết thúc phiên online, cần lấy GPS mới và bật lại.

POST online:

```json
{
  "latitude": 21.0285,
  "longitude": 105.8542,
  "capturedAt": "2026-10-28T08:00:00.000Z"
}
```

capturedAt phải là **thời điểm GPS thật** của thiết bị: không quá 60 giây cũ
hoặc 15 giây trong tương lai, có timezone. Không dùng tọa độ mặc định/fallback
để giả online. Latitude/longitude được validate; `session.id` lấy từ response.

Điều kiện: member ACTIVE và canProvideServices; user và tài khoản chủ tổ chức
ACTIVE, SĐT member đã xác minh; tổ chức ACTIVE, không tạm dừng, setup đầy đủ;
ít nhất một dịch vụ được cấp còn hợp lệ; có ca hiện tại và không nghỉ; tổ chức
không có SAFETY_HOLD; ví khả dụng `balanceAmount-heldAmount` ≥ ngưỡng cấu hình
(mặc định **50.000đ**). Không tạo/giữ/trừ tiền trong thao tác online.

POST heartbeat: cùng GPS/capturedAt và thêm `{sessionId}`. GPS phải mới hơn
lần đã lưu; sai phiên/GPS cũ trả 409. TTL dùng `PROVIDER_LOCATION_TTL_SECONDS`,
mặc định 120 giây; ứng dụng nên cập nhật khoảng 30 giây, theo khuyến nghị status.
Hết TTL thì offline về mặt nhận đơn ngay; cron mỗi phút đóng record hết hạn
theo batch tối đa 500 với SKIP LOCKED. Không cần đợi cron để ẩn thợ.
Phiên hết hạn không thể heartbeat hồi sinh; phải có thao tác online mới.

GET availability trả:

```json
{
  "online": true,
  "session": {"id":"41a85643-b755-442e-b2c1-060889ab381c","startedAt":"2026-10-28T08:00:00.000Z","lastHeartbeatAt":"2026-10-28T08:01:00.000Z"},
  "heartbeatTtlSeconds": 120,
  "recommendedHeartbeatSeconds": 30,
  "effectiveRadiusKm": 5,
  "receivingEligibility": {"eligible":true,"blockerCode":null},
  "locationAvailable": true
}
```

online chỉ true khi DB session chưa kết thúc, heartbeat còn hạn, đủ điều kiện
và đúng session GPS Redis còn hiệu lực. Không trả tọa độ vào response này.
Nếu chưa online/hết hạn thì session=null. Redis lỗi khi đọc trả online=false,
locationAvailable=false; khi bật/heartbeat lỗi thì 503, không giả thành công.
Offline body `{sessionId}`; DB vẫn đóng phiên nếu Redis lỗi. Request tắt phiên
cũ không được tắt phiên mới; offline không hủy đơn đã nhận.

Thoát app không đảm bảo gửi được offline. Khi OS dừng GPS/heartbeat thì hết TTL
backend coi offline. Chạy nền/GPS permissions cần mobile xử lý ở bước tích hợp,
không coi đóng màn hình là cam kết offline tức thì. Không tự bật lại khi mở app.

Các blockerCode: `ACCOUNT_UNAVAILABLE`, `MEMBER_NOT_ACTIVE`,
`ORGANIZATION_NOT_ACTIVE`, `ORGANIZATION_PAUSED`, `ORGANIZATION_SETUP_REQUIRED`,
`ORGANIZATION_WALLET_BALANCE_TOO_LOW`, `MEMBER_KYC_REQUIRED`,
`NO_QUALIFIED_MEMBER_SERVICE`, `MEMBER_WORKING_HOURS_REQUIRED`,
`OUTSIDE_WORKING_HOURS`, `MEMBER_TIME_OFF`, `ORGANIZATION_SAFETY_HOLD`.
Lỗi phiên: `MEMBER_SESSION_CHANGED`, `MEMBER_SESSION_EXPIRED`, `STALE_GPS`.
Đọc code từ root error object; không suy luận mọi 409 đều do thiếu tiền.

## Công tắc tổ chức, lưu trữ và tính đồng thời

PUT `/api/me/provider/member-receiving` với `{enabled:false,reason:"Tạm nghỉ toàn tổ chức."}`.
Owner bật lại bằng enabled=true, không tự phục hồi phiên/GPS của worker.
Đây là công tắc cho **luồng member**; không dùng nút online cá nhân của owner
hoặc endpoint provider cũ để điều khiển nhân viên. Không chuyển đổi luồng cũ
sang nhiều worker chỉ bằng công tắc này.

DB trigger đóng session khi member bị khóa/rời/mở lại KYC, đổi lần gia nhập,
khóa tổ chức hoặc tài khoản member/chủ tổ chức. Membership version mới không
thừa hưởng dịch vụ/lịch/phiên/bán kính cũ; lịch sử KYC/thu hồi được giữ.

Redis có namespace `lambe:members:online:*`, dùng memberId và session/version,
không chứa CCCD, SĐT. Không trộn với GEO provider cũ. Phiên SQL là nguồn chân lý;
Redis là chỉ mục vị trí, có thể còn entry cũ tới TTL. Discovery P5C kiểm
tra cả SQL + heartbeat + tư cách dịch vụ, không đọc GEO rồi nhận đơn trực tiếp.

Heartbeat dùng provider/user shared lock rồi member row lock; các worker khác
nhau có thể tiến song song. SQL transaction không chứa network call Redis.
Lua so version/session/capturedAt ngăn ghi đè GPS mới bằng request cũ;
compensation khi Redis lỗi chỉ được đóng chính phiên lỗi, không đóng phiên
kết nối lại sau đó. Các ghi owner và KYC vẫn khóa provider trước user/member.

## Cấu hình, kiểm thử và rollback

Không thêm SDK hay biến bí mật mới. Tái sử dụng REDIS_ENABLED/REDIS_URL,
PROVIDER_LOCATION_TTL_SECONDS, PROVIDER_MIN_RECEIVING_BALANCE và KYC hiện có.

Hai migration bổ sung:
`20261028100000_provider_member_capabilities`,
`20261028103000_provider_member_receiving_control`.
Không đổi/xóa bảng provider/order/wallet cũ; không tự đưa nhân viên online.
Rollback ứng dụng về image trước P5B và giữ nguyên bảng/lịch sử, không drop
bảng trên dữ liệu thật. Khi chuẩn bị P5C cần diễn tập rollback booking riêng.

Kiểm thử tích hợp trong `test/provider-member-capabilities.integration-spec.ts`
dùng database `lambe_booking_test_*` riêng và Redis database **15**, không
FLUSHDB/FLUSHALL, không upload ảnh thật hoặc gửi SMS/email thật. Bao gồm BOLA,
quyền owner/worker, chứng chỉ, giá/danh mục, ca/nghỉ chồng, số dư, phiên cũ,
Redis lỗi, request đến trễ, nhiều worker online và trigger đình chỉ. Kiểm thử
chức năng/đồng thời này không thay thế load test Discovery/booking ở P5C/P5F.
