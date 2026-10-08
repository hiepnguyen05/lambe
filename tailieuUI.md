# Tài liệu thiết kế UI theo API hiện tại của Lambe

Tài liệu này mô tả luồng màn hình, dữ liệu cần hiển thị, dữ liệu gửi lên API và dữ liệu nhận về từ backend để thiết kế giao diện cho ứng dụng Lambe.

Lambe là nền tảng kết nối khách hàng có nhu cầu làm đẹp tại nhà với nhà cung cấp dịch vụ làm đẹp như cắt tóc, nail, makeup, massage, gội đầu, chăm sóc cá nhân. Ứng dụng không trực tiếp cung cấp dịch vụ mà đóng vai trò trung gian kết nối, gợi ý dịch vụ phù hợp, gợi ý thợ gần vị trí khách và quản lý quy trình đăng ký đối tác.

## 1. Quy ước chung khi làm giao diện

### 1.1. Base URL

Backend hiện tại chạy dưới prefix:

```http
http://<host>:5000/api
```

Ví dụ khi chạy local Docker trên máy:

```http
http://localhost:5000/api
```

Khi chạy mobile emulator Android:

```http
http://10.0.2.2:5000/api
```

### 1.2. Format response chung

Các API thành công thường được backend bọc theo format:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {},
  "timestamp": "2026-10-03T10:00:00.000Z"
}
```

Frontend khi đọc dữ liệu cần lấy trong `response.data.data`.

Ví dụ:

```ts
const result = response.data.data;
```

### 1.3. Token đăng nhập

Sau khi đăng nhập thành công, backend trả `accessToken`.

Các API yêu cầu đăng nhập cần gửi:

```http
Authorization: Bearer <accessToken>
```

Frontend cần lưu token ở nơi an toàn:

- Mobile: secure storage nếu có.
- Web: ưu tiên httpOnly cookie nếu backend hỗ trợ sau này, tạm thời có thể dùng local/session storage khi đang phát triển.

### 1.4. Các enum quan trọng

Giới tính:

```ts
MALE | FEMALE | OTHER
```

Nhóm khách mục tiêu của dịch vụ:

```ts
ALL | MEN | WOMEN
```

Mức giá khách ưu tiên:

```ts
NO_PREFERENCE | BUDGET | BALANCED | PREMIUM
```

Loại đối tác:

```ts
INDIVIDUAL | ORGANIZATION
```

Trạng thái hồ sơ đăng ký đối tác:

```ts
DRAFT | PENDING_REVIEW | NEEDS_CHANGES | APPROVED | REJECTED | WITHDRAWN
```

Trạng thái danh mục/dịch vụ:

```ts
ACTIVE | INACTIVE | ARCHIVED
```

## 2. Luồng tổng quan ứng dụng khách hàng

Luồng chính:

```text
Mở app
→ Splash kiểm tra token
→ Chưa đăng nhập: màn đăng nhập/đăng ký
→ Đăng nhập Firebase
→ Backend kiểm tra tài khoản
→ Nếu tài khoản chưa đủ thông tin: hoàn tất đăng ký
→ Nếu onboarding chưa hoàn tất: cá nhân hóa
→ Trang chủ / khám phá dịch vụ
→ Chọn dịch vụ
→ Chọn địa chỉ / vị trí
→ Tìm thợ gần khách
→ Xem hồ sơ thợ
→ Đặt dịch vụ sau này
```

## 3. Màn Splash

### 3.1. Mục đích

Kiểm tra trạng thái đăng nhập ban đầu.

### 3.2. Dữ liệu cần có

Frontend kiểm tra:

- Có `accessToken` đã lưu không.
- Nếu có token, gọi API lấy thông tin người dùng hiện tại.

### 3.3. API sử dụng

```http
GET /api/auth/me
```

Header:

```http
Authorization: Bearer <accessToken>
```

### 3.4. Điều hướng

Nếu token không tồn tại hoặc hết hạn:

```text
Splash → Auth
```

Nếu token hợp lệ và người dùng chưa onboarding:

```text
Splash → Onboarding
```

Nếu token hợp lệ và đã onboarding:

```text
Splash → Home / Services
```

## 4. Màn đăng nhập / đăng ký

### 4.1. Mục tiêu UI

Màn này phục vụ cả đăng nhập và đăng ký khách hàng thông thường.

Các phương thức cần có:

- Đăng nhập bằng số điện thoại.
- Đăng nhập bằng Google.
- Đăng nhập bằng Facebook.

Lưu ý: Lambe dùng Firebase để xác minh danh tính ban đầu, nhưng tài khoản chính thức của hệ thống vẫn do backend Lambe quản lý. Frontend không được tự coi Firebase login là login thành công nếu chưa đổi Firebase `idToken` lấy Lambe `accessToken`.

### 4.2. Thành phần giao diện

Cần có:

- Logo Lambe.
- Tiêu đề ngắn gọn, ví dụ: `Làm đẹp tại nhà cùng Lambe`.
- Input số điện thoại.
- Button tiếp tục.
- Button Google.
- Button Facebook.
- Khu vực hiển thị lỗi.
- Loading state khi đang gửi yêu cầu.

### 4.3. Đăng nhập bằng số điện thoại

#### Bước 1: Nhập số điện thoại

Người dùng nhập số điện thoại Việt Nam.

Ví dụ hợp lệ:

```text
0912345678
```

Frontend nên normalize số trước khi gửi Firebase nếu cần.

Sau khi bấm tiếp tục:

```text
Auth phone input → Firebase gửi OTP → OTP screen
```

Ở bước này Firebase gửi mã OTP, backend chưa nhận dữ liệu.

#### Bước 2: Nhập OTP

Màn OTP cần có:

- Số điện thoại đang xác minh.
- 6 ô nhập mã OTP.
- Button xác nhận.
- Button gửi lại mã.
- Đếm ngược gửi lại mã.
- Lỗi nếu mã sai hoặc hết hạn.

Sau khi Firebase xác minh OTP thành công, frontend lấy:

```ts
firebaseUser.getIdToken()
```

Sau đó gọi backend:

```http
POST /api/auth/firebase
```

Body:

```json
{
  "idToken": "firebase_id_token"
}
```

### 4.4. Đăng nhập bằng Google/Facebook

Khi người dùng bấm Google/Facebook:

```text
Auth screen
→ Firebase Google/Facebook popup hoặc native login
→ Lấy Firebase idToken
→ Gọi /api/auth/firebase
```

API:

```http
POST /api/auth/firebase
```

Body:

```json
{
  "idToken": "firebase_id_token"
}
```

### 4.5. Kết quả sau khi gọi `/api/auth/firebase`

Backend có thể trả về một trong các tình huống sau.

#### Tình huống 1: Tài khoản đã tồn tại

Frontend nhận:

```json
{
  "accessToken": "...",
  "user": {
    "id": "uuid",
    "phone": "0912345678",
    "fullName": "Nguyen Van A",
    "avatarUrl": "https://...",
    "gender": "MALE",
    "onboardingStatus": "COMPLETED"
  }
}
```

Điều hướng:

```text
Nếu onboardingStatus = COMPLETED hoặc SKIPPED → Home / Services
Nếu onboardingStatus = NOT_STARTED hoặc IN_PROGRESS → Onboarding
```

#### Tình huống 2: Tài khoản mới nhưng thiếu thông tin bắt buộc

Backend trả `registrationToken`.

Frontend chuyển sang màn hoàn tất đăng ký:

```text
Auth → Complete registration
```

## 5. Màn hoàn tất đăng ký

### 5.1. Khi nào hiển thị

Hiển thị khi `/api/auth/firebase` trả về `registrationToken`.

### 5.2. Dữ liệu màn hình cần có

Input:

- Họ và tên.

Hidden data:

- `registrationToken` nhận từ backend.

### 5.3. API sử dụng

```http
POST /api/auth/complete-registration
```

Body:

```json
{
  "registrationToken": "temporary_registration_token",
  "fullName": "Nguyen Van A"
}
```

### 5.4. Kết quả

Backend trả `accessToken` và `user`.

Điều hướng:

```text
Complete registration → Onboarding
```

Vì tài khoản mới cần cá nhân hóa trước khi vào trải nghiệm chính.

## 6. Màn liên kết số điện thoại cho Google/Facebook

### 6.1. Khi nào cần

Nếu người dùng đăng nhập Google/Facebook nhưng tài khoản Lambe cần số điện thoại, UI phải yêu cầu nhập số điện thoại.

### 6.2. Mục tiêu quan trọng

Trước khi gửi OTP, frontend phải kiểm tra số điện thoại đã tồn tại trong hệ thống chưa. Không được chuyển thẳng sang OTP nếu số đã có tài khoản.

### 6.3. API kiểm tra số điện thoại

```http
POST /api/auth/firebase/phone-link-check
```

Body:

```json
{
  "idToken": "firebase_social_id_token",
  "phone": "0912345678"
}
```

### 6.4. Luồng đúng

```text
Google/Facebook login
→ Backend yêu cầu phone
→ Màn nhập phone
→ Gọi /auth/firebase/phone-link-check
→ Nếu hợp lệ mới gửi Firebase OTP
→ Nhập OTP
→ Lấy Firebase idToken mới
→ Gọi /auth/firebase
→ Nhận Lambe accessToken
```

## 7. Onboarding cá nhân hóa khách hàng

### 7.1. Mục tiêu

Onboarding dùng để thu thập nhu cầu làm đẹp ban đầu, từ đó hệ thống gợi ý danh mục, dịch vụ và sau này là thợ phù hợp gần khách.

Ví dụ:

```text
Khách nam
→ Quan tâm chăm sóc nam giới
→ Chọn cắt tóc, gội đầu, massage
→ Trang chủ ưu tiên dịch vụ và thợ phù hợp với nhu cầu này
```

### 7.2. API lấy dữ liệu dựng onboarding

```http
GET /api/onboarding/options
```

Không cần token hoặc có thể gọi khi đã đăng nhập tùy frontend setup. Nên gọi sau khi đăng nhập để dựng câu hỏi cá nhân hóa.

Frontend nhận danh sách:

- Danh mục đang hoạt động.
- Dịch vụ đang hoạt động trong từng danh mục.
- Icon, tên, mô tả, giá nếu backend trả.

### 7.3. Màn onboarding đề xuất

#### Màn 1: Chọn giới tính

Dữ liệu người dùng chọn:

```ts
gender: MALE | FEMALE | OTHER
```

UI gợi ý:

- Nam.
- Nữ.
- Khác / không muốn nói.

#### Màn 2: Chọn nhóm dịch vụ quan tâm

Dữ liệu gửi:

```ts
preferredAudience: ALL | MEN | WOMEN
```

UI gợi ý:

- Dịch vụ cho nam.
- Dịch vụ cho nữ.
- Tất cả dịch vụ.

#### Màn 3: Chọn danh mục quan tâm

Dữ liệu lấy từ:

```http
GET /api/onboarding/options
```

Người dùng có thể chọn nhiều danh mục.

Dữ liệu gửi:

```ts
categoryIds: string[]
```

Ví dụ:

```json
{
  "categoryIds": [
    "category_uuid_1",
    "category_uuid_2"
  ]
}
```

#### Màn 4: Chọn dịch vụ quan tâm

Dữ liệu lấy từ:

```http
GET /api/onboarding/options
```

Người dùng có thể chọn nhiều dịch vụ.

Dữ liệu gửi:

```ts
serviceIds: string[]
```

Ví dụ:

```json
{
  "serviceIds": [
    "service_uuid_1",
    "service_uuid_2"
  ]
}
```

#### Màn 5: Chọn mức giá ưu tiên

Dữ liệu gửi:

```ts
pricePreference: NO_PREFERENCE | BUDGET | BALANCED | PREMIUM
```

UI có thể hiển thị:

- Tiết kiệm.
- Cân bằng.
- Cao cấp.
- Không quan trọng.

#### Màn 6: Địa chỉ mặc định

Màn này nên có nhưng có thể cho bỏ qua.

Dữ liệu gửi:

```json
{
  "defaultAddress": {
    "type": "HOME",
    "label": "Nhà",
    "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "provinceName": "Thành phố Hồ Chí Minh",
    "districtName": "Quận 1",
    "wardName": "Phường Bến Nghé",
    "streetLine": "12 Nguyễn Huệ",
    "latitude": 10.7731,
    "longitude": 106.703,
    "isMapConfirmed": true
  }
}
```

UI cần có:

- Tên địa chỉ, ví dụ: Nhà, Công ty.
- Địa chỉ chi tiết.
- Tọa độ lấy từ bản đồ hoặc GPS.
- Nút **Lấy vị trí hiện tại** để xin quyền GPS và tự điền địa chỉ.
- Bản đồ hoặc màn xác nhận ghim trước khi gửi `isMapConfirmed = true`.
- Cách nhập địa chỉ thủ công nếu khách từ chối quyền vị trí.

### 7.4. API lưu onboarding

Có thể lưu từng bước hoặc lưu một lần ở cuối.

```http
PUT /api/me/onboarding
```

Header:

```http
Authorization: Bearer <accessToken>
```

Body đầy đủ:

```json
{
  "gender": "MALE",
  "preferredAudience": "MEN",
  "pricePreference": "BALANCED",
  "categoryIds": ["category_uuid"],
  "serviceIds": ["service_uuid"],
  "defaultAddress": {
    "type": "HOME",
    "label": "Nhà",
    "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "provinceName": "Thành phố Hồ Chí Minh",
    "districtName": "Quận 1",
    "wardName": "Phường Bến Nghé",
    "streetLine": "12 Nguyễn Huệ",
    "latitude": 10.7731,
    "longitude": 106.703,
    "isMapConfirmed": true
  }
}
```

### 7.5. API hoàn tất onboarding

```http
POST /api/me/onboarding/complete
```

Sau khi thành công:

```text
Onboarding → Home / Services
```

### 7.6. API bỏ qua onboarding

```http
POST /api/me/onboarding/skip
```

Sau khi bỏ qua:

```text
Onboarding → Home / Services
```

Lưu ý: UI nên cho người dùng quay lại chỉnh cá nhân hóa ở màn Profile.

## 8. Trang chủ / khám phá dịch vụ

### 8.1. Mục tiêu

Trang chủ không nên chỉ là danh sách tĩnh. Nó cần ưu tiên hiển thị dịch vụ phù hợp với onboarding.

### 8.2. Dữ liệu nên hiển thị

- Lời chào theo tên khách.
- Địa chỉ hiện tại hoặc địa chỉ mặc định.
- Dịch vụ gợi ý cho bạn.
- Danh mục dịch vụ.
- Dịch vụ phổ biến.
- Nút tìm kiếm.

### 8.3. API lấy dịch vụ gợi ý

```http
GET /api/me/recommendations/services?limit=20
```

Header:

```http
Authorization: Bearer <accessToken>
```

Dữ liệu nhận nên dùng để hiển thị:

- Tên dịch vụ.
- Danh mục.
- Giá sàn.
- Giá trần.
- Thời lượng.
- Lý do gợi ý nếu backend trả.
- Điểm gợi ý nếu backend trả.

### 8.4. API lấy danh mục công khai

```http
GET /api/categories
```

Mỗi danh mục cần hiển thị:

- `id`
- `name`
- `slug`
- `description`
- `iconUrl`
- `coverImageUrl` nếu có
- `sortOrder`

### 8.5. API lấy dịch vụ công khai

```http
GET /api/services
```

Filter có thể dùng:

```http
GET /api/services?categorySlug=toc&targetAudience=MEN&search=cat&maxPriceAmount=300000
```

Mỗi dịch vụ cần hiển thị:

- `id`
- `name`
- `slug`
- `description`
- `iconUrl`
- `coverImageUrl`
- `minPriceAmount`
- `maxPriceAmount`
- `defaultDurationMinutes`
- `targetAudience`
- `category`

### 8.6. Luồng từ trang chủ đến tìm thợ

```text
Home
→ Chọn dịch vụ
→ Chọn địa chỉ / vị trí
→ Tìm thợ
→ Danh sách thợ gần khách
```

## 9. Màn danh sách dịch vụ

### 9.1. Thành phần UI

Cần có:

- Search input.
- Filter danh mục.
- Filter giới tính/nhóm khách: tất cả, nam, nữ.
- Filter mức giá tối đa.
- Danh sách dịch vụ.

### 9.2. API

```http
GET /api/services?search=<keyword>&categorySlug=<slug>&targetAudience=<MEN|WOMEN|ALL>&maxPriceAmount=<number>
```

### 9.3. Khi bấm vào dịch vụ

Điều hướng:

```text
Services list → Service detail
```

Hoặc nếu chưa có màn chi tiết:

```text
Services list → Select address → Search providers
```

## 10. Màn chọn địa chỉ khách hàng

### 10.1. Mục tiêu

Khách cần chọn nơi thợ sẽ đến phục vụ.

### 10.2. API lấy địa chỉ đã lưu

```http
GET /api/me/addresses
```

### 10.3. API thêm địa chỉ

```http
POST /api/me/addresses
```

Body:

```json
{
  "type": "HOME",
  "label": "Nhà",
  "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
  "provinceName": "Thành phố Hồ Chí Minh",
  "districtName": "Quận 1",
  "wardName": "Phường Bến Nghé",
  "streetLine": "12 Nguyễn Huệ",
  "latitude": 10.7731,
  "longitude": 106.703,
  "isMapConfirmed": true,
  "contactName": "Nguyen Van A",
  "contactPhone": "0912345678",
  "note": "Gọi trước khi đến",
  "isDefault": true
}
```

Màn thêm/sửa địa chỉ phải có hành động **Lấy vị trí hiện tại**. Mobile xin quyền
GPS, reverse geocode tọa độ, hiển thị ghim để khách xác nhận rồi mới gọi API.
Nếu không có quyền GPS, khách vẫn nhập địa chỉ và chọn ghim thủ công.

### 10.4. API sửa địa chỉ

```http
PATCH /api/me/addresses/:id
```

### 10.5. API đặt địa chỉ mặc định

```http
PUT /api/me/addresses/:id/default
```

### 10.6. API xóa địa chỉ

```http
DELETE /api/me/addresses/:id
```

## 11. Màn tìm thợ gần khách

### 11.1. Khi nào dùng

Sau khi khách chọn:

- Dịch vụ.
- Địa chỉ hoặc vị trí hiện tại.

### 11.2. API tìm thợ

```http
POST /api/discovery/providers/search
```

Body dùng địa chỉ đã lưu:

```json
{
  "serviceId": "service_uuid",
  "customerAddressId": "address_uuid",
  "radiusKm": 10,
  "limit": 20
}
```

Hoặc dùng tọa độ trực tiếp:

```json
{
  "serviceId": "service_uuid",
  "latitude": 10.7731,
  "longitude": 106.703,
  "radiusKm": 10,
  "limit": 20
}
```

### 11.3. UI danh sách thợ

Mỗi thợ nên hiển thị:

- Ảnh đại diện.
- Tên hiển thị.
- Khoảng cách.
- Dịch vụ phù hợp.
- Giá thợ đề xuất.
- Thời lượng.
- Khu vực phục vụ.
- Trạng thái hoạt động nếu backend trả.
- Nút xem chi tiết.
- Nút đặt ngay sau này.

### 11.4. API xem hồ sơ công khai của thợ

```http
GET /api/providers/:id/public
```

Màn chi tiết thợ nên có:

- Ảnh đại diện.
- Tên thợ.
- Giới thiệu.
- Dịch vụ cung cấp.
- Giá từng dịch vụ.
- Portfolio nếu backend có.
- Khu vực phục vụ.
- Đánh giá sau này.

## 12. Màn hồ sơ khách hàng

### 12.1. Mục tiêu

Là nơi khách quản lý thông tin cá nhân và quay lại các thiết lập quan trọng.

### 12.2. Dữ liệu hiển thị

Lấy từ:

```http
GET /api/auth/me
```

Hiển thị:

- Ảnh đại diện.
- Họ tên.
- Số điện thoại.
- Giới tính.
- Trạng thái cá nhân hóa.
- Nút sửa hồ sơ.
- Nút đổi ảnh đại diện.
- Nút cá nhân hóa lại.
- Nút quản lý địa chỉ.
- Nút đăng ký làm đối tác.
- Nút đăng xuất.

Không nên hiển thị các thông tin giả như:

- Mã hội viên nếu backend chưa có.
- Hạng thành viên nếu backend chưa có.
- Điểm thưởng nếu backend chưa có.

### 12.3. API cập nhật hồ sơ

```http
PATCH /api/auth/me
```

Body:

```json
{
  "fullName": "Nguyen Van A",
  "gender": "MALE"
}
```

### 12.4. API đổi ảnh đại diện

```http
POST /api/auth/me/avatar
```

Body:

```http
multipart/form-data
file=<image>
```

### 12.5. API xóa ảnh đại diện

```http
DELETE /api/auth/me/avatar
```

## 13. Luồng đăng ký làm đối tác / thợ

### 13.1. Điều kiện bắt đầu

Người dùng bắt buộc phải có tài khoản khách hàng đã xác minh số điện thoại trước.

Lý do:

- Hồ sơ đối tác gắn với một user thật.
- Có số điện thoại đã xác minh.
- Dễ theo dõi trạng thái hồ sơ.
- Tránh hồ sơ rác.

Luồng:

```text
Khách đăng nhập
→ Profile
→ Đăng ký làm đối tác
→ Tạo hồ sơ đăng ký
→ Điền thông tin
→ Chọn dịch vụ cung cấp
→ Upload giấy tờ
→ Đồng ý điều khoản
→ Gửi duyệt
→ Theo dõi trạng thái
```

### 13.2. Màn giới thiệu đăng ký đối tác

Dữ liệu hiển thị:

- Lợi ích khi trở thành đối tác.
- Quy trình xét duyệt.
- Các giấy tờ cần chuẩn bị.
- Button bắt đầu.

Khi bấm bắt đầu:

```http
POST /api/provider-applications
```

Body:

```json
{
  "providerType": "INDIVIDUAL"
}
```

Hoặc:

```json
{
  "providerType": "ORGANIZATION"
}
```

### 13.3. Màn chọn loại đối tác

Input:

```ts
providerType: INDIVIDUAL | ORGANIZATION
```

UI:

- Cá nhân.
- Tổ chức / salon / studio.

Sau khi chọn, tạo hồ sơ hoặc cập nhật hồ sơ hiện có.

### 13.4. Màn thông tin cá nhân

Dành cho `INDIVIDUAL`.

Các trường:

- Họ tên pháp lý.
- Ngày sinh.
- Giới tính.
- Email nhận thông báo.
- Giới thiệu bản thân.
- Số CCCD.
- Số năm kinh nghiệm.

API:

```http
PATCH /api/provider-applications/:id
```

Body:

```json
{
  "legalFullName": "Nguyen Van A",
  "birthDate": "1995-08-20",
  "gender": "MALE",
  "email": "provider@example.com",
  "biography": "Có 3 năm kinh nghiệm cắt tóc nam tại nhà.",
  "nationalIdNumber": "001095012345",
  "experienceYears": 3
}
```

### 13.5. Màn thông tin tổ chức

Dành cho `ORGANIZATION`.

Các trường:

- Tên tổ chức.
- Mã số thuế.
- Số đăng ký kinh doanh.
- Địa chỉ đăng ký.
- Người đại diện.
- Email nhận thông báo.
- Giới thiệu tổ chức.

API:

```http
PATCH /api/provider-applications/:id
```

Body:

```json
{
  "organizationName": "Lambe Beauty Studio",
  "taxCode": "0123456789",
  "businessRegistrationNumber": "BRN123456",
  "registeredAddress": "12 Nguyễn Huệ, Quận 1, TP.HCM",
  "representativeName": "Nguyen Van A",
  "email": "provider@example.com",
  "biography": "Studio chuyên làm tóc, nail và makeup tại nhà."
}
```

### 13.6. Màn chọn dịch vụ cung cấp

Dữ liệu lấy từ:

```http
GET /api/categories
GET /api/services
```

UI cần cho phép:

- Chọn nhiều danh mục.
- Trong mỗi danh mục chọn nhiều dịch vụ.
- Nhập giá đề xuất cho từng dịch vụ.
- Nhập thời lượng.
- Nhập mô tả riêng nếu cần.

Lưu ý: Dịch vụ đăng ký phải là dịch vụ có trong DB. Nếu thợ cung cấp dịch vụ chưa có trong hệ thống, dùng màn đề xuất dịch vụ mới.

API thêm dịch vụ:

```http
POST /api/provider-applications/:id/services
```

Body:

```json
{
  "serviceId": "service_uuid",
  "proposedPriceAmount": 150000,
  "durationMinutes": 60,
  "description": "Cắt tóc nam tại nhà, tư vấn kiểu phù hợp khuôn mặt."
}
```

API sửa dịch vụ đã thêm:

```http
PATCH /api/provider-applications/:id/services/:itemId
```

Body:

```json
{
  "proposedPriceAmount": 180000,
  "durationMinutes": 75,
  "description": "Mô tả mới"
}
```

API xóa dịch vụ khỏi hồ sơ:

```http
DELETE /api/provider-applications/:id/services/:itemId
```

### 13.7. Màn đề xuất dịch vụ mới

Khi thợ không tìm thấy dịch vụ mình cung cấp trong hệ thống, UI cho thợ đề xuất dịch vụ mới.

Trường cần nhập:

- Danh mục.
- Tên dịch vụ.
- Mô tả.
- Giá đề xuất.
- Thời lượng.

API:

```http
POST /api/provider-applications/:id/service-suggestions
```

Body:

```json
{
  "categoryId": "category_uuid",
  "name": "Tạo kiểu tóc đi tiệc",
  "description": "Tạo kiểu tóc nhanh tại nhà cho sự kiện.",
  "proposedPriceAmount": 180000,
  "durationMinutes": 60
}
```

API sửa đề xuất:

```http
PATCH /api/provider-applications/:id/service-suggestions/:suggestionId
```

API xóa đề xuất:

```http
DELETE /api/provider-applications/:id/service-suggestions/:suggestionId
```

### 13.8. Màn upload giấy tờ

Mục tiêu:

Upload các ảnh phục vụ xét duyệt hồ sơ.

Các nhóm giấy tờ nên có:

- Ảnh chân dung hiển thị công khai.
- CCCD mặt trước.
- CCCD mặt sau.
- Selfie xác minh.
- Chứng chỉ nghề.
- Portfolio sản phẩm đã làm.
- GPLX nếu sử dụng xe.
- Ảnh giấy tờ tổ chức nếu là tổ chức.

API:

```http
POST /api/provider-applications/:id/documents/:type
```

Body:

```http
multipart/form-data
file=<image>
```

Query optional:

```http
?applicationServiceId=<provider_application_service_id>
```

Dùng `applicationServiceId` khi giấy tờ liên quan đến một dịch vụ cụ thể, ví dụ chứng chỉ nail cho dịch vụ nail.

API xóa tài liệu:

```http
DELETE /api/provider-applications/:id/documents/:documentId
```

API lấy link xem tài liệu:

```http
GET /api/provider-applications/:id/documents/:documentId/access
```

### 13.9. Màn điều khoản đối tác

UI cần có:

- Nội dung điều khoản.
- Checkbox đồng ý.
- Button xác nhận.

API lấy điều khoản hiện tại:

```http
GET /api/provider-applications/terms/current
```

API đồng ý:

```http
POST /api/provider-applications/:id/terms/accept
```

Body:

```json
{
  "accepted": true
}
```

### 13.10. Màn gửi hồ sơ

Trước khi gửi hồ sơ, UI nên hiển thị checklist:

- Thông tin cá nhân/tổ chức.
- Dịch vụ cung cấp.
- Giấy tờ xác minh.
- Điều khoản đã đồng ý.

API:

```http
POST /api/provider-applications/:id/submit
```

Sau khi gửi thành công:

```text
Status = PENDING_REVIEW
```

### 13.11. Màn theo dõi trạng thái hồ sơ

API lấy danh sách hồ sơ của user:

```http
GET /api/provider-applications
```

API lấy chi tiết hồ sơ:

```http
GET /api/provider-applications/:id
```

UI theo trạng thái:

`DRAFT`:

- Cho tiếp tục chỉnh sửa.
- Cho gửi duyệt.

`PENDING_REVIEW`:

- Hiển thị đang chờ kiểm duyệt.
- Không cho sửa các phần quan trọng nếu backend không cho.

`NEEDS_CHANGES`:

- Hiển thị lý do cần bổ sung.
- Cho sửa phần bị yêu cầu bổ sung.
- Cho gửi lại.

`APPROVED`:

- Hiển thị hồ sơ đã duyệt.
- Cho chuyển sang thiết lập hoạt động thợ.

`REJECTED`:

- Hiển thị lý do từ chối.
- Có thể cho tạo hồ sơ mới nếu backend cho phép.

`WITHDRAWN`:

- Hiển thị hồ sơ đã rút.

API rút hồ sơ:

```http
POST /api/provider-applications/:id/withdraw
```

## 14. Luồng sau khi được duyệt làm thợ

### 14.1. Màn thiết lập hoạt động

Sau khi hồ sơ `APPROVED`, thợ cần cấu hình:

- Khu vực phục vụ.
- Bán kính phục vụ.
- Lịch làm việc.
- Dịch vụ đã được duyệt muốn bật.

API lấy setup:

```http
GET /api/me/provider/setup
```

API lưu setup:

```http
PUT /api/me/provider/setup
```

Body:

```json
{
  "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
  "serviceAreaLatitude": 21.0368,
  "serviceAreaLongitude": 105.7827,
  "serviceRadiusKm": 10,
  "workingHours": [
    {
      "dayOfWeek": 1,
      "startMinute": 480,
      "endMinute": 1020
    }
  ],
  "enabledServiceIds": ["provider_service_uuid"]
}
```

Lưu ý: `enabledServiceIds` là ID của dịch vụ thợ đã được duyệt, không phải ID dịch vụ gốc trong bảng services.

### 14.2. Màn bật/tắt nhận đơn

Khi thợ bật nhận đơn, vị trí xuất phát lấy theo vị trí hiện tại của thiết bị.

Bật online:

```http
POST /api/me/provider/availability/online
```

Body:

```json
{
  "latitude": 21.0368,
  "longitude": 105.7827
}
```

Cập nhật vị trí khi đang online:

```http
PUT /api/me/provider/availability/heartbeat
```

Body:

```json
{
  "latitude": 21.0369,
  "longitude": 105.7828
}
```

Tắt online:

```http
POST /api/me/provider/availability/offline
```

Lấy trạng thái hiện tại:

```http
GET /api/me/provider/availability
```

## 15. Luồng admin / kiểm duyệt

Phần này dùng cho web admin, không phải app khách hàng.

### 15.1. Đăng nhập admin

Admin/Moderator đăng nhập bằng username/password, tách biệt hoàn toàn với đăng nhập người dùng.

API:

```http
POST /api/admin/auth/login
```

Dữ liệu cần có:

```json
{
  "username": "admin",
  "password": "password"
}
```

Sau khi đăng nhập, admin dùng internal access token.

### 15.2. Quản lý danh mục

Danh sách:

```http
GET /api/admin/categories?search=toc&status=ACTIVE&page=1&limit=20
```

Chi tiết:

```http
GET /api/admin/categories/:id
```

Tạo:

```http
POST /api/admin/categories
```

Body:

```json
{
  "code": "HAIR",
  "name": "Dịch vụ tóc",
  "slug": "dich-vu-toc",
  "description": "Cắt, gội, tạo kiểu tóc",
  "iconUrl": "content_cut",
  "sortOrder": 1
}
```

Cập nhật:

```http
PATCH /api/admin/categories/:id
```

Khóa/mở khóa/lưu trữ:

```http
PATCH /api/admin/categories/:id/status
```

Body:

```json
{
  "status": "ACTIVE"
}
```

Upload ảnh bìa:

```http
POST /api/admin/categories/:id/cover-image
```

Xóa ảnh bìa:

```http
DELETE /api/admin/categories/:id/cover-image
```

Sắp xếp:

```http
PATCH /api/admin/categories/reorder
```

### 15.3. Quản lý dịch vụ

Danh sách:

```http
GET /api/admin/services?search=cat&categoryId=<uuid>&status=ACTIVE&targetAudience=MEN&page=1&limit=20
```

Chi tiết:

```http
GET /api/admin/services/:id
```

Tạo:

```http
POST /api/admin/services
```

Body:

```json
{
  "categoryId": "category_uuid",
  "code": "MEN_HAIRCUT",
  "name": "Cắt tóc nam",
  "slug": "cat-toc-nam",
  "description": "Cắt tóc nam tại nhà",
  "iconUrl": "content_cut",
  "minPriceAmount": 50000,
  "maxPriceAmount": 300000,
  "defaultDurationMinutes": 45,
  "targetAudience": "MEN",
  "sortOrder": 1
}
```

Cập nhật:

```http
PATCH /api/admin/services/:id
```

Khóa/mở khóa/lưu trữ:

```http
PATCH /api/admin/services/:id/status
```

Body:

```json
{
  "status": "ACTIVE"
}
```

Upload ảnh bìa:

```http
POST /api/admin/services/:id/cover-image
```

Xóa ảnh bìa:

```http
DELETE /api/admin/services/:id/cover-image
```

Sắp xếp dịch vụ trong danh mục:

```http
PATCH /api/admin/categories/:categoryId/services/reorder
```

### 15.4. Quản lý hồ sơ đăng ký đối tác

Danh sách:

```http
GET /api/admin/provider-applications?search=nguyen&status=PENDING_REVIEW&providerType=INDIVIDUAL&page=1&limit=20
```

Chi tiết:

```http
GET /api/admin/provider-applications/:id
```

Xem tài liệu nhạy cảm:

```http
GET /api/admin/provider-applications/:id/documents/:documentId/access
```

Duyệt từng nhóm kiểm tra:

```http
PATCH /api/admin/provider-applications/:id/checks/:section
```

Body:

```json
{
  "status": "VERIFIED",
  "reviewNote": "Hợp lệ"
}
```

Các section:

```ts
IDENTITY | PORTRAIT | EXPERTISE | SERVICES | TERMS
```

Duyệt tài liệu:

```http
PATCH /api/admin/provider-applications/:id/documents/:documentId/review
```

Duyệt dịch vụ thợ đăng ký:

```http
PATCH /api/admin/provider-applications/:id/services/:itemId/review
```

Duyệt đề xuất dịch vụ mới:

```http
POST /api/admin/provider-applications/:id/service-suggestions/:suggestionId/approve
```

Body giống tạo service:

```json
{
  "categoryId": "category_uuid",
  "code": "PARTY_HAIR_STYLING",
  "name": "Tạo kiểu tóc đi tiệc",
  "slug": "tao-kieu-toc-di-tiec",
  "description": "Tạo kiểu tóc tại nhà cho sự kiện",
  "iconUrl": "styler",
  "minPriceAmount": 100000,
  "maxPriceAmount": 500000,
  "defaultDurationMinutes": 60,
  "targetAudience": "ALL",
  "sortOrder": 10
}
```

Từ chối đề xuất dịch vụ mới:

```http
POST /api/admin/provider-applications/:id/service-suggestions/:suggestionId/reject
```

Body:

```json
{
  "reason": "Dịch vụ đã tồn tại trong hệ thống."
}
```

Yêu cầu bổ sung:

```http
POST /api/admin/provider-applications/:id/request-changes
```

Body:

```json
{
  "reason": "Ảnh CCCD mặt trước bị mờ, vui lòng tải lại."
}
```

Từ chối hồ sơ:

```http
POST /api/admin/provider-applications/:id/reject
```

Body:

```json
{
  "reason": "Thông tin xác minh không hợp lệ."
}
```

Duyệt hồ sơ:

```http
POST /api/admin/provider-applications/:id/approve
```

## 16. Quản lý khách hàng trong admin

Danh sách khách hàng:

```http
GET /api/admin/customers?search=nguyen&page=1&limit=20
```

Chi tiết khách hàng:

```http
GET /api/admin/customers/:id
```

Hoạt động khách hàng:

```http
GET /api/admin/customers/:id/activity
```

Hồ sơ đăng ký đối tác của khách:

```http
GET /api/admin/customers/:id/provider-applications
```

Khóa/mở khóa khách hàng:

```http
PATCH /api/admin/customers/:id/status
```

## 17. Upload ảnh admin

Dùng cho admin upload ảnh chung nếu cần.

```http
POST /api/admin/upload/image?folder=categories
```

Body:

```http
multipart/form-data
file=<image>
```

Folder hỗ trợ:

```ts
general | categories | profiles | portfolios
```

## 18. Gợi ý thứ tự thiết kế màn hình

Nên thiết kế UI theo thứ tự sau để khớp luồng backend:

1. Splash.
2. Auth phone/social.
3. OTP.
4. Complete registration.
5. Onboarding.
6. Home / recommended services.
7. Services list.
8. Address picker.
9. Provider search results.
10. Customer profile.
11. Edit profile.
12. Provider application intro.
13. Provider application form.
14. Provider documents upload.
15. Provider application status.
16. Provider setup after approval.
17. Provider online/offline.
18. Admin dashboard nếu làm web admin.

## 19. Những điểm UI không nên tự bịa khi backend chưa có

Không nên hiển thị hoặc thiết kế thành chức năng thật nếu backend chưa có:

- Điểm thưởng.
- Hạng hội viên.
- Ví khách hàng.
- Lịch sử đơn hàng nếu chưa có API booking/order.
- Thanh toán online.
- Đánh giá sao thật.
- Chat thật.
- Mã giảm giá.

Các phần này có thể để dạng placeholder trong tài liệu thiết kế sản phẩm, nhưng không nên đưa vào UI chạy thật nếu chưa có API.

## 20. Màn hình nên ưu tiên làm tốt nhất

Ở giai đoạn hiện tại, frontend nên ưu tiên:

- Auth/OTP thật ổn định.
- Onboarding rõ ràng, dễ chọn.
- Home hiển thị đúng dịch vụ gợi ý.
- Profile khách hàng chỉnh sửa được.
- Đăng ký đối tác đầy đủ, chia bước dễ hiểu.
- Theo dõi trạng thái hồ sơ đối tác rõ ràng.

Đây là các phần đã có API tương đối rõ và phù hợp nhất để dựng giao diện chạy được.

## Phụ lục A. API contract chi tiết cho frontend

Phần này mô tả chi tiết hơn các API mà giao diện cần dùng. Khi frontend gọi API, luôn nhớ rằng dữ liệu thật nằm trong `response.data.data` do backend có response wrapper.

Ví dụ response thực tế:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": "uuid"
  },
  "timestamp": "2026-10-03T10:00:00.000Z"
}
```

Frontend đọc:

```ts
const data = response.data.data;
```

### A.1. Auth khách hàng

#### A.1.1. Đổi Firebase token lấy Lambe token

```http
POST /api/auth/firebase
```

Quyền:

```text
Public
```

Dùng ở màn:

- OTP verify xong.
- Google login xong.
- Facebook login xong.

Request body:

```json
{
  "idToken": "firebase_id_token_tối_thiểu_100_ký_tự"
}
```

Validation quan trọng:

- `idToken` là string.
- Độ dài từ 100 đến 4096 ký tự.
- Không gửi OTP code lên backend. OTP được Firebase xác minh ở client trước.

Response khi tài khoản đã tồn tại:

```json
{
  "accessToken": "lambe_access_token",
  "user": {
    "id": "6b0f8f25-7f36-4d78-ae6f-3e834edc4f8e",
    "phone": "+84912345678",
    "fullName": "Nguyen Minh Anh",
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
    "status": "ACTIVE",
    "roles": ["CUSTOMER"],
    "gender": "MALE",
    "preferredAudience": "MEN",
    "pricePreference": "BALANCED",
    "onboardingStatus": "COMPLETED",
    "createdAt": "2026-09-29T10:30:00.000Z",
    "updatedAt": "2026-09-29T10:30:00.000Z"
  }
}
```

Response khi cần hoàn tất đăng ký:

```json
{
  "registrationToken": "temporary_registration_token",
  "phone": "+84912345678",
  "firebaseUid": "firebase_uid"
}
```

Frontend xử lý:

```text
Nếu có accessToken:
  Lưu accessToken
  Lưu user
  Nếu onboardingStatus = COMPLETED hoặc SKIPPED → Home
  Nếu onboardingStatus = NOT_STARTED hoặc IN_PROGRESS → Onboarding

Nếu có registrationToken:
  Chuyển sang màn Complete registration
```

Lỗi thường gặp:

- `idToken must be longer than or equal to 100 characters`: frontend đang gửi nhầm OTP code, phone number, hoặc fake token thay vì Firebase ID token thật.
- `Unauthorized`: Firebase token sai, hết hạn, project Firebase không khớp backend.

#### A.1.2. Kiểm tra số điện thoại trước khi liên kết social login

```http
POST /api/auth/firebase/phone-link-check
```

Quyền:

```text
Public
```

Dùng ở màn:

- Người dùng đăng nhập Google/Facebook nhưng hệ thống cần bổ sung số điện thoại.
- Trước khi gửi Firebase OTP cho số điện thoại đó.

Request body:

```json
{
  "idToken": "firebase_social_id_token",
  "phone": "0912345678"
}
```

Validation:

- `idToken`: string, 100-4096 ký tự.
- `phone`: số điện thoại Việt Nam hợp lệ, format `0[35789]xxxxxxxx`.

Response:

```json
{
  "canLink": true,
  "existingUserId": null
}
```

Frontend xử lý:

```text
Nếu canLink = true:
  Cho Firebase gửi OTP
  Chuyển sang màn nhập OTP

Nếu canLink = false hoặc API báo lỗi:
  Không gửi OTP
  Hiển thị lỗi số điện thoại đã được sử dụng
```

Điểm quan trọng:

- Không được chuyển sang màn OTP trước khi API này trả về hợp lệ.
- Không được gửi OTP nếu số điện thoại đã có tài khoản Lambe.

#### A.1.3. Hoàn tất đăng ký

```http
POST /api/auth/complete-registration
```

Quyền:

```text
Public nhưng cần registrationToken
```

Dùng ở màn:

- Complete registration.

Request body:

```json
{
  "registrationToken": "temporary_registration_token",
  "fullName": "Nguyen Minh Anh"
}
```

Validation:

- `registrationToken`: bắt buộc.
- `fullName`: 2-100 ký tự.

Response:

```json
{
  "accessToken": "lambe_access_token",
  "user": {
    "id": "uuid",
    "phone": "+84912345678",
    "fullName": "Nguyen Minh Anh",
    "avatarUrl": null,
    "status": "ACTIVE",
    "roles": ["CUSTOMER"],
    "gender": null,
    "preferredAudience": "ALL",
    "pricePreference": "NO_PREFERENCE",
    "onboardingStatus": "NOT_STARTED",
    "createdAt": "2026-09-29T10:30:00.000Z",
    "updatedAt": "2026-09-29T10:30:00.000Z"
  }
}
```

Frontend xử lý:

```text
Lưu accessToken
Lưu user
Chuyển sang Onboarding
```

#### A.1.4. Lấy thông tin người dùng hiện tại

```http
GET /api/auth/me
```

Quyền:

```text
Customer access token
```

Header:

```http
Authorization: Bearer <accessToken>
```

Dùng ở màn:

- Splash.
- Profile.
- Sau khi cập nhật hồ sơ.
- Sau khi hoàn tất onboarding.

Response:

```json
{
  "id": "uuid",
  "phone": "+84912345678",
  "fullName": "Nguyen Minh Anh",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
  "status": "ACTIVE",
  "roles": ["CUSTOMER"],
  "gender": "MALE",
  "preferredAudience": "MEN",
  "pricePreference": "BALANCED",
  "onboardingStatus": "COMPLETED",
  "createdAt": "2026-09-29T10:30:00.000Z",
  "updatedAt": "2026-09-29T10:30:00.000Z"
}
```

Frontend xử lý:

```text
Nếu 401:
  Xóa token local
  Chuyển về Auth

Nếu thành công:
  Cập nhật user session
```

#### A.1.5. Cập nhật hồ sơ khách hàng

```http
PATCH /api/auth/me
```

Quyền:

```text
Customer access token
```

Request body:

```json
{
  "fullName": "Nguyen Minh Anh",
  "gender": "MALE"
}
```

Trường có thể gửi:

| Field | Kiểu | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| fullName | string | Không | 2-100 ký tự |
| gender | MALE/FEMALE/OTHER/null | Không | Có thể để null |

Response:

```json
{
  "id": "uuid",
  "phone": "+84912345678",
  "fullName": "Nguyen Minh Anh",
  "avatarUrl": "https://...",
  "gender": "MALE",
  "onboardingStatus": "COMPLETED"
}
```

Frontend xử lý:

```text
Update thành công:
  Cập nhật user trong app state
  Quay lại Profile hoặc hiển thị toast
```

#### A.1.6. Upload avatar khách hàng

```http
POST /api/auth/me/avatar
```

Quyền:

```text
Customer access token
```

Content type:

```http
multipart/form-data
```

Body:

```text
file=<image>
```

Frontend nên xử lý ảnh trước khi upload:

- Chỉ cho chọn ảnh.
- Nén ảnh trước khi gửi nếu mobile.
- Ưu tiên JPG/PNG/WEBP.
- Không gửi ảnh quá lớn.

Response:

```json
{
  "id": "uuid",
  "phone": "+84912345678",
  "fullName": "Nguyen Minh Anh",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
  "gender": "MALE",
  "onboardingStatus": "COMPLETED"
}
```

#### A.1.7. Xóa avatar khách hàng

```http
DELETE /api/auth/me/avatar
```

Quyền:

```text
Customer access token
```

Response:

```json
{
  "id": "uuid",
  "phone": "+84912345678",
  "fullName": "Nguyen Minh Anh",
  "avatarUrl": null,
  "gender": "MALE",
  "onboardingStatus": "COMPLETED"
}
```

### A.2. Onboarding khách hàng

#### A.2.1. Lấy options dựng onboarding

```http
GET /api/onboarding/options
```

Quyền:

```text
Public hoặc customer đều dùng được
```

Dùng ở màn:

- Onboarding lần đầu.
- Màn chỉnh cá nhân hóa trong Profile.

Response:

```json
{
  "categories": [
    {
      "id": "category_uuid",
      "code": "HAIR",
      "name": "Tóc",
      "slug": "toc",
      "description": "Các dịch vụ chăm sóc và tạo kiểu tóc tại nhà.",
      "iconUrl": "scissors",
      "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/category.jpg",
      "sortOrder": 1,
      "services": [
        {
          "id": "service_uuid",
          "code": "MEN_HAIRCUT",
          "name": "Cắt tóc nam",
          "slug": "cat-toc-nam",
          "description": "Dịch vụ cắt tóc nam tại nhà.",
          "iconUrl": "scissors",
          "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/service.jpg",
          "minPriceAmount": 50000,
          "maxPriceAmount": 300000,
          "currencyCode": "VND",
          "defaultDurationMinutes": 45,
          "targetAudience": "MEN",
          "sortOrder": 1
        }
      ]
    }
  ]
}
```

Frontend dùng để:

- Render màn chọn danh mục.
- Render màn chọn dịch vụ.
- Filter dịch vụ theo danh mục đã chọn.
- Hiển thị icon/ảnh nếu có.

#### A.2.2. Lấy onboarding hiện tại

```http
GET /api/me/onboarding
```

Quyền:

```text
Customer access token
```

Response:

```json
{
  "onboardingStatus": "COMPLETED",
  "gender": "MALE",
  "preferredAudience": "MEN",
  "pricePreference": "BALANCED",
  "categoryIds": ["category_uuid"],
  "serviceIds": ["service_uuid"],
  "categories": [
    {
      "id": "category_uuid",
      "code": "HAIR",
      "name": "Tóc",
      "slug": "toc"
    }
  ],
  "services": [
    {
      "id": "service_uuid",
      "name": "Cắt tóc nam",
      "slug": "cat-toc-nam",
      "minPriceAmount": 50000,
      "maxPriceAmount": 300000
    }
  ]
}
```

Dùng ở:

- Profile hiển thị tóm tắt cá nhân hóa.
- Màn chỉnh cá nhân hóa để prefill lựa chọn cũ.

#### A.2.3. Lưu onboarding

```http
PUT /api/me/onboarding
```

Quyền:

```text
Customer access token
```

Có thể gửi từng phần hoặc gửi toàn bộ.

Request body đầy đủ:

```json
{
  "gender": "MALE",
  "preferredAudience": "MEN",
  "pricePreference": "BALANCED",
  "categoryIds": ["category_uuid_1", "category_uuid_2"],
  "serviceIds": ["service_uuid_1", "service_uuid_2"],
  "defaultAddress": {
    "label": "Nhà",
    "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "latitude": 10.7731,
    "longitude": 106.703
  }
}
```

Validation:

| Field | Kiểu | Bắt buộc | Giới hạn |
| --- | --- | --- | --- |
| gender | MALE/FEMALE/OTHER/null | Không | Theo enum |
| preferredAudience | ALL/MEN/WOMEN | Không | Theo enum |
| pricePreference | NO_PREFERENCE/BUDGET/BALANCED/PREMIUM | Không | Theo enum |
| categoryIds | string[] | Không | Tối đa 20 UUID |
| serviceIds | string[] | Không | Tối đa 50 UUID |
| defaultAddress.label | string | Khi gửi defaultAddress | 2-50 ký tự |
| defaultAddress.addressLine | string | Khi gửi defaultAddress | 5-500 ký tự |
| defaultAddress.latitude | number | Khi gửi defaultAddress | Latitude hợp lệ |
| defaultAddress.longitude | number | Khi gửi defaultAddress | Longitude hợp lệ |

Response:

```json
{
  "onboardingStatus": "IN_PROGRESS",
  "gender": "MALE",
  "preferredAudience": "MEN",
  "pricePreference": "BALANCED",
  "categoryIds": ["category_uuid_1"],
  "serviceIds": ["service_uuid_1"],
  "categories": [],
  "services": []
}
```

Frontend xử lý:

```text
Lưu từng bước:
  Gọi PUT sau mỗi bước hoặc lưu local rồi gọi PUT ở bước cuối

Nếu dùng auto-save:
  Cần loading nhỏ, tránh chặn toàn màn hình liên tục
```

#### A.2.4. Hoàn tất onboarding

```http
POST /api/me/onboarding/complete
```

Quyền:

```text
Customer access token
```

Request body:

```json
{}
```

Response:

```json
{
  "onboardingStatus": "COMPLETED",
  "gender": "MALE",
  "preferredAudience": "MEN",
  "pricePreference": "BALANCED",
  "categoryIds": ["category_uuid"],
  "serviceIds": ["service_uuid"]
}
```

Frontend xử lý:

```text
Complete success:
  Gọi GET /auth/me hoặc cập nhật session user
  Chuyển về Home
```

#### A.2.5. Bỏ qua onboarding

```http
POST /api/me/onboarding/skip
```

Quyền:

```text
Customer access token
```

Response:

```json
{
  "message": "Đã bỏ qua onboarding. Bạn có thể hoàn thiện sau.",
  "data": {
    "onboardingStatus": "SKIPPED"
  }
}
```

Frontend xử lý:

```text
Skip success:
  Chuyển Home
  Vẫn hiển thị nút Cá nhân hóa trong Profile để làm lại sau
```

#### A.2.6. Lấy dịch vụ gợi ý theo onboarding

```http
GET /api/me/recommendations/services?limit=20
```

Quyền:

```text
Customer access token
```

Query:

| Field | Kiểu | Bắt buộc | Mặc định | Ghi chú |
| --- | --- | --- | --- | --- |
| limit | number | Không | 20 | 1-50 |

Response:

```json
{
  "personalized": true,
  "services": [
    {
      "id": "service_uuid",
      "code": "MEN_HAIRCUT",
      "name": "Cắt tóc nam",
      "slug": "cat-toc-nam",
      "description": "Dịch vụ cắt tóc nam tại nhà.",
      "iconUrl": "scissors",
      "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/service.jpg",
      "minPriceAmount": 50000,
      "maxPriceAmount": 300000,
      "currencyCode": "VND",
      "defaultDurationMinutes": 45,
      "targetAudience": "MEN",
      "category": {
        "id": "category_uuid",
        "code": "HAIR",
        "name": "Tóc",
        "slug": "toc"
      },
      "recommendationScore": 120,
      "reasons": [
        "Phù hợp giới tính/nhu cầu",
        "Thuộc danh mục đã quan tâm"
      ]
    }
  ]
}
```

Frontend dùng ở:

- Home: section `Dành cho bạn`.
- Onboarding complete screen nếu muốn preview kết quả.

### A.3. Danh mục dịch vụ công khai

#### A.3.1. Lấy danh sách danh mục active

```http
GET /api/categories
```

Quyền:

```text
Public
```

Response:

```json
[
  {
    "id": "category_uuid",
    "code": "HAIR",
    "name": "Tóc",
    "slug": "toc",
    "description": "Các dịch vụ chăm sóc và tạo kiểu tóc tại nhà.",
    "iconUrl": "scissors",
    "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/category.jpg",
    "sortOrder": 1
  }
]
```

Frontend dùng ở:

- Home category chips.
- Services filter.
- Provider application service selection.
- Provider service suggestion category selection.

#### A.3.2. Lấy chi tiết danh mục theo slug

```http
GET /api/categories/:slug
```

Ví dụ:

```http
GET /api/categories/toc
```

Response:

```json
{
  "id": "category_uuid",
  "code": "HAIR",
  "name": "Tóc",
  "slug": "toc",
  "description": "Các dịch vụ chăm sóc và tạo kiểu tóc tại nhà.",
  "iconUrl": "scissors",
  "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/category.jpg",
  "sortOrder": 1
}
```

### A.4. Dịch vụ công khai

#### A.4.1. Lấy danh sách dịch vụ active

```http
GET /api/services
```

Quyền:

```text
Public
```

Query:

| Field | Kiểu | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| categorySlug | string | Không | Slug danh mục, ví dụ `toc` |
| targetAudience | ALL/MEN/WOMEN | Không | Lọc theo nhóm khách |
| search | string | Không | Tối đa 100 ký tự |
| maxPriceAmount | number | Không | Chỉ lấy dịch vụ có giá sàn không vượt quá số này |

Ví dụ:

```http
GET /api/services?categorySlug=toc&targetAudience=MEN&search=cat&maxPriceAmount=300000
```

Response:

```json
[
  {
    "id": "service_uuid",
    "code": "MEN_HAIRCUT",
    "name": "Cắt tóc nam",
    "slug": "cat-toc-nam",
    "description": "Dịch vụ cắt tóc nam tại nhà.",
    "iconUrl": "scissors",
    "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/service.jpg",
    "minPriceAmount": 50000,
    "maxPriceAmount": 300000,
    "currencyCode": "VND",
    "defaultDurationMinutes": 45,
    "targetAudience": "MEN",
    "sortOrder": 1,
    "category": {
      "id": "category_uuid",
      "code": "HAIR",
      "name": "Tóc",
      "slug": "toc"
    }
  }
]
```

Frontend hiển thị:

- Tên dịch vụ.
- Giá: `minPriceAmount - maxPriceAmount`.
- Thời lượng: `defaultDurationMinutes`.
- Nhóm khách: `targetAudience`.
- Danh mục.
- Icon hoặc ảnh bìa.

#### A.4.2. Lấy chi tiết dịch vụ theo slug

```http
GET /api/services/:slug
```

Ví dụ:

```http
GET /api/services/cat-toc-nam
```

Response:

```json
{
  "id": "service_uuid",
  "code": "MEN_HAIRCUT",
  "name": "Cắt tóc nam",
  "slug": "cat-toc-nam",
  "description": "Dịch vụ cắt tóc nam tại nhà.",
  "iconUrl": "scissors",
  "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/service.jpg",
  "minPriceAmount": 50000,
  "maxPriceAmount": 300000,
  "currencyCode": "VND",
  "defaultDurationMinutes": 45,
  "targetAudience": "MEN",
  "category": {
    "id": "category_uuid",
    "name": "Tóc",
    "slug": "toc"
  }
}
```

### A.5. Địa chỉ khách hàng

#### A.5.1. Lấy danh sách địa chỉ

```http
GET /api/me/addresses
```

Quyền:

```text
Customer access token
```

Response:

```json
[
  {
    "id": "address_uuid",
    "type": "HOME",
    "label": "Nhà",
    "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "provinceName": "Thành phố Hồ Chí Minh",
    "districtName": "Quận 1",
    "wardName": "Phường Bến Nghé",
    "streetLine": "12 Nguyễn Huệ",
    "latitude": 10.7731,
    "longitude": 106.703,
    "isMapConfirmed": true,
    "contactName": "Nguyen Minh Anh",
    "contactPhone": "0912345678",
    "note": "Gọi trước khi đến.",
    "isDefault": true,
    "createdAt": "2026-09-29T10:30:00.000Z",
    "updatedAt": "2026-09-29T10:30:00.000Z"
  }
]
```

#### A.5.2. Thêm địa chỉ

```http
POST /api/me/addresses
```

Request body:

```json
{
  "type": "HOME",
  "label": "Nhà",
  "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
  "provinceName": "Thành phố Hồ Chí Minh",
  "districtName": "Quận 1",
  "wardName": "Phường Bến Nghé",
  "streetLine": "12 Nguyễn Huệ",
  "latitude": 10.7731,
  "longitude": 106.703,
  "isMapConfirmed": true,
  "contactName": "Nguyen Minh Anh",
  "contactPhone": "0912345678",
  "note": "Gọi trước khi đến.",
  "isDefault": true
}
```

Validation:

| Field | Bắt buộc | Ghi chú |
| --- | --- | --- |
| type | Không | `HOME`, `WORK`, `OTHER`; mặc định `HOME` |
| label | Có | 2-50 ký tự |
| addressLine | Có | 5-500 ký tự |
| provinceName | Không | Tỉnh/thành phố, 2-100 ký tự |
| districtName | Không | Quận/huyện, 2-100 ký tự |
| wardName | Không | Phường/xã, 2-100 ký tự |
| streetLine | Không | Số nhà và tên đường, 2-250 ký tự |
| latitude | Có | Latitude |
| longitude | Có | Longitude |
| isMapConfirmed | Không | `true` khi người dùng đã xác nhận ghim trên bản đồ; mặc định `false` |
| contactName | Không | 2-100 ký tự |
| contactPhone | Không | Số điện thoại Việt Nam |
| note | Không | Tối đa 300 ký tự |
| isDefault | Không | boolean |

Response:

```json
{
  "message": "Đã thêm địa chỉ.",
  "data": {
    "id": "address_uuid",
    "type": "HOME",
    "label": "Nhà",
    "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "latitude": 10.7731,
    "longitude": 106.703,
    "isMapConfirmed": true,
    "isDefault": true
  }
}
```

#### A.5.3. Sửa địa chỉ

```http
PATCH /api/me/addresses/:id
```

Request body:

```json
{
  "label": "Công ty",
  "note": "Gặp ở sảnh"
}
```

Khi sửa tọa độ, frontend bắt buộc gửi đồng thời `latitude` và `longitude`.
Nếu tọa độ thay đổi mà không gửi `isMapConfirmed`, backend tự đặt lại
`isMapConfirmed = false` để yêu cầu người dùng xác nhận vị trí mới.

Response:

```json
{
  "message": "Đã cập nhật địa chỉ.",
  "data": {
    "id": "address_uuid",
    "label": "Công ty"
  }
}
```

#### A.5.4. Đặt địa chỉ mặc định

```http
PUT /api/me/addresses/:id/default
```

Response:

```json
{
  "message": "Đã đặt làm địa chỉ mặc định.",
  "data": {
    "id": "address_uuid",
    "isDefault": true
  }
}
```

#### A.5.5. Xóa địa chỉ

```http
DELETE /api/me/addresses/:id
```

Response:

```json
{
  "message": "Đã xóa địa chỉ."
}
```

#### A.5.6. Luồng lấy vị trí hiện tại

Backend không thể tự đọc GPS của điện thoại. Mobile thực hiện luồng sau:

1. Xin quyền vị trí từ hệ điều hành.
2. Đọc `latitude` và `longitude` hiện tại.
3. Tra cứu địa chỉ từ tọa độ bằng dịch vụ bản đồ (reverse geocoding).
4. Cho người dùng kiểm tra hoặc chỉnh ghim trên bản đồ.
5. Gọi `POST /api/me/addresses` hoặc `PATCH /api/me/addresses/:id` với tọa độ,
   `addressLine`, các cấp hành chính và `isMapConfirmed = true`.

Nếu người dùng từ chối quyền GPS, giao diện vẫn phải cho phép nhập địa chỉ và
chọn ghim thủ công. Việc tìm thợ gần khách sử dụng tọa độ đã lưu, không suy ra
tọa độ chỉ từ chuỗi `addressLine`.

### A.6. Tìm thợ gần khách

#### A.6.1. Tìm provider theo dịch vụ và vị trí

```http
POST /api/discovery/providers/search
```

Quyền:

```text
Customer access token
```

Request body dùng địa chỉ đã lưu:

```json
{
  "serviceId": "service_uuid",
  "customerAddressId": "address_uuid",
  "radiusKm": 10,
  "limit": 20
}
```

Request body dùng tọa độ trực tiếp:

```json
{
  "serviceId": "service_uuid",
  "latitude": 10.7731,
  "longitude": 106.703,
  "radiusKm": 10,
  "limit": 20
}
```

Validation:

| Field | Bắt buộc | Ghi chú |
| --- | --- | --- |
| serviceId | Có | UUID dịch vụ |
| customerAddressId | Không | Ưu tiên hơn latitude/longitude |
| latitude | Nếu không có customerAddressId | Latitude |
| longitude | Nếu không có customerAddressId | Longitude |
| radiusKm | Không | 1-50, mặc định 10 |
| limit | Không | 1-50, mặc định 20 |

Response:

```json
{
  "data": [
    {
      "id": "provider_uuid",
      "providerType": "INDIVIDUAL",
      "displayName": "Minh Hair Artist",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
      "biography": "Chuyên cắt tóc nam tại nhà.",
      "experienceYears": 5,
      "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
      "distanceKm": 2.4,
      "service": {
        "id": "provider_service_uuid",
        "priceAmount": 150000,
        "durationMinutes": 60,
        "description": "Cắt tóc nam tại nhà.",
        "service": {
          "id": "service_uuid",
          "name": "Cắt tóc nam",
          "slug": "cat-toc-nam",
          "currencyCode": "VND",
          "targetAudience": "MEN"
        }
      }
    }
  ],
  "meta": {
    "radiusKm": 10,
    "count": 1
  }
}
```

Frontend hiển thị:

- Tên provider.
- Avatar.
- Khoảng cách `distanceKm`.
- Giá provider tự đăng ký `service.priceAmount`.
- Thời lượng `service.durationMinutes`.
- Nút xem hồ sơ.
- Nút đặt ngay sau này.

#### A.6.2. Xem hồ sơ provider công khai

```http
GET /api/providers/:id/public
```

Response:

```json
{
  "id": "provider_uuid",
  "providerType": "INDIVIDUAL",
  "displayName": "Minh Hair Artist",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
  "biography": "Chuyên cắt tóc nam tại nhà.",
  "experienceYears": 5,
  "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
  "online": true,
  "workingHours": [
    {
      "dayOfWeek": 1,
      "startMinute": 480,
      "endMinute": 1020
    }
  ],
  "services": [
    {
      "id": "provider_service_uuid",
      "priceAmount": 150000,
      "durationMinutes": 60,
      "description": "Cắt tóc nam tại nhà.",
      "service": {
        "id": "service_uuid",
        "name": "Cắt tóc nam",
        "slug": "cat-toc-nam",
        "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/service.jpg",
        "currencyCode": "VND",
        "targetAudience": "MEN",
        "category": {
          "name": "Tóc",
          "slug": "toc"
        }
      }
    }
  ]
}
```

### A.7. Đăng ký đối tác

#### A.7.1. Lấy điều khoản hiện tại

```http
GET /api/provider-applications/terms/current
```

Quyền:

```text
Customer access token
```

Response:

```json
{
  "version": "2026-09-01"
}
```

Frontend dùng ở:

- Màn điều khoản đăng ký đối tác.

#### A.7.2. Lấy danh sách hồ sơ đăng ký của user

```http
GET /api/provider-applications
```

Quyền:

```text
Customer access token
```

Response:

```json
[
  {
    "id": "application_uuid",
    "providerType": "INDIVIDUAL",
    "status": "PENDING_REVIEW",
    "legalFullName": "Nguyen Minh Anh",
    "organizationName": null,
    "revisionNumber": 1,
    "submittedAt": "2026-09-29T10:30:00.000Z",
    "reviewedAt": null,
    "decisionReason": null,
    "withdrawnAt": null,
    "createdAt": "2026-09-29T10:30:00.000Z",
    "updatedAt": "2026-09-29T10:30:00.000Z",
    "_count": {
      "documents": 5,
      "services": 2
    }
  }
]
```

Frontend dùng để:

- Kiểm tra user có hồ sơ đang làm dở không.
- Hiển thị trạng thái hồ sơ gần nhất.

#### A.7.3. Tạo hồ sơ đăng ký

```http
POST /api/provider-applications
```

Quyền:

```text
Customer access token
```

Request body:

```json
{
  "providerType": "INDIVIDUAL"
}
```

Hoặc:

```json
{
  "providerType": "ORGANIZATION"
}
```

Response:

```json
{
  "id": "application_uuid",
  "providerType": "INDIVIDUAL",
  "status": "DRAFT",
  "revisionNumber": 0,
  "legalFullName": null,
  "birthDate": null,
  "gender": null,
  "email": null,
  "biography": null,
  "nationalIdLast4": null,
  "experienceYears": null,
  "organizationName": null,
  "submittedAt": null,
  "reviewedAt": null,
  "decisionReason": null,
  "createdAt": "2026-09-29T10:30:00.000Z",
  "updatedAt": "2026-09-29T10:30:00.000Z",
  "checks": [],
  "documents": [],
  "services": []
}
```

Frontend xử lý:

```text
Tạo xong:
  Lưu applicationId
  Chuyển sang bước điền thông tin
```

#### A.7.4. Lấy chi tiết hồ sơ đăng ký

```http
GET /api/provider-applications/:id
```

Quyền:

```text
Customer access token, chỉ chủ hồ sơ xem được
```

Response:

```json
{
  "id": "application_uuid",
  "providerType": "INDIVIDUAL",
  "status": "DRAFT",
  "revisionNumber": 0,
  "legalFullName": "Nguyen Van A",
  "birthDate": "1995-08-20",
  "gender": "MALE",
  "email": "provider@example.com",
  "biography": "Thợ tóc nam có 5 năm kinh nghiệm.",
  "nationalIdLast4": "2345",
  "experienceYears": 5,
  "organizationName": null,
  "submittedAt": null,
  "reviewedAt": null,
  "decisionReason": null,
  "checks": [
    {
      "section": "IDENTITY",
      "status": "PENDING",
      "reviewNote": null,
      "reviewedAt": null
    }
  ],
  "documents": [
    {
      "id": "document_uuid",
      "type": "PORTRAIT",
      "fileFormat": "jpg",
      "isPublicCandidate": false,
      "status": "PENDING",
      "reviewNote": null,
      "createdAt": "2026-09-29T10:30:00.000Z"
    }
  ],
  "services": [
    {
      "id": "application_service_uuid",
      "serviceId": "service_uuid",
      "proposedPriceAmount": 150000,
      "durationMinutes": 60,
      "description": "Cắt tóc nam tại nhà.",
      "status": "PENDING",
      "service": {
        "id": "service_uuid",
        "name": "Cắt tóc nam",
        "targetAudience": "MEN"
      }
    }
  ]
}
```

Frontend dùng để:

- Prefill form.
- Hiển thị checklist giấy tờ.
- Hiển thị phần cần bổ sung khi `NEEDS_CHANGES`.

#### A.7.5. Cập nhật thông tin hồ sơ đăng ký

```http
PATCH /api/provider-applications/:id
```

Quyền:

```text
Customer access token, chủ hồ sơ
```

Request body cá nhân:

```json
{
  "legalFullName": "Nguyen Van A",
  "birthDate": "1995-08-20",
  "gender": "MALE",
  "email": "provider@example.com",
  "biography": "Thợ tóc nam có 5 năm kinh nghiệm.",
  "nationalIdNumber": "001095012345",
  "experienceYears": 5
}
```

Request body tổ chức:

```json
{
  "organizationName": "Lambe Beauty Studio",
  "taxCode": "0123456789",
  "businessRegistrationNumber": "BRN123456",
  "registeredAddress": "12 Nguyễn Huệ, Quận 1, TP.HCM",
  "representativeName": "Nguyen Van A",
  "email": "provider@example.com",
  "biography": "Studio chuyên làm tóc, nail và makeup tại nhà."
}
```

Validation đáng chú ý:

| Field | Ghi chú |
| --- | --- |
| legalFullName | 2-100 ký tự |
| birthDate | `YYYY-MM-DD` |
| email | Email hợp lệ, tối đa 254 ký tự |
| biography | Tối đa 1000 ký tự |
| nationalIdNumber | Đúng 12 chữ số |
| experienceYears | 0-80 |
| organizationName | 2-200 ký tự |
| registeredAddress | 5-500 ký tự |

Response:

```json
{
  "success": true,
  "data": {
    "id": "application_uuid",
    "status": "DRAFT",
    "legalFullName": "Nguyen Van A",
    "nationalIdLast4": "2345"
  }
}
```

Lưu ý:

- Backend không trả lại full CCCD, chỉ trả `nationalIdLast4` để bảo mật.
- Frontend không nên lưu CCCD plaintext ở local storage.

#### A.7.6. Thêm dịch vụ có sẵn vào hồ sơ

```http
POST /api/provider-applications/:id/services
```

Request body:

```json
{
  "serviceId": "service_uuid",
  "proposedPriceAmount": 150000,
  "durationMinutes": 60,
  "description": "Cắt tóc nam tại nhà, tư vấn kiểu phù hợp khuôn mặt."
}
```

Validation:

| Field | Ghi chú |
| --- | --- |
| serviceId | UUID dịch vụ trong hệ thống |
| proposedPriceAmount | 1 đến 2 tỷ VND |
| durationMinutes | 15-720 phút |
| description | Tối đa 1000 ký tự |

Response:

```json
{
  "success": true,
  "data": {
    "id": "application_service_uuid",
    "serviceId": "service_uuid",
    "proposedPriceAmount": 150000,
    "durationMinutes": 60,
    "description": "Cắt tóc nam tại nhà.",
    "status": "PENDING",
    "service": {
      "id": "service_uuid",
      "name": "Cắt tóc nam",
      "minPriceAmount": 50000,
      "maxPriceAmount": 300000
    }
  }
}
```

UI nên validate giá:

- Cảnh báo nếu giá ngoài khoảng giá sàn/trần của dịch vụ.
- Không nhất thiết chặn nếu backend chưa chặn, nhưng nên hướng người dùng nhập hợp lý.

#### A.7.7. Sửa dịch vụ trong hồ sơ

```http
PATCH /api/provider-applications/:id/services/:itemId
```

Request body:

```json
{
  "proposedPriceAmount": 180000,
  "durationMinutes": 75,
  "description": "Cập nhật mô tả dịch vụ."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "application_service_uuid",
    "proposedPriceAmount": 180000,
    "durationMinutes": 75,
    "status": "PENDING"
  }
}
```

#### A.7.8. Xóa dịch vụ khỏi hồ sơ

```http
DELETE /api/provider-applications/:id/services/:itemId
```

Response:

```json
{
  "success": true,
  "message": "Đã xóa dịch vụ khỏi hồ sơ."
}
```

#### A.7.9. Đề xuất dịch vụ mới

```http
POST /api/provider-applications/:id/service-suggestions
```

Request body:

```json
{
  "categoryId": "category_uuid",
  "name": "Tạo kiểu tóc đi tiệc",
  "description": "Tạo kiểu tóc nhanh tại nhà cho sự kiện.",
  "proposedPriceAmount": 180000,
  "durationMinutes": 60
}
```

Validation:

| Field | Ghi chú |
| --- | --- |
| categoryId | UUID danh mục |
| name | 2-100 ký tự |
| description | Tối đa 1000 ký tự |
| proposedPriceAmount | 1 đến 2 tỷ VND |
| durationMinutes | 15-720 phút |

Response:

```json
{
  "success": true,
  "data": {
    "id": "suggestion_uuid",
    "categoryId": "category_uuid",
    "name": "Tạo kiểu tóc đi tiệc",
    "description": "Tạo kiểu tóc nhanh tại nhà cho sự kiện.",
    "proposedPriceAmount": 180000,
    "durationMinutes": 60,
    "status": "PENDING"
  }
}
```

Frontend hiển thị:

```text
Đề xuất này sẽ được admin xem xét.
Nếu được duyệt, admin sẽ chuẩn hóa và đưa vào danh sách dịch vụ chính thức.
```

#### A.7.10. Sửa đề xuất dịch vụ mới

```http
PATCH /api/provider-applications/:id/service-suggestions/:suggestionId
```

Request body:

```json
{
  "name": "Tạo kiểu tóc dự tiệc",
  "proposedPriceAmount": 200000
}
```

#### A.7.11. Xóa đề xuất dịch vụ mới

```http
DELETE /api/provider-applications/:id/service-suggestions/:suggestionId
```

Response:

```json
{
  "success": true,
  "message": "Đã xóa đề xuất dịch vụ."
}
```

#### A.7.12. Upload giấy tờ hồ sơ

```http
POST /api/provider-applications/:id/documents/:type
```

Quyền:

```text
Customer access token, chủ hồ sơ
```

Content type:

```http
multipart/form-data
```

Body:

```text
file=<image>
```

Query optional:

```http
?applicationServiceId=<application_service_uuid>
```

Dùng `applicationServiceId` khi giấy tờ liên quan đến một dịch vụ cụ thể, ví dụ chứng chỉ nghề cho dịch vụ nail.

Loại tài liệu UI nên hỗ trợ:

| Nhóm | Gợi ý type | Hiển thị |
| --- | --- | --- |
| Ảnh chân dung | PORTRAIT | Ảnh công khai cho khách |
| CCCD trước | NATIONAL_ID_FRONT | Chỉ kiểm duyệt |
| CCCD sau | NATIONAL_ID_BACK | Chỉ kiểm duyệt |
| Selfie xác minh | SELFIE_VERIFICATION | Chỉ kiểm duyệt |
| Chứng chỉ nghề | CERTIFICATE | Có thể gắn với dịch vụ |
| Portfolio | PORTFOLIO | Có thể dùng công khai sau này |
| GPLX | DRIVER_LICENSE | Nếu có dùng xe |
| Đăng ký kinh doanh | BUSINESS_LICENSE | Cho tổ chức |

Lưu ý: Tên `type` thực tế phải khớp enum backend. Nếu frontend chưa chắc chắn, xem Swagger `/docs` để lấy enum chính xác.

Response:

```json
{
  "success": true,
  "data": {
    "id": "document_uuid",
    "type": "PORTRAIT",
    "fileFormat": "jpg",
    "isPublicCandidate": false,
    "status": "PENDING",
    "reviewNote": null,
    "createdAt": "2026-09-29T10:30:00.000Z"
  }
}
```

UI xử lý:

```text
Upload thành công:
  Cập nhật trạng thái giấy tờ
  Không hiển thị URL nhạy cảm trực tiếp nếu backend không trả URL
```

#### A.7.13. Xóa giấy tờ

```http
DELETE /api/provider-applications/:id/documents/:documentId
```

Response:

```json
{
  "success": true,
  "message": "Đã xóa tài liệu khỏi hồ sơ."
}
```

#### A.7.14. Lấy URL xem giấy tờ

```http
GET /api/provider-applications/:id/documents/:documentId/access
```

Response:

```json
{
  "url": "https://res.cloudinary.com/demo/image/authenticated/signed-url.jpg"
}
```

UI dùng:

- Preview lại giấy tờ user đã upload.
- Không cache lâu URL signed nếu backend trả URL tạm thời.

#### A.7.15. Đồng ý điều khoản

```http
POST /api/provider-applications/:id/terms/accept
```

Request body:

```json
{
  "accepted": true
}
```

Validation:

- `accepted` bắt buộc là `true`.

Response:

```json
{
  "success": true,
  "data": {
    "applicationId": "application_uuid",
    "termsVersion": "2026-09-01",
    "acceptedAt": "2026-09-29T10:30:00.000Z"
  }
}
```

#### A.7.16. Gửi hồ sơ xét duyệt

```http
POST /api/provider-applications/:id/submit
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "application_uuid",
    "status": "PENDING_REVIEW",
    "submittedAt": "2026-09-29T10:30:00.000Z",
    "revisionNumber": 1
  }
}
```

Frontend xử lý:

```text
Submit success:
  Chuyển sang màn trạng thái hồ sơ
  Hiển thị "Đang chờ kiểm duyệt"
```

#### A.7.17. Rút hồ sơ

```http
POST /api/provider-applications/:id/withdraw
```

Response:

```json
{
  "success": true,
  "message": "Đã rút hồ sơ đăng ký."
}
```

### A.8. Thiết lập provider sau khi được duyệt

#### A.8.1. Lấy setup provider

```http
GET /api/me/provider/setup
```

Quyền:

```text
Customer access token của user đã được duyệt provider
```

Response:

```json
{
  "id": "provider_uuid",
  "providerType": "INDIVIDUAL",
  "displayName": "Minh Hair Artist",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
  "biography": "Chuyên cắt tóc nam tại nhà.",
  "experienceYears": 5,
  "status": "ACTIVE",
  "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
  "serviceAreaLatitude": 21.0368,
  "serviceAreaLongitude": 105.7827,
  "serviceRadiusKm": 10,
  "setupCompletedAt": "2026-09-29T10:30:00.000Z",
  "workingHours": [
    {
      "dayOfWeek": 1,
      "startMinute": 480,
      "endMinute": 1020
    }
  ],
  "services": [
    {
      "id": "provider_service_uuid",
      "priceAmount": 150000,
      "durationMinutes": 60,
      "description": "Cắt tóc nam tại nhà.",
      "status": "ACTIVE",
      "service": {
        "id": "service_uuid",
        "name": "Cắt tóc nam",
        "slug": "cat-toc-nam"
      }
    }
  ]
}
```

Frontend dùng:

- Màn setup sau duyệt.
- Màn bật/tắt dịch vụ nhận đơn.

#### A.8.2. Cập nhật setup provider

```http
PUT /api/me/provider/setup
```

Request body:

```json
{
  "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
  "serviceAreaLatitude": 21.0368,
  "serviceAreaLongitude": 105.7827,
  "serviceRadiusKm": 10,
  "workingHours": [
    {
      "dayOfWeek": 1,
      "startMinute": 480,
      "endMinute": 1020
    }
  ],
  "enabledServiceIds": ["provider_service_uuid"]
}
```

Validation:

| Field | Ghi chú |
| --- | --- |
| serviceAreaName | 2-200 ký tự |
| serviceAreaLatitude | Latitude |
| serviceAreaLongitude | Longitude |
| serviceRadiusKm | 1-50 |
| workingHours | 1-21 dòng |
| workingHours.dayOfWeek | 0-6, 0 là Chủ nhật |
| workingHours.startMinute | 0-1439 |
| workingHours.endMinute | 1-1440 |
| enabledServiceIds | 1-20 UUID, là provider service id |

Response:

```json
{
  "id": "provider_uuid",
  "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
  "serviceRadiusKm": 10,
  "setupCompletedAt": "2026-09-29T10:30:00.000Z",
  "workingHours": [],
  "services": []
}
```

#### A.8.3. Lấy trạng thái online

```http
GET /api/me/provider/availability
```

Response:

```json
{
  "online": true,
  "session": {
    "id": "session_uuid",
    "startedAt": "2026-09-29T10:30:00.000Z",
    "lastHeartbeatAt": "2026-09-29T10:30:00.000Z"
  },
  "heartbeatTtlSeconds": 120
}
```

#### A.8.4. Bật online

```http
POST /api/me/provider/availability/online
```

Request body:

```json
{
  "latitude": 21.0368,
  "longitude": 105.7827
}
```

Response:

```json
{
  "online": true,
  "session": {
    "id": "session_uuid",
    "startedAt": "2026-09-29T10:30:00.000Z",
    "lastHeartbeatAt": "2026-09-29T10:30:00.000Z"
  },
  "heartbeatTtlSeconds": 120
}
```

#### A.8.5. Gửi heartbeat vị trí

```http
PUT /api/me/provider/availability/heartbeat
```

Request body:

```json
{
  "latitude": 21.0369,
  "longitude": 105.7828
}
```

Response:

```json
{
  "online": true,
  "lastHeartbeatAt": "2026-09-29T10:30:00.000Z"
}
```

Frontend xử lý:

```text
Khi thợ online:
  Gửi heartbeat định kỳ trước heartbeatTtlSeconds
  Nếu app bị tắt hoặc mất mạng, backend sẽ coi thợ offline sau TTL
```

#### A.8.6. Tắt online

```http
POST /api/me/provider/availability/offline
```

Response:

```json
{
  "online": false
}
```

### A.9. Admin auth

#### A.9.1. Đăng nhập admin/internal account

```http
POST /api/admin/auth/login
```

Quyền:

```text
Public, dành riêng admin/moderator/support
```

Request body:

```json
{
  "username": "admin",
  "password": "password"
}
```

Response:

```json
{
  "accessToken": "internal_access_token",
  "account": {
    "id": "uuid",
    "username": "admin",
    "fullName": "System Admin",
    "email": "admin@lambe.vn",
    "roles": ["ADMIN"],
    "mustChangePassword": false,
    "lastLoginAt": "2026-09-29T10:30:00.000Z"
  }
}
```

Frontend admin lưu ý:

- Token admin khác token customer.
- Không dùng API `/api/auth/me` cho admin.
- Dùng `/api/admin/auth/me`.

#### A.9.2. Lấy admin hiện tại

```http
GET /api/admin/auth/me
```

Header:

```http
Authorization: Bearer <internalAccessToken>
```

#### A.9.3. Refresh token admin

```http
POST /api/admin/auth/refresh
```

#### A.9.4. Logout admin

```http
POST /api/admin/auth/logout
```

### A.10. Admin quản lý danh mục

#### A.10.1. Danh sách danh mục admin

```http
GET /api/admin/categories?search=toc&status=ACTIVE&page=1&limit=20
```

Quyền:

```text
Internal access token
```

Query:

| Field | Kiểu | Mặc định |
| --- | --- | --- |
| search | string | Không |
| status | ACTIVE/INACTIVE/ARCHIVED | Không |
| page | number | 1 |
| limit | number | 20 |

Response:

```json
{
  "data": [
    {
      "id": "category_uuid",
      "code": "HAIR",
      "name": "Tóc",
      "slug": "toc",
      "description": "Các dịch vụ chăm sóc và tạo kiểu tóc tại nhà.",
      "iconUrl": "scissors",
      "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/category.jpg",
      "sortOrder": 1,
      "status": "ACTIVE",
      "createdAt": "2026-09-29T10:30:00.000Z",
      "updatedAt": "2026-09-29T10:30:00.000Z",
      "createdBy": {
        "id": "admin_uuid",
        "username": "admin",
        "fullName": "System Admin"
      },
      "updatedBy": {
        "id": "admin_uuid",
        "username": "admin",
        "fullName": "System Admin"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### A.10.2. Tạo danh mục

```http
POST /api/admin/categories
```

Request body:

```json
{
  "code": "HAIR",
  "name": "Tóc",
  "slug": "toc",
  "description": "Các dịch vụ chăm sóc và tạo kiểu tóc tại nhà.",
  "iconUrl": "scissors",
  "sortOrder": 1
}
```

Validation:

| Field | Ghi chú |
| --- | --- |
| code | Chữ hoa, số, `_`, 2-50 ký tự, bắt đầu bằng chữ |
| name | 2-100 ký tự |
| slug | chữ thường, số, dấu `-`, 2-120 ký tự |
| description | Tối đa 500 ký tự |
| iconUrl | Tên icon hoặc URL |
| sortOrder | >= 0 |

#### A.10.3. Cập nhật danh mục

```http
PATCH /api/admin/categories/:id
```

Request body có thể gửi một phần:

```json
{
  "name": "Dịch vụ tóc",
  "description": "Cắt, gội, tạo kiểu tóc tại nhà",
  "iconUrl": "content_cut"
}
```

#### A.10.4. Đổi trạng thái danh mục

```http
PATCH /api/admin/categories/:id/status
```

Request body:

```json
{
  "status": "INACTIVE"
}
```

Frontend dùng:

- Tạm khóa danh mục: `INACTIVE`.
- Mở lại: `ACTIVE`.
- Lưu trữ: `ARCHIVED`.

#### A.10.5. Upload ảnh bìa danh mục

```http
POST /api/admin/categories/:id/cover-image
```

Content type:

```http
multipart/form-data
```

Body:

```text
file=<image>
```

#### A.10.6. Xóa ảnh bìa danh mục

```http
DELETE /api/admin/categories/:id/cover-image
```

#### A.10.7. Sắp xếp danh mục

```http
PATCH /api/admin/categories/reorder
```

Request body:

```json
{
  "items": [
    {
      "id": "category_uuid_1",
      "sortOrder": 1
    },
    {
      "id": "category_uuid_2",
      "sortOrder": 2
    }
  ]
}
```

### A.11. Admin quản lý dịch vụ

#### A.11.1. Danh sách dịch vụ admin

```http
GET /api/admin/services?search=cat&categoryId=category_uuid&status=ACTIVE&targetAudience=MEN&page=1&limit=20
```

Query:

| Field | Kiểu | Mặc định |
| --- | --- | --- |
| search | string | Không |
| categoryId | UUID | Không |
| status | ACTIVE/INACTIVE/ARCHIVED | Không |
| targetAudience | ALL/MEN/WOMEN | Không |
| page | number | 1 |
| limit | number | 20 |

Response:

```json
{
  "data": [
    {
      "id": "service_uuid",
      "categoryId": "category_uuid",
      "code": "MEN_HAIRCUT",
      "name": "Cắt tóc nam",
      "slug": "cat-toc-nam",
      "description": "Dịch vụ cắt tóc nam tại nhà.",
      "iconUrl": "scissors",
      "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/service.jpg",
      "minPriceAmount": 50000,
      "maxPriceAmount": 300000,
      "currencyCode": "VND",
      "defaultDurationMinutes": 45,
      "targetAudience": "MEN",
      "sortOrder": 1,
      "requiresCertificate": false,
      "minPortfolioImages": 1,
      "minExperienceYears": 1,
      "status": "ACTIVE",
      "category": {
        "id": "category_uuid",
        "code": "HAIR",
        "name": "Tóc",
        "slug": "toc"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### A.11.2. Tạo dịch vụ

```http
POST /api/admin/services
```

Request body:

```json
{
  "categoryId": "category_uuid",
  "code": "MEN_HAIRCUT",
  "name": "Cắt tóc nam",
  "slug": "cat-toc-nam",
  "description": "Dịch vụ cắt tóc nam tại nhà.",
  "iconUrl": "scissors",
  "minPriceAmount": 50000,
  "maxPriceAmount": 300000,
  "defaultDurationMinutes": 45,
  "targetAudience": "MEN",
  "sortOrder": 1,
  "requiresCertificate": false,
  "minPortfolioImages": 1,
  "minExperienceYears": 1
}
```

Validation đáng chú ý:

| Field | Ghi chú |
| --- | --- |
| categoryId | UUID danh mục |
| code | Chữ hoa, số, `_`, 2-50 ký tự |
| name | 2-100 ký tự |
| slug | chữ thường, số, dấu `-`, 2-120 ký tự |
| minPriceAmount | 1 đến 2 tỷ VND |
| maxPriceAmount | 1 đến 2 tỷ VND |
| defaultDurationMinutes | 15-720 phút |
| targetAudience | ALL/MEN/WOMEN |
| requiresCertificate | Dịch vụ có yêu cầu chứng chỉ không |
| minPortfolioImages | Số ảnh portfolio tối thiểu |
| minExperienceYears | Số năm kinh nghiệm tối thiểu |

UI nên chặn:

- `maxPriceAmount` nhỏ hơn `minPriceAmount`.
- Slug sai format.
- Code sai format.

#### A.11.3. Cập nhật dịch vụ

```http
PATCH /api/admin/services/:id
```

Request body có thể gửi một phần:

```json
{
  "categoryId": "category_uuid_moi",
  "name": "Cắt tóc nam tại nhà",
  "minPriceAmount": 80000,
  "maxPriceAmount": 350000,
  "targetAudience": "MEN"
}
```

Lưu ý:

- Dịch vụ có thể cập nhật lại danh mục bằng `categoryId`.

#### A.11.4. Đổi trạng thái dịch vụ

```http
PATCH /api/admin/services/:id/status
```

Request body:

```json
{
  "status": "INACTIVE"
}
```

Frontend dùng:

- Tạm khóa dịch vụ: `INACTIVE`.
- Mở lại: `ACTIVE`.
- Lưu trữ: `ARCHIVED`.

#### A.11.5. Upload ảnh bìa dịch vụ

```http
POST /api/admin/services/:id/cover-image
```

Content type:

```http
multipart/form-data
```

Body:

```text
file=<image>
```

#### A.11.6. Xóa ảnh bìa dịch vụ

```http
DELETE /api/admin/services/:id/cover-image
```

#### A.11.7. Sắp xếp dịch vụ trong danh mục

```http
PATCH /api/admin/categories/:categoryId/services/reorder
```

Request body:

```json
{
  "items": [
    {
      "id": "service_uuid_1",
      "sortOrder": 1
    },
    {
      "id": "service_uuid_2",
      "sortOrder": 2
    }
  ]
}
```

### A.12. Admin kiểm duyệt hồ sơ đối tác

#### A.12.1. Danh sách hồ sơ đăng ký

```http
GET /api/admin/provider-applications?search=nguyen&status=PENDING_REVIEW&providerType=INDIVIDUAL&page=1&limit=20
```

Response:

```json
{
  "data": [
    {
      "id": "application_uuid",
      "providerType": "INDIVIDUAL",
      "status": "PENDING_REVIEW",
      "legalFullName": "Nguyen Minh Anh",
      "organizationName": null,
      "revisionNumber": 1,
      "submittedAt": "2026-09-29T10:30:00.000Z",
      "reviewedAt": null,
      "decisionReason": null,
      "_count": {
        "documents": 5,
        "services": 2
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### A.12.2. Chi tiết hồ sơ admin

```http
GET /api/admin/provider-applications/:id
```

Response:

```json
{
  "id": "application_uuid",
  "providerType": "INDIVIDUAL",
  "status": "PENDING_REVIEW",
  "legalFullName": "Nguyen Van A",
  "birthDate": "1995-08-20",
  "gender": "MALE",
  "email": "provider@example.com",
  "biography": "Thợ tóc nam có 5 năm kinh nghiệm.",
  "nationalIdLast4": "2345",
  "experienceYears": 5,
  "checks": [],
  "documents": [],
  "services": [],
  "serviceSuggestions": []
}
```

UI admin cần chia tab:

- Tổng quan.
- Danh tính.
- Dịch vụ đăng ký.
- Đề xuất dịch vụ mới.
- Giấy tờ.
- Lịch sử kiểm duyệt.

#### A.12.3. Duyệt từng nhóm kiểm tra

```http
PATCH /api/admin/provider-applications/:id/checks/:section
```

Section:

```ts
IDENTITY | PORTRAIT | EXPERTISE | SERVICES | TERMS
```

Request body:

```json
{
  "status": "VERIFIED",
  "reviewNote": "Thông tin hợp lệ."
}
```

Status cho review item:

```ts
VERIFIED | NEEDS_CHANGES | REJECTED
```

Response:

```json
{
  "id": "check_uuid",
  "applicationId": "application_uuid",
  "section": "IDENTITY",
  "status": "VERIFIED",
  "reviewNote": "Thông tin hợp lệ.",
  "reviewedById": "admin_uuid",
  "reviewedAt": "2026-09-29T10:30:00.000Z"
}
```

#### A.12.4. Duyệt tài liệu

```http
PATCH /api/admin/provider-applications/:id/documents/:documentId/review
```

Request body:

```json
{
  "status": "VERIFIED",
  "reviewNote": "Ảnh rõ, hợp lệ."
}
```

Response:

```json
{
  "success": true,
  "message": "Đã xét duyệt tài liệu."
}
```

#### A.12.5. Duyệt dịch vụ thợ đăng ký

```http
PATCH /api/admin/provider-applications/:id/services/:itemId/review
```

Request body:

```json
{
  "status": "VERIFIED",
  "reviewNote": "Giá phù hợp."
}
```

Response:

```json
{
  "success": true,
  "message": "Đã xét duyệt dịch vụ đăng ký."
}
```

#### A.12.6. Admin duyệt đề xuất dịch vụ mới

```http
POST /api/admin/provider-applications/:id/service-suggestions/:suggestionId/approve
```

Request body giống tạo dịch vụ chính thức:

```json
{
  "categoryId": "category_uuid",
  "code": "PARTY_HAIR_STYLING",
  "name": "Tạo kiểu tóc đi tiệc",
  "slug": "tao-kieu-toc-di-tiec",
  "description": "Tạo kiểu tóc tại nhà cho sự kiện.",
  "iconUrl": "styler",
  "minPriceAmount": 100000,
  "maxPriceAmount": 500000,
  "defaultDurationMinutes": 60,
  "targetAudience": "ALL",
  "sortOrder": 10,
  "requiresCertificate": false,
  "minPortfolioImages": 1,
  "minExperienceYears": 1
}
```

Response:

```json
{
  "success": true,
  "data": {
    "service": {
      "id": "new_service_uuid",
      "name": "Tạo kiểu tóc đi tiệc",
      "status": "ACTIVE"
    },
    "applicationService": {
      "id": "application_service_uuid",
      "serviceId": "new_service_uuid",
      "status": "VERIFIED"
    }
  }
}
```

Frontend admin hiểu:

- Khi approve suggestion, backend tạo dịch vụ chính thức.
- Đồng thời thêm dịch vụ đó vào hồ sơ đăng ký của thợ.

#### A.12.7. Admin từ chối đề xuất dịch vụ mới

```http
POST /api/admin/provider-applications/:id/service-suggestions/:suggestionId/reject
```

Request body:

```json
{
  "reason": "Dịch vụ đã tồn tại trong hệ thống."
}
```

Response:

```json
{
  "success": true,
  "message": "Đã từ chối đề xuất.",
  "data": {
    "id": "suggestion_uuid",
    "status": "REJECTED",
    "reviewNote": "Dịch vụ đã tồn tại trong hệ thống."
  }
}
```

#### A.12.8. Yêu cầu bổ sung hồ sơ

```http
POST /api/admin/provider-applications/:id/request-changes
```

Request body:

```json
{
  "reason": "Ảnh CCCD mặt trước bị mờ, vui lòng tải lại."
}
```

Response:

```json
{
  "success": true,
  "message": "Đã gửi yêu cầu bổ sung hồ sơ."
}
```

Frontend applicant thấy:

```text
Status = NEEDS_CHANGES
Hiển thị decisionReason/reviewNote để người dùng biết cần sửa gì
```

#### A.12.9. Từ chối hồ sơ

```http
POST /api/admin/provider-applications/:id/reject
```

Request body:

```json
{
  "reason": "Thông tin xác minh không hợp lệ."
}
```

Response:

```json
{
  "success": true,
  "message": "Đã từ chối hồ sơ đăng ký."
}
```

#### A.12.10. Duyệt hồ sơ

```http
POST /api/admin/provider-applications/:id/approve
```

Response:

```json
{
  "success": true,
  "data": {
    "providerProfile": {
      "id": "provider_uuid",
      "userId": "user_uuid",
      "sourceApplicationId": "application_uuid",
      "providerType": "INDIVIDUAL",
      "displayName": "Nguyen Van A",
      "avatarUrl": null,
      "biography": "Thợ tóc nam có 5 năm kinh nghiệm.",
      "experienceYears": 5,
      "status": "SETUP_REQUIRED",
      "wallet": {
        "id": "wallet_uuid",
        "balanceAmount": 0,
        "heldAmount": 0,
        "currencyCode": "VND"
      },
      "services": [
        {
          "id": "provider_service_uuid",
          "providerId": "provider_uuid",
          "serviceId": "service_uuid",
          "priceAmount": 150000,
          "durationMinutes": 60,
          "status": "INACTIVE"
        }
      ]
    }
  }
}
```

Frontend applicant sau khi được duyệt:

```text
Profile / Provider application status
→ Hiển thị đã được duyệt
→ CTA: Thiết lập khu vực phục vụ
```

### A.13. Admin quản lý khách hàng

#### A.13.1. Danh sách khách hàng

```http
GET /api/admin/customers?search=nguyen&page=1&limit=20
```

Response:

```json
{
  "data": [
    {
      "id": "user_uuid",
      "phone": "+84912345678",
      "phoneVerifiedAt": "2026-09-29T10:30:00.000Z",
      "fullName": "Nguyen Minh Anh",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
      "status": "ACTIVE",
      "roles": ["CUSTOMER"],
      "customerProfile": {
        "gender": "MALE",
        "preferredAudience": "MEN",
        "pricePreference": "BALANCED",
        "onboardingStatus": "COMPLETED",
        "completedAt": "2026-09-29T10:30:00.000Z",
        "skippedAt": null
      },
      "providerProfile": null,
      "_count": {
        "customerAddresses": 1,
        "providerApplications": 0
      },
      "createdAt": "2026-09-29T10:30:00.000Z",
      "updatedAt": "2026-09-29T10:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### A.13.2. Chi tiết khách hàng

```http
GET /api/admin/customers/:id
```

#### A.13.3. Hoạt động khách hàng

```http
GET /api/admin/customers/:id/activity?page=1&limit=20
```

Response item:

```json
{
  "id": "activity_uuid",
  "actorUserId": "user_uuid",
  "actorInternalAccountId": null,
  "action": "USER_PROFILE_UPDATED",
  "resourceType": "User",
  "resourceId": "user_uuid",
  "result": "SUCCESS",
  "metadata": {
    "changedFields": ["fullName"]
  },
  "createdAt": "2026-09-29T10:30:00.000Z"
}
```

#### A.13.4. Hồ sơ đăng ký đối tác của khách

```http
GET /api/admin/customers/:id/provider-applications
```

#### A.13.5. Đổi trạng thái khách hàng

```http
PATCH /api/admin/customers/:id/status
```

Request body:

```json
{
  "status": "SUSPENDED"
}
```

Lưu ý: enum trạng thái user cần kiểm tra trong Swagger để dùng đúng các giá trị backend đang hỗ trợ.

### A.14. Upload ảnh admin

```http
POST /api/admin/upload/image?folder=categories
```

Quyền:

```text
Internal access token, admin/moderator
```

Content type:

```http
multipart/form-data
```

Body:

```text
file=<image>
```

Query:

| folder | Ý nghĩa |
| --- | --- |
| general | Ảnh chung |
| categories | Ảnh danh mục |
| profiles | Ảnh hồ sơ |
| portfolios | Ảnh portfolio |

Response:

```json
{
  "url": "https://res.cloudinary.com/demo/image/upload/lambe/general/image.jpg",
  "publicId": "lambe/general/image",
  "width": 1200,
  "height": 900,
  "format": "jpg"
}
```

### A.15. Health check

```http
GET /api/health
```

Response:

```json
{
  "status": "ok",
  "database": {
    "status": "up"
  },
  "cache": {
    "status": "up"
  }
}
```

Frontend có thể dùng ở:

- Màn debug.
- Kiểm tra server khi báo lỗi không kết nối.

Không nên gọi liên tục ở UI production.
