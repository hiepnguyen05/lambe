# Upstash Redis cho Lambe Backend

Backend Lambe kết nối Upstash bằng giao thức Redis TCP qua TLS. Cách kết nối
này giữ nguyên các chức năng đang dùng: cache, rate limit, GEO, Lua `EVAL`,
transaction và Pub/Sub cho SSE.

## 1. Tạo database

1. Tạo một Redis database trong Upstash Console ở region gần backend nhất.
2. Mở `Connect`, chọn tab `TCP` và sao chép connection string.
3. Connection string phải có dạng:

```env
REDIS_URL="rediss://default:<password>@<endpoint>.upstash.io:6379"
```

Không dùng URL ở tab REST cho biến `REDIS_URL`. Không đưa password vào frontend,
mobile, Git hoặc log.

## 2. Cấu hình backend

Trong `backend/.env`, thay Redis Docker cũ bằng:

```env
REDIS_ENABLED="true"
REDIS_URL="rediss://default:<password>@<endpoint>.upstash.io:6379"
REDIS_CONNECT_TIMEOUT_MS="5000"
REDIS_COMMAND_TIMEOUT_MS="1000"
```

Docker Compose chỉ đọc URL này và kết nối ra Upstash. Stack runtime không còn
khởi tạo Redis container hoặc volume Redis cục bộ.

## 3. Khởi động và kiểm tra

```powershell
docker compose up -d --build
docker compose logs --tail=100 lambe_server
Invoke-RestMethod http://localhost:5000/api/health
```

Kết quả health hợp lệ phải có `services.cache` là `up`. Nếu là `down`, kiểm tra
URL lấy từ tab TCP, tiền tố `rediss://`, password và khả năng kết nối Internet
của Docker Desktop.

## 4. Dữ liệu Redis cũ

PostgreSQL vẫn là nguồn dữ liệu nghiệp vụ. Cache, rate limit, trạng thái online,
vị trí thời gian thực và tín hiệu Pub/Sub có thể tạo lại nên không cần sao chép
volume Redis Docker sang Upstash. Khi chuyển đổi, người đang online có thể phải
gửi heartbeat lại và cache sẽ được làm nóng lại từ PostgreSQL.

Redis cục bộ trong `docker-compose.test.yml` và CI được giữ lại để test độc lập,
không tiêu thụ quota hoặc ghi dữ liệu vào Upstash.
