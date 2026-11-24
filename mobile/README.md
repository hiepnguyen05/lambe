# Lambe Mobile

Ứng dụng Flutter của nền tảng kết nối dịch vụ làm đẹp tại nhà Lambe.
API nghiệp vụ do backend NestJS cung cấp; xác thực người dùng qua Firebase
trước khi đổi lấy phiên/JWT Lambe.

## Kết nối backend Docker

Android Emulator mặc định dùng `http://10.0.2.2:5000/api`. Backend cần chạy
và công khai cổng 5000 trên máy host. Có thể chỉ định khi chạy:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000/api
```

Nếu Lambe publish cổng host 5001, emulator cần
`--dart-define=API_BASE_URL=http://10.0.2.2:5001/api`.

Máy thật kết nối USB và dùng ADB reverse:

```powershell
adb reverse tcp:5000 tcp:5000
flutter run --dart-define=API_BASE_URL=http://localhost:5000/api
```

Có thể dùng `mobile/run-rmx3261.ps1` hoặc `mobile/run-phone.ps1`: script kiểm
tra health của Lambe, đọc cổng host thực tế từ `docker port lambe_server` và
tự đặt reverse `device:5000 -> host:<port>`. Nếu host dùng 5001 vì 5000 đang
bận, thiết bị vẫn dùng URL localhost:5000; lệnh reverse thủ công là
`adb reverse tcp:5000 tcp:5001`. Cần chạy lại reverse sau khi rút/cắm USB.

API_BASE_URL có sẵn `/api`, các endpoint feature không thêm prefix lần nữa.
Gemini API key và credential backend chỉ nằm ở server; mobile không gọi
Gemini bằng key của hệ thống.

## Chat và AI — mốc 30/10/2026

- Chat có retry text/ảnh/thẻ dịch vụ, dùng lại clientMessageId/payload, merge
  HTTP/SSE và giữ cursor lịch sử. Ảnh lỗi chỉ cache tạm trong RAM có giới hạn.
- AI kiểm tra lại card trước mở và refresh lịch sử một lần khi resume; giữ
  tin pending/error, chặn CTA chưa được kiểm tra khi lỗi mạng hoặc target bị rút.
- Giá/lịch rảnh/khoảng cách trên card không thay cho báo giá và xác nhận đặt đơn.
- Phần tổ chức tạm ngưng phát triển thêm; inbox owner/FCM thiết bị mới còn checkpoint riêng.

Đọc [UI và dữ liệu màn hình](../tailieuUI.md),
[Chat API](../backend/docs/customer-provider-chat-design.md),
[AI API](../backend/docs/ai-consultation-api.md) và
[hướng dẫn kiểm chứng](../backend/docs/chat-ai-verification.md).

```powershell
flutter analyze
flutter test
```

Mốc đã kiểm chứng: toàn bộ 215 test Flutter đạt, analyzer sạch. Kiểm tra hai
thiết bị, FCM thật và độ trễ hiển thị vẫn cần nghiệm thu thực tế.

## Map configuration

The app uses OpenStreetMap raster tiles by default and does not require an API
key. A custom XYZ tile provider can be selected at build time:

```powershell
flutter run --dart-define=MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png
```

For a provider URL containing an `{apiKey}` placeholder, pass a client-safe,
provider-restricted token separately:

```powershell
flutter run `
  --dart-define=MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png?api_key={apiKey} `
  --dart-define=CARTO_API_KEY=your_client_token `
  --dart-define=MAP_ATTRIBUTION="Your map provider"
```

`CARTO_API_KEY` by itself does not change the tile provider. This prevents a
stale token from silently switching the app back to the retired CARTO raster
endpoint.

## Customer/provider app mode

The mobile correctness/performance roadmap is tracked in
[`tasks/mobile-correctness-performance-plan.md`](../tasks/mobile-correctness-performance-plan.md).

App mode is an account-scoped navigation preference, separate from backend roles.
Providers can switch between customer and provider spaces from their profile.
The default is customer mode. Restart restores the preference for the current
session; logout clears it. Onboarding takes precedence, and provider routes
still require the `PROVIDER` role. Switching spaces does not stop availability
or cancel an active order.

`core/routing/app_mode.dart` owns the signed-in redirect rules used by the
router and splash. Auth screens hand successful login back to the router.
Tests: `flutter test test/core/routing/app_mode_test.dart`.

## Nearby provider discovery

Home and Explore require an explicitly selected catalog service before searching.
Home uses the address selected in its header (saved address ID or current GPS).
GPS mode requires a valid location, permission and enabled location services;
there is no synthetic HCMC fallback. Explore uses current GPS.

These browsing sections search ASAP and open the provider's public profile.
They show current availability, not a reserved appointment or confirmed arrival
time. Service Detail sends customers through booking config before discovery.
Scheduled searches require a selected time and send UTC; ASAP omits scheduledAt.

`features/customer/discovery/` contains the shared validated request, repository
and browsing widget. Booking uses the same repository; rematch keeps its server
filtered endpoint. HTTP failures surface as AppFailure with retry. Candidate
ratings can be null and are never invented from experience or missing fields.

Verification: `flutter test test/features/customer/discovery` and the booking/
catalog regression suites. Full suite after this batch: 239 tests passing.

## Reviews, notifications and recent history (31 October 2026)

Provider Reviews loads the public reviews API with cursor pagination, using
server-wide totals and nullable average rating. The API deliberately omits
customer identities. Load-more retains existing rows on error; refresh wins
against older page responses. No fabricated reviews or star distributions remain.

Notification Center now uses backend order notices and owner operational notices.
Worker accounts may have PROVIDER role without ownership; only the documented
403 from the owner list is treated as no owner scope. Other failures are visible.
Opening a notice verifies its target via REST and acknowledges read through the
matching backend endpoint. Swipe-delete and the ambiguous bulk-read button are
removed. Counts currently cover loaded recent pages (50 orders, 20 owner notices),
not total history. Owner SSE/FCM navigation and notification pagination are pending.

Member/invitation details no longer manufacture entities or trust route snapshots
when the scoped list does not contain an item. Missing/error states include retry.
Owner member and received-invitation detail endpoints are not currently available;
the detail-lookup roadmap items remain open instead of calling an invented route.

Recent searches start empty and persist up to ten real queries per user account.
Unavailable/corrupt local history does not prevent service searches.

Full regression suite after this batch: **259 tests passing**; Flutter analyze
reports no issues. Real-device lifecycle and push delivery remain separate checks.

## Order safety integration (31 October 2026, partial)

`features/shared/order_safety/` owns the role-scoped SOS repository, controller,
confirmation, incident screen, evidence widget and history entry. Customer detail/
tracking and provider execution share it. The existing authenticated Dio client
calls `/me/orders/:id/safety` or `/me/provider/orders/:id/safety`.

SOS sends `{}` after confirmation, without waiting for text or a photo. Pending,
ambiguous and confirmed OPEN reports block ordinary order actions. Timeout/5xx/
malformed acknowledgement triggers GET reconciliation before another POST. Own
reports are distinguished from the other party's report. Provider order tracking
stops immediately, and delayed EN_ROUTE responses cannot restart it while held.
This does not turn off all provider availability/location tasks.

Unresolved state survives route changes in memory and is reset on account change.
Evidence uploads stream a file (5 MB maximum) to the private safety endpoint; at
most five own images may be added while OPEN. Every image view fetches a fresh
signed HTTPS URL, limits decoded width to 1080 px and evicts its image cache entry
on close. Signed URLs are not persisted or passed through public upload endpoints.

Incident polling runs every 15 seconds only on the current foreground screen,
avoids overlapping calls, and stops for CLOSED/disposal. It does not fetch the
order again on each OPEN tick; order synchronization uses existing polling plus
open/manual/resume/closed refreshes. Broader background GPS/polling work is pending.

The screen shows OPEN/CLOSED and closedAt; historical incidents can be reopened
from orders whose status history includes SAFETY_HOLD. The user endpoint does not
expose support resolutionNote or staff acknowledgement. Region-specific emergency
dialer configuration is also pending (SOS-006/008). No rescue SLA is advertised.

Tests: `flutter test test/features/shared/order_safety`, customer detail notifier
tests and `test/features/provider/workspace/provider_order_safety_test.dart`.
Real-device camera, private upload/view and lifecycle checks remain outstanding.

Verification for this batch: `flutter analyze` reports no issues; 28 targeted
tests and the full **285-test** regression suite pass. These tests use controlled
fixtures; they do not constitute an end-to-end emergency or real-device test.

## Scheduled order rescheduling (2 November 2026)

`features/shared/order_reschedule/` contains a typed proposal/order snapshot,
repository, controller and small presentation widgets for both roles. Customers
propose a new time from detail/tracking; providers approve or reject from execution.
Only ACCEPTED + SCHEDULED orders are eligible. The confirmed time stays unchanged
while a proposal is pending or rejected; approved times are reloaded from REST.

The picker explicitly uses Vietnam time (UTC+07:00), independent of device timezone,
and submits UTC Z. Client validation matches the server's 60-minute/30-day bounds.
The server still owns working hours, travel buffers, calendar conflicts and locking.

Each mutation preflights current order state, rechecks SOS and prevents double
submission. Provider decisions include the visible proposal's requestId. Backend
accepts this optional UUID while retaining compatibility with older approve-only
clients. An old ID cannot accidentally decide a replacement proposal.

409 refetches the order. Ambiguous failures reconcile through role-scoped GET;
POSTs never auto-retry. Failed reconciliation or acknowledged-but-unsynced dates
disable rescheduling until a successful reload. No extra periodic polling is added;
proposal expiration uses one bounded timer, disposed with the widget.

The visible foreground card listens for matching reschedule SSE events and reloads
the order. FCM foreground updates refresh open order details. Opening ORDER push
verifies the target with authenticated REST before routing and rechecks the account
after awaiting. Real-device FCM delivery and global SSE/FCM dedup remain unverified.

Validation: **307 mobile tests pass**, including 22 new reschedule tests; analyze
reports no issues. Backend unit/contract tests (16) and an isolated PostgreSQL
reschedule HTTP test (1) pass. The temporary database was removed after testing.

## In-order add-on services (2 November 2026)

`features/shared/order_add_ons/` separates typed order/proposal/option models,
the authenticated repository, controller and picker/line-item/proposal widgets.
The existing backend endpoints are reused; no environment variable, migration
or backend deployment is needed for this mobile batch.

Providers propose or withdraw from ARRIVED and all three IN_PROGRESS stages.
The picker loads at most the server's 100 options, preserves available/reason,
and sends only providerServiceId and optional trimmed note. Price, duration,
commission, proposed total and end time come from the server. An option is checked
again immediately before proposal; changed price/duration requires reloading.

Customers review and confirm or reject in detail/tracking. The decision's
authoritative order snapshot updates the whole customer detail before a silent
refresh. An older GET cannot roll back an approval or rejection, including when
only an add-on timestamp changed. Both roles show original/accepted line items;
no local sum replaces totalAmount or commissionAmount. Provider cash confirmation
is cleared when the server total changes. Completion is blocked for live pending
proposals or unresolved add-on synchronization.

Retries of the same proposal intent reuse its Idempotency-Key and body; changed
content or a new intent after resolution gets a new key. Unknown POST outcomes
reconcile with GET; they never trigger an automatic POST retry. Failed reconciliation
blocks add-on actions until reload and does not block SOS. Cancellation, safety,
expiry, eligibility and the five-accepted-item limit are checked again by backend.

Matching SSE events refetch the order, with a bounded set of 64 event IDs and no
refetch from hidden/background widgets. The existing FCM/polling path remains the
fallback. No periodic add-on timer was added; expiry uses one disposable timer.
The picker lazily builds options and scrolls with keyboard insets/large text.

Verification: analyze has no issues; **337 mobile tests pass** (30 new). The
isolated PostgreSQL add-on HTTP test also passes (1 selected case, 33 outside
scope skipped), covering replay, ownership, changed price, wallet and settlement.
The temporary database was removed. Two-device UX/FCM delivery and hardware
RAM/battery measurements remain unverified; broader M3/P1–P4 work is still open.

## Cash-payment disputes (2 November 2026)

`features/shared/payment_dispute/` owns the typed payment projection,
authenticated repository, scoped controller, reason dialog, summary screen
and SSE listener. No dependency or environment variable was added.

Both order lists include a **Cần hỗ trợ** tab. PAYMENT_DISPUTE means awaiting
verification; DISPUTED means verified unpaid and awaiting recovery/manual
handling. Neither is completed. Detail/tracking switch to a read-only payment
screen; SOS keeps its separate priority. On confirmed payment the server moves
to COMPLETED and the normal completed detail retains the payment history.

The provider submits a trimmed 10–500-character reason after fresh IN_PROGRESS,
AFTER_WORK, ACTIVE hold, cancellation and local SOS checks. The report never calls
complete. In-flight and uncertain POST results block execution actions; failures
reconcile with GET, never automatic POST replay. Unknown results require explicit
successful reload. Stale polling cannot undo the acknowledgement or clear that
uncertainty. A changed financial total or dispute clears cash confirmation.

Provider order responses now expose `commissionHold: {amount, status} | null`
from the actual per-order hold, not the wallet total or a locally calculated
percentage. Customers receive no hold amount, wallet identifiers/balance or
internal decision note. This additive backend change requires rebuilding the
API container; it does not require a database migration.

PAYMENT_DISPUTE_* SSE events refresh the authorized order, filter by role/id,
deduplicate up to 64 IDs and coalesce in-flight refreshes. Hidden/background
widgets do not refetch from these events. Existing FCM/polling remains the fallback;
no new periodic timer was added. Reviews require a fresh server-confirmed COMPLETED
order without an existing review; backend also rejects disputes.

Integration/UX contract: [tailieuUI.md](../tailieuUI.md), cash-payment dispute
section; [booking API](../backend/docs/booking-api.md), provider hold projection.
Real-device FCM delivery, RAM/battery and global provider lifecycle work remain open.

Verification: **369/369 mobile tests pass** (32 added for this batch); backend
privacy projection tests pass (8) and the isolated PostgreSQL cash-dispute HTTP
case passes (1 selected, 33 outside scope skipped). It proves ACTIVE hold retention,
single capture after confirmed payment, financial privacy and review gating.
The temporary database was migrated separately and removed after testing.

Final analyzer reports no issues. After removing the unused execution-datasource
payment method in favor of the shared repository, all 16 affected tests were
rerun successfully. The API container has been rebuilt and is healthy; readiness
and Swagger return HTTP 200 with the new provider hold example. No development
database migration or PostgreSQL/Redis restart was required.

## Provider service management — M4 (2 November 2026)

The profile's **Dịch vụ của tôi** entry now opens `/provider/services`, with
separate offerings and paginated/filterable change-request tabs. Detail routes
read by ID, show actual price/duration/status/blocker and use the availability
PUT. Pausing does not cancel accepted orders; pending ASAP may block it, and
the final valid service may end the online session. Dashboard availability is
refreshed after this action; enabling a service never auto-enables online mode.

`features/provider/services/` separates pure domain types, data mapping and
repositories, application controllers, DI, screens and reusable form/picker/doc
widgets. All three request types are supported. Saving only creates a draft;
submission, resubmission and withdrawal are explicit actions. Existing offerings
and booked snapshots are never changed locally to match a proposed price.

Owner-scoped state cancels on account change. Reads precede mutations; stale
edits are rejected locally, and backend remains authoritative for permissions,
catalog limits and concurrency. Pagination keeps previous rows on failure and
does not let an older page replace a refreshed result. Unknown create results
are explicitly reconciled against open requests, with no automatic POST replay.

Private request documents are uploaded one at a time, max 10 total, under the
existing KYC media configuration. Previews get a fresh signed URL, download
through a separate client without Lambe credentials, cap bytes and decode size,
and evict on close/background/session change. URLs and files are not persisted
to disk by this feature. Document actions do not trigger GPS refreshes.

No new package, environment variable, database migration or API deployment is
required. Catalog currently has no public pagination; rendering the picker lazily
does not resolve that backend scalability limit. Real-device gallery/Cloudinary,
notification delivery and hardware memory/battery measurements remain open.
Contracts: [UI integration](../tailieuUI.md) and
[provider-service APIs](../backend/docs/provider-service-management-api.md).

Validation: **431/431 mobile tests pass**, including **62 new M4 tests**; final
analyzer has no issues. Backend checks pass (13 unit/DTO cases, test typecheck/lint,
and 2 isolated PostgreSQL HTTP cases; 34 outside scope skipped). The temporary
database applied all 58 migrations, was removed, and its absence was verified.
Native gallery return is serialized with resume refresh and cannot upload a file
after the old account/controller is disposed. A detected approval refreshes an
already-open offering without instantiating unused profile/GPS data sources.

## Beauty Feed (M5, 02/11/2026)

The Explore tab now opens `features/shared/beauty_feed`; the service catalog
remains at `/services`. `/feed` supports all/following/saved/mine and optional
provider/catalog filters. Provider profile exposes Mine; public profiles expose
the provider-filtered Feed. AI inspiration uses the same typed detail screen.

Repositories parse nested cursor envelopes. Scoped controllers keep lists stable
during refresh, reject stale results and cancel on account change. Reactions
update immediately with per-field rollback/reconciliation. Comments/replies,
soft-delete tombstones and reports use backend permissions. Publishing supports
gallery images or one short MP4, streaming multipart, customer consent, managed
moderation state and revision-checked edits. Unknown writes never auto replay.
The composer uses the owned provider's offerings; organization/member selection
and new organization management remain outside this paused P5 scope.

Booking CTAs reread offering and catalog IDs and open the existing configuration
and quote flow; Feed prices are not final order totals. Images decode at bounded
width; lists are lazy and video has one explicit player, disposed when hidden,
backgrounded or the account changes. No background Feed polling is added.

Backend must expose `GET /api/me/feed/posts` for personalized viewer flags.
Public `/api/feed/posts` deliberately returns false flags. No migration or new
environment variable is needed. Existing Cloudinary Feed storage configuration
is reused. Multipart auth refresh clones finalized FormData before retry.

Native dependencies in the lockfile: `video_player 2.14.1`, `share_plus 12.0.2`.
The share sheet uses `lambe://app/feed/posts/:id`, registered on Android/iOS.
It needs an installed app; there is no HTTPS fallback. Mobile router still
requires authentication/onboarding; a signed-out recipient may need to reopen
the link afterwards. Device media/share/cold-start/iOS and hardware benchmarks
remain open; an Android debug build does not establish release performance.

API fields, routes and failure handling: [Beauty Feed API](../backend/docs/beauty-feed-api.md)
and [UI integration, M5](../tailieuUI.md). P1–P4 and release QA remain separate.

Validation: **483/483 mobile tests pass** (52 new M5 tests), analyzer clean,
and Android debug APK builds. Backend checks: 8 unit/OpenAPI/media cases and
2 isolated PostgreSQL HTTP cases pass (23 outside scope skipped), typechecks
and scoped lint pass. The new endpoint is deployed in Docker: healthy,
Swagger present and anonymous access returns 401. Test databases were removed.
The build used a short process-local temporary directory to avoid the Windows
Java loopback error; no global Java/Windows setting was changed. Built-in Kotlin
plugin compatibility warnings remain for future Flutter upgrades.

## Provider GPS coordinator (P1a, 04/11/2026)

`features/provider/location` owns the foreground provider sensor, heartbeat and
EN_ROUTE publishing. Dashboard and execution screens use that same coordinator,
including one-shot arrival/location requests. The customer stream is stopped
before starting the provider stream. Periodic getCurrentPosition calls were
removed; idle uses balanced updates/60s heartbeats, journey updates use high
accuracy and bounded upload cadence. Only the newest sample is buffered and
location uploads are sequential. Cancellation/account generations ignore late data.

Availability is read from the server on resume. An expired receiving session
is not recreated automatically; the switch shows an unverified state while the
read is unresolved. Toggle actions are single flight, and uncertain writes are
reconciled through GET. A tracking 409 verifies order state because it can also
mean stale GPS. SOS and existing order/ownership checks remain authoritative.

This batch is foreground only. Hidden/paused/detached stops sensor, timers and
requests; a native permission dialog's inactive state does not interrupt an
explicit permission request. Background services, full busy-order state policy,
server sequence metadata and battery/lock-screen QA remain in P1. An offline
receiving intent does not stop an independently active EN_ROUTE order.

Validation: **512/512 tests pass**, including 29 P1a tests; analyzer clean.
Profile ARM64 was installed on a real realme RMX3261 (Android 11, ~3 GB RAM).
Initial startup/PSS/APK measurements and their limitations are in the
[device baseline](../backend/docs/qa/mobile/baseline-rmx3261-2026-11-04.md).
The [measurement runbook](../backend/docs/qa/mobile/README.md) uses the existing
Flutter trace tools and `tool/measure-android.ps1`. `fake_async 1.3.3` is now an
explicit dev dependency; no runtime package or backend migration was added.

## Android provider location service (P1b)

On Android the same geolocator stream now runs with a persistent location
foreground-service notification after the provider enables receiving or starts
EN_ROUTE while the app is visible. The first native fix confirms that the
service can be kept when the app backgrounds. If the app backgrounds before
that fix, the pending stream is cancelled. The app does not start a new location
service from background. Idle and EN_ROUTE keep their existing upload cadence;
offline, order end, account change and dispose stop their location resources.
Resume always verifies availability and order state with the server.

The online switch explains ongoing location use before asking for foreground
permission. The merged Android profile manifest has geolocator's `location`
service type and matching permission. `ACCESS_BACKGROUND_LOCATION` is not
declared for this foreground-started service. The notification does not yet
have a stop action; locked-screen, force-stop, battery and real provider-session
delivery remain device QA work. Server-side availability sequence metadata and
the complete accepted/arrived/in-progress location policy remain open.
