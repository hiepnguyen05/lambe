# AI chatbot tư vấn làm đẹp

> Cập nhật 30/10/2026. Contract dưới đây đối chiếu code đợt chat/AI; kết quả
> kiểm thử và cách chạy nằm ở [hướng dẫn kiểm chứng](chat-ai-verification.md).

Backend hiện có module tư vấn riêng với chat khách-thợ. Chatbot dùng Gemini để tư vấn phong cách bằng tiếng Việt và chỉ trả lời trong phạm vi làm đẹp. Sau khi đã đưa ra tư vấn có giá trị, backend có thể đối chiếu dịch vụ ACTIVE và hiển thị một lời mời tìm chuyên viên. Provider discovery chỉ chạy khi khách chủ động yêu cầu hoặc đồng ý với lời mời đó. Giá cuối cùng phải qua `/api/orders/quote`; yêu cầu đặt đơn phải qua `/api/orders` và chờ thợ chấp nhận.

## P6 — Ý nghĩa metrics và tích hợp frontend (31/10/2026)

P6 bổ sung quan sát vận hành, giữ nguyên API, mã lỗi và luồng tư vấn/đặt đơn.

- `events.ai.intent` tăng theo `result.intent` của phản hồi mới sau khi
  transaction lưu assistant/result commit: `CONSULTATION`, `PROVIDER_SEARCH`,
  `PRICE_INQUIRY`, `OUT_OF_SCOPE`. Đây là phân loại kết quả backend, không
  phải số lần gọi Gemini; fallback hoặc nhánh không gọi model vẫn có thể tính.
- `events.ai.cta.offered` tăng một lần cho phản hồi mới có `nextActions`
  không rỗng, sau commit; không đếm từng nút, không chứng minh UI đã hiển thị
  và không chỉ đếm lời mời `OFFER_PROVIDER_SEARCH`. Replay tin đã có kết quả
  hoặc refresh gợi ý không tăng lại intent/offered.
- `events.ai.cta.selected` tăng sau khi action/target còn hợp lệ của đúng
  hội thoại được lưu thành `AiActionEvent`. Mỗi POST hợp lệ có thể thêm sự
  kiện, kể cả gửi lại; không suy thành số khách duy nhất hoặc đã tạo quote/đơn.
  Chưa có attribution AI → booking, nên không tính tỷ lệ chuyển đổi từ bộ đếm.
- Frontend tiếp tục render theo `nextAction`/`nextActions`, kiểm tra lại card
  trước thao tác và quote trước đặt. Lỗi ghi nhận action không chặn điều hướng
  đã xác minh; timeout gửi tin giữ cùng `clientMessageId` và text khi retry.
  Redis throttling hỏng có thể trả 503; fallback Gemini không vượt bảo vệ này.
- Counters chỉ thuộc tiến trình từ lúc khởi động, không chứa prompt/PII,
  ID người dùng, tọa độ hay token; không cho biết quota model hoặc độ trễ Gemini.
  Log lỗi Gemini chỉ ghi event, requestId và lý do HTTP đã giới hạn hoặc
  `request failed`, không in body lỗi/credential. Các mẫu độ trễ cũ là lịch sử.

Xem [Observability API](observability-api.md), [runbook P6](quality-operations-runbook.md)
và [bằng chứng kiểm chứng P6](quality-verification-2026-10-30.md); kết quả QA
theo môi trường/lần chạy không phải SLA hoặc bảo đảm model luôn đáp ứng.

## Cấu hình

`GEMINI_ENABLED=true`, `GEMINI_API_KEY` và `GEMINI_MODEL` được cấu hình cho container backend. Khóa không gửi cho mobile/web. Khi tắt hoặc Gemini không đáp ứng, API trả `degradedMode=true` và câu trả lời dự phòng. Bật `GEMINI_WEB_SEARCH_ENABLED=true` và `GEMINI_SEARCH_MODEL=gemini-3.8-flash` để cho phép tìm web khi khách hỏi xu hướng mới. Chỉ trả thông tin web khi Gemini cung cấp nguồn; `citations` là danh sách nguồn HTTPS. Search có thể phát sinh chi phí riêng.

Áp dụng các migration AI, gồm `20261113090000_ai_message_feedback`, trước khi gọi API đánh giá. Migration đánh giá chỉ thêm bảng riêng, không đổi dữ liệu tài khoản, ví hay đơn hàng.

## API (Bearer user token)

| Method | Path | Ý nghĩa |
| --- | --- | --- |
| POST | `/api/me/ai-conversations` | Tạo phiên |
| GET | `/api/me/ai-conversations` | 30 phiên gần nhất |
| GET | `/api/me/ai-conversations/:id/messages` | 50 tin gần nhất |
| GET | `/api/me/ai-conversations/:id/messages/:clientMessageId/recommendations` | Kiểm tra lại card trước khi thao tác |
| POST | `/api/me/ai-conversations/:id/messages` | Gửi câu hỏi, nhận tư vấn |
| POST | `/api/me/ai-conversations/:id/messages/:clientMessageId/feedback` | Đánh giá câu trả lời của mình |
| POST | `/api/me/ai-conversations/:id/actions` | Ghi nhận một gợi ý đã được khách chọn |
| DELETE | `/api/me/ai-conversations/:id` | Xóa phiên và các tin nhắn |

Đánh giá câu trả lời: gửi `{ "helpful": false, "reason": "NOT_RELEVANT" }`.
`reason` có thể là `NOT_RELEVANT`, `INCORRECT`, `UNSAFE` hoặc `OTHER`;
có thể bỏ qua khi đánh giá tích cực. Gửi lại sẽ thay đánh giá trước đó.
Chỉ chủ hội thoại được đánh giá tin nhắn đã có kết quả. Xóa hội thoại cũng
xóa đánh giá. `GET .../:id/messages` trả thêm `feedback` cho từng tin nhắn
(hoặc `null` nếu chưa đánh giá).

Request gửi tin:

```json
{
  "clientMessageId": "11111111-1111-4111-8111-111111111111",
  "text": "Mặt tròn tóc dày, kiểu nào hợp đi date?"
}
```

`clientMessageId` là UUID tạo một lần cho mỗi ý định gửi, dùng lại khi retry. Có thể gửi `customerAddressId` hoặc cặp `latitude`/`longitude` khi khách **đã yêu cầu tìm thợ**; `bookingType` là `ASAP` hoặc `SCHEDULED`, loại sau cần `scheduledAt` có múi giờ. Nếu không truyền vị trí, backend tìm địa chỉ mặc định thuộc đúng tài khoản hiện tại. Nếu chưa có thời gian, backend trả `REQUEST_BOOKING_TIME` và chưa chạy Discovery. Không gửi địa chỉ để hỏi tư vấn thông thường.

| Field gửi tin | Kiểu / ràng buộc | Cách sử dụng |
| --- | --- | --- |
| text | String 1–1.000 ký tự; backend trim và từ chối text rỗng | Nội dung người dùng thực sự nhập/chọn gửi |
| clientMessageId | UUID4, bắt buộc | Giữ lại khi retry cùng tin; ý định gửi mới tạo ID mới |
| customerAddressId | UUID4 tùy chọn | ID địa chỉ của chính khách, dùng cho tìm thợ |
| latitude / longitude | Cặp tọa độ hợp lệ | JSON number; gửi đủ cặp khi dùng GPS, ưu tiên chọn một nguồn địa chỉ hoặc GPS |
| bookingType | ASAP hoặc SCHEDULED, tùy chọn | Chỉ gửi khi khách đã chọn loại lịch |
| scheduledAt | ISO datetime có Z hoặc offset | Bắt buộc cho SCHEDULED; không dùng với ASAP |

API tư vấn không tự giữ GPS hoặc địa chỉ từ lượt trước để đặt đơn. Khi tiếp
tục bước chọn giờ bằng GPS, client gửi lại cặp tọa độ đã được khách cho phép;
hoặc dùng địa chỉ mặc định/ID địa chỉ còn thuộc khách. Không nhét vị trí vào
text để model đoán. Quy tắc thời gian đặt áp dụng khi gọi Discovery; lịch sai
nghiệp vụ có thể dẫn đến gợi ý không có thợ, khác lỗi định dạng DTO.

Response chuẩn `data`:

```json
{
  "clientMessageId": "11111111-1111-4111-8111-111111111111",
  "reply": "Với mặt tròn, bạn có thể thử Side Part 6/4...",
  "intent": "CONSULTATION",
  "suggestedServices": [],
  "suggestedProviders": [],
  "suggestedPosts": [],
  "nextActions": [],
  "followUpQuestion": "Tóc mái hiện dài khoảng bao nhiêu?",
  "conversionPrompt": null,
  "nextAction": "CONTINUE_CONSULTATION",
  "degradedMode": false,
  "citations": []
}
```

`nextAction` có thể là `CONTINUE_CONSULTATION`, `OFFER_PROVIDER_SEARCH`, `REQUEST_LOCATION`, `REQUEST_BOOKING_TIME`, `SHOW_PROVIDERS`:

- `OFFER_PROVIDER_SEARCH`: hiển thị `conversionPrompt` và nút tìm chuyên viên. Đây là lời mời sau tư vấn, không phải đơn hàng.
- `REQUEST_LOCATION`: hiển thị nút dùng vị trí hiện tại hoặc luồng chọn địa chỉ; không gửi lại `followUpQuestion` như tin nhắn của khách.
- `REQUEST_BOOKING_TIME`: cho chọn làm ngay hoặc đặt trước; gửi một tin mới cùng `bookingType`, `scheduledAt` nếu cần và vị trí đã chọn. Lịch đặt trước phải cách hiện tại ít nhất 60 phút và tối đa 30 ngày. Nếu không có thợ phù hợp, trạng thái này cũng cho phép thử giờ khác.
- `SHOW_PROVIDERS`: hiển thị danh sách chuyên viên từ discovery.

`followUpQuestion` là câu hỏi cá nhân hóa để khách trả lời bằng nội dung của họ, không phải một quick reply gửi lại nguyên câu hỏi. `suggestedProviders` dùng response hiện có của discovery, gồm `service.id` là ID `ProviderService` để mobile mở quote; các trường như tên dịch vụ, kinh nghiệm, khoảng cách, trạng thái rảnh, giá và phí di chuyển dự kiến phải lấy nguyên từ API, không tự tạo rating/huy hiệu trên client. Danh sách tìm kiếm chỉ là gợi ý tức thời, không giữ lịch. Khi không tìm được service hoặc provider, mobile vẫn hiển thị lời giải thích và cho khách điều chỉnh yêu cầu.

Backend tách câu hỏi ra khỏi `reply`, loại bản hỏi lặp và chỉ giữ một `followUpQuestion` mỗi lượt. Client hiển thị câu hỏi một lần sau nội dung tư vấn.

`intent=OUT_OF_SCOPE` dùng cho câu hỏi ngoài làm đẹp. Backend không chuyển nội dung tư vấn ngoài phạm vi từ mô hình xuống client mà trả lời từ chối cố định và hướng người dùng về tóc, makeup, nail, massage hoặc chăm sóc da.

## Ảnh mẫu và hành động có cấu trúc

`suggestedServices` có thêm `slug` để mở chi tiết dịch vụ. `suggestedPosts` có tối đa 6 phần tử:

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "provider": { "id": "33333333-3333-4333-8333-333333333333", "displayName": "Chuyên viên tóc", "avatarUrl": null },
  "service": { "id": "44444444-4444-4444-8444-444444444444", "name": "Cắt tóc nam" },
  "mediaKind": "IMAGE",
  "thumbnailUrl": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  "mediaUrl": "https://res.cloudinary.com/demo/image/upload/sample.jpg"
}
```

Nguồn duy nhất là `FeedPost` đang `PUBLISHED`, của provider `ACTIVE`, gắn với `ProviderService`, dịch vụ và danh mục đang `ACTIVE`. Mỗi card dùng media đầu tiên theo `position`; video trả `mediaKind=VIDEO`, `thumbnailUrl=null`. Không có bài phù hợp thì trả `[]`. Không đọc ảnh từ chat, KYC hoặc bằng chứng đơn hàng; không tìm ảnh trên web. Trước khi xem chi tiết, gọi lại `GET /api/feed/posts/:id` để kiểm tra bài còn công khai.

`nextActions` là danh sách `{type,label,targetId?}`. ID đều do backend lấy từ dữ liệu Lambe:

| type | targetId | UI thực hiện |
| --- | --- | --- |
| `VIEW_INSPIRATION` | FeedPost ID | Mở chi tiết bài đăng công khai |
| `VIEW_SERVICE` | Service ID | Mở dịch vụ bằng `suggestedServices[].slug` |
| `SELECT_ADDRESS` | Không có | Chọn địa chỉ mặc định hoặc GPS có sự đồng ý |
| `SELECT_BOOKING_TIME` | Không có | Chọn ASAP/SCHEDULED |
| `FIND_PROVIDER` | Service ID | Xem danh sách thợ đã tìm bằng Discovery |
| `CREATE_QUOTE` | Không có | Chọn thợ/dịch vụ rồi đi qua API báo giá chuẩn |

`FIND_PROVIDER` chỉ xuất hiện sau yêu cầu hoặc sự đồng ý của khách, khi đã có vị trí và thời gian. Lời mời `OFFER_PROVIDER_SEARCH` hiển thị sau câu tư vấn và được ẩn khi đang có câu hỏi cá nhân hóa. API chatbot không tạo đơn và không giữ chỗ.

## Ghi nhận lượt chọn

```http
POST /api/me/ai-conversations/:id/actions
```

```json
{
  "clientMessageId": "11111111-1111-4111-8111-111111111111",
  "type": "VIEW_INSPIRATION",
  "targetId": "22222222-2222-4222-8222-222222222222"
}
```

Trả `data: {"recorded":true}`. Backend kiểm tra hội thoại thuộc người gọi và action/target đã có trong phản hồi tương ứng; action tự tạo trả 400, hội thoại người khác trả 404. Giới hạn 30 request/phút. Sự kiện chỉ lưu user ID, message ID, action, target ID và thời gian; không lưu prompt, tọa độ, địa chỉ hoặc token. Đây là số lần bấm, không phải số khách duy nhất hay bằng chứng đã đặt đơn. Khi xóa hội thoại, các sự kiện liên quan được xóa theo. Lỗi đo lường không chặn điều hướng mobile.

Kết quả có cấu trúc được lưu cùng tin nhắn assistant để màn lịch sử khôi phục card. Dữ liệu gợi ý là snapshot; màn chi tiết và API quote phải kiểm tra trạng thái hiện tại trước khi đặt đơn.

Tin nhắn giới hạn 1.000 ký tự, tối đa 20 request/phút cho endpoint gửi và 50 tin/ngày theo tài khoản. User chỉ xem/xóa hội thoại của chính mình. Một `clientMessageId` dùng với nội dung khác trả 409; yêu cầu trước đang xử lý cũng trả 409.

Giới hạn ngày tính theo ngày UTC. Lượt hoàn tất được ghi riêng, không chứa nội dung trò chuyện, nên xóa hội thoại không đặt lại hạn mức. Lượt lỗi không bị tính; client gửi lại cùng `clientMessageId` và text. Nếu tiến trình dừng giữa chừng, yêu cầu đang xử lý được nhận lại sau 5 phút. Một yêu cầu cũ hoàn tất sau thời hạn đó không thể ghi đè kết quả của lần thử lại.

## Cập nhật chat/AI ngày 30/10/2026

### Kiểm tra lại gợi ý và giá hiện tại

```http
GET /api/me/ai-conversations/:id/messages/:clientMessageId/recommendations
Authorization: Bearer <User Access Token>
```

Hai ID đều UUID4. clientMessageId là mã tin user đã nhận phản hồi, không phải
ID bản ghi assistant. Response 200 dùng envelope chuẩn, data cùng schema gửi
tin, bổ sung suggestionsExpired boolean. True nghĩa ít nhất một card bị
loại/cập nhật, kể cả đổi giá/tên; không đồng nghĩa mọi card bị khóa.

Backend đọc lại catalog/category ACTIVE, provider/profile/user ACTIVE,
ProviderService ACTIVE và cổng public Feed. Cập nhật tên/slug, khung giá, giá/
thời lượng ProviderService. Bài bị gỡ/ẩn hoặc mất liên kết dịch vụ phù hợp bị
loại. nextActions chỉ giữ target còn hợp lệ. Không còn dịch vụ thì bỏ lời mời
và chuyển CONTINUE_CONSULTATION; SHOW_PROVIDERS mất hết thợ thì chọn lại giờ.

Không gọi Gemini/Discovery, giữ lịch hoặc tạo order. GPS/khoảng cách/available
vẫn là snapshot lần tìm trước: phải qua Discovery/quote trước đặt đơn. Text
cũ là lịch sử, không phải giá hiện tại. Refresh là view khi đọc, không sửa/
xóa snapshot trong DB hoặc tự thay người thực hiện.

404 với hội thoại/tin không thuộc user hoặc không tồn tại; 409 chưa có kết
quả; 400 UUID sai. Endpoint tối đa 60 request/phút và rate limit toàn cục.
Lỗi kiểm tra lại không được âm thầm dùng card cũ để điều hướng.

Ví dụ kết quả khi toàn bộ dịch vụ trong một phản hồi cũ đã bị ngừng cung cấp
(UUID chỉ minh họa, thay bằng ID thật từ API của user):

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "clientMessageId": "11111111-1111-4111-8111-111111111111",
    "reply": "Bạn có thể thử Side Part để tạo độ phồng tự nhiên.",
    "intent": "CONSULTATION",
    "suggestedServices": [],
    "suggestedProviders": [],
    "suggestedPosts": [],
    "nextActions": [],
    "followUpQuestion": null,
    "conversionPrompt": null,
    "nextAction": "CONTINUE_CONSULTATION",
    "degradedMode": false,
    "citations": [],
    "suggestionsExpired": true
  },
  "timestamp": "2026-10-30T08:00:00.000Z"
}
```

| Trạng thái | Điều kiện / xử lý client |
| --- | --- |
| 200, suggestionsExpired=false | Card không thay đổi khi kiểm tra; vẫn phải quote trước đặt |
| 200, suggestionsExpired=true | Cập nhật danh sách/giá và chỉ mở target còn tồn tại trong kết quả mới |
| 400 | ID/query/body sai, hoặc action không có trong kết quả còn hợp lệ; không retry nguyên lỗi vô hạn |
| 401 | Thiếu token hoặc phiên không hợp lệ; dùng cơ chế refresh/logout hiện có |
| 404 | Hội thoại/tin không tồn tại hoặc không thuộc user; dừng thao tác |
| 409 | Tin đang xử lý, lượt xử lý đã quá hạn, hoặc gửi lại cùng ID với text khác; giữ tin chờ và thử lại cùng ID/text nếu nội dung không đổi |
| 429 | Vượt giới hạn; backoff và hiển thị trạng thái rõ ràng |
| Mạng/5xx của Lambe | Giữ dữ liệu cũ để đọc, khóa thao tác chưa xác minh và cho thử lại |

Bảng là tổng hợp các endpoint AI; riêng refresh không nhận text và chỉ dùng
409 cho tin chưa có result. Lỗi Gemini có thể được đổi thành 200 với
degradedMode=true, không đồng nghĩa API Lambe bị 5xx. Không áp envelope thành
công lên lỗi nếu client đang nhận format lỗi Nest hiện tại.

GET lịch sử refresh cả trang bằng một nhóm tối đa ba query, tránh query theo
từng message/card. Replay cùng clientMessageId giữ ý định/text cũ nhưng card
có thể thay đổi theo DB. POST actions chỉ ghi target còn hợp lệ sau refresh;
target đã rút trả 400. Analytics lỗi không chặn điều hướng đã được kiểm tra.

Mobile kiểm tra riêng khi tap card; khi resume chỉ GET lịch sử một lần, ghép
result theo clientMessageId, giữ tin đang gửi/lỗi và danh sách hiện tại. Kết
quả cũ không ghi đè lần kiểm tra mới. Card ngoài 50 tin server trả về cần
kiểm tra riêng; hiện nút thử lại và giữ tư vấn. Không burst 50 request khi resume.

### Biên Gemini và độ trễ

Hỏi giá rõ ràng, tìm thợ và câu ngoài phạm vi nhận diện được được xử lý trực
tiếp bởi backend. Dịch vụ mới do khách nêu được ưu tiên; câu tham chiếu ngắn
có thể dùng dịch vụ ở lượt tư vấn trước. Giá/provider cards đến từ catalog/
Discovery, không lấy từ giá/tên thợ model tự thêm.

Lịch sử được lọc tại application và adapter trước gửi ngoài, gồm web research:
contact, số dài/OTP/giấy tờ, UUID, URL, tọa độ có nhãn/cặp và địa chỉ có nhãn.
Địa chỉ nhận diện được như `123 Lê Lợi` bị bỏ cả lượt thay vì đoán phần an
toàn. Raw tin nhắn vẫn thuộc lịch sử riêng của user ở Lambe; không bị xóa.

Reply được lọc từng câu để giữ tư vấn hữu ích, loại claim thương mại/PII nhận
diện được; follow-up và tiêu đề nguồn cũng được kiểm tra. Đây là lớp hạn chế
theo mẫu, chưa chứng minh loại mọi claim hoặc PII khó nhận diện. AI-004/005
vẫn mở cho kiểm thử đối kháng/ngữ nghĩa.

Prompt yêu cầu khoảng 60–100 từ, 2–3 gợi ý và một follow-up. Search và normal
completion chung timeout 12 giây; không cộng hai lượt chờ. Request với
gemini-3.1-flash-lite đặt thinkingLevel=minimal theo [tài liệu Google](https://ai.google.dev/gemini-api/docs/generate-content/thinking).
Đây không phải SLA. Google 503/timeout vẫn dùng fallback và lưu tin người dùng.
Log integration không in body lỗi hoặc credential.

`npm run ai:evaluate -- --live` gửi năm câu hỏi làm đẹp giả lập bằng key hiện
có, không đọc user/địa chỉ/DB; tắt web search cho lần đánh giá. Có thể tốn quota,
không tự chạy trong CI. Hai vòng 30/10 có 4/5 phản hồi mỗi vòng, gặp timeout và
503; retry riêng tóc thành công. Mẫu thành công khoảng 3,1–10,6 giây, không
kết luận SLA từ mẫu nhỏ này.

## Giới hạn hiện tại

Chưa có streaming hay phân trang lịch sử vượt 50 tin. Mobile mở video qua trình xem ngoài ứng dụng. Bộ lọc cần đánh giá thêm với PII khó nhận diện, claim gián tiếp và câu pha trộn chủ đề; không hứa model luôn đúng. Cần kiểm tra thiết bị thật, chuyên môn tư vấn và tỉ lệ nối đúng dịch vụ trước phát hành rộng. Fallback chỉ mang tính chung.
