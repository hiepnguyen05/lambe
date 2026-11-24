import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/order_reschedule_card.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_history_button.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_button.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_screen.dart';
import 'package:flutter/material.dart';
import 'package:mobile/features/shared/payment_dispute/application/payment_dispute_controller.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_reason_dialog.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_screen.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_summary.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_updates.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/routing/app_route_observer.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';

import '../../application/provider_order_execution_notifier.dart';
import '../../application/provider_order_execution_state.dart';
import '../../di/provider_workspace_providers.dart';
import '../widgets/execution/provider_cancellation_bottom_sheet.dart';
import '../widgets/execution/provider_order_app_bar.dart';
import '../widgets/execution/provider_order_add_ons.dart';

import 'package:mobile/features/shared/order_add_ons/application/order_add_ons_controller.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';

import '../widgets/execution/provider_order_bottom_bar.dart';
import '../widgets/execution/provider_order_customer_card.dart';
import '../widgets/execution/provider_order_destination_card.dart';
import '../widgets/execution/provider_order_execution_cards.dart';
import '../widgets/execution/provider_order_tracking_map.dart';
import '../widgets/execution/provider_order_service_timer_view.dart';
import '../widgets/execution/provider_order_evidence_inspection.dart';
import '../widgets/execution/provider_order_settlement_card.dart';
import '../widgets/execution/provider_order_status_progress.dart';

class ProviderOrderExecutionScreen extends ConsumerStatefulWidget {
  final String orderId;

  const ProviderOrderExecutionScreen({super.key, required this.orderId});

  @override
  ConsumerState<ProviderOrderExecutionScreen> createState() =>
      _ProviderOrderExecutionScreenState();
}

class _ProviderOrderExecutionScreenState
    extends ConsumerState<ProviderOrderExecutionScreen>
    with WidgetsBindingObserver, RouteAware, RouteVisibility {
  final MapController _mapController = MapController();

  @override
  void onVisibilityChanged(bool visible) {
    final notifier = ref.read(
      providerOrderExecutionNotifierProvider(widget.orderId).notifier,
    );
    if (visible) {
      notifier.resumePolling();
    } else {
      notifier.pausePolling();
    }
  }

  LatLng? get _providerLatLng =>
      ref.read(providerLocationCoordinatorProvider).currentPosition;

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _showNotification(String message, {bool isError = false}) {
    if (!mounted) return;
    if (isError) {
      AppDialog.error(context, message: message);
    } else {
      AppDialog.info(context, message: message);
    }
  }

  Future<bool> _pickAndUploadEvidence(String type) async {
    final evidenceLabel = switch (type) {
      'ARRIVAL' => 'xác nhận đã đến',
      'BEFORE_WORK' => 'trước khi thực hiện',
      'AFTER_WORK' => 'kết quả sau khi thực hiện',
      'INCIDENT' => 'sự cố',
      _ => 'bằng chứng',
    };

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Thêm ảnh $evidenceLabel',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.camera_alt_rounded,
                    color: Color(0xFF0F766E),
                  ),
                ),
                title: const Text(
                  'Chụp ảnh mới',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.photo_library_rounded,
                    color: Color(0xFF0F766E),
                  ),
                ),
                title: const Text(
                  'Chọn từ thư viện',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return false;

    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: source, imageQuality: 80);
      if (picked == null) return false;

      double? lat;
      double? lng;

      if (type == 'ARRIVAL') {
        try {
          final pos = await ref
              .read(providerLocationCoordinatorProvider)
              .capture(requestPermission: true);
          lat = pos.latitude;
          lng = pos.longitude;
        } catch (_) {
          lat = _providerLatLng?.latitude;
          lng = _providerLatLng?.longitude;
        }
        if (lat == null || lng == null) {
          _showNotification(
            'Cần bật vị trí thiết bị để chụp ảnh xác nhận đã đến.',
            isError: true,
          );
          return false;
        }
      }

      final success = await ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
          .uploadEvidence(type, picked.path, latitude: lat, longitude: lng);

      if (success) {
        _showNotification('Đã tải ảnh lên.');
      }
      return success;
    } catch (e) {
      _showNotification(
        'Không thể tải ảnh: ${e.toString().replaceFirst("Exception: ", "")}',
        isError: true,
      );
      return false;
    }
  }

  void _showCancellationRequestDialog(Map<String, dynamic> order) {
    final status = order['status']?.toString() ?? '';
    if (status == 'ACCEPTED') {
      _showAcceptedCancellationDialog();
      return;
    }
    final evidenceList = (order['evidence'] as List<dynamic>?) ?? [];
    final contactAttempts = (order['contactAttempts'] as List<dynamic>?) ?? [];

    ProviderCancellationBottomSheet.show(
      context,
      status: status,
      evidenceList: evidenceList,
      contactAttempts: contactAttempts,
      onPickIncident: () => _pickAndUploadEvidence('INCIDENT'),
      onSubmit: (reason, detail) async {
        final success = await ref
            .read(
              providerOrderExecutionNotifierProvider(widget.orderId).notifier,
            )
            .requestCancellation(reason: reason, detail: detail);
        if (success) {
          _showNotification('Đã gửi yêu cầu hủy để khách xác nhận.');
        }
        return success;
      },
    );
  }

  void _showAcceptedCancellationDialog() {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hủy đơn đã nhận'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          maxLength: 500,
          decoration: const InputDecoration(
            labelText: 'Lý do hủy',
            hintText: 'Nhập ít nhất 3 ký tự',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () async {
              final reason = controller.text.trim();
              if (reason.length < 3) return;
              final cancelled = await ref
                  .read(
                    providerOrderExecutionNotifierProvider(widget.orderId)
                        .notifier,
                  )
                  .cancelOrder(reason: reason);
              if (cancelled && dialogContext.mounted) {
                Navigator.of(dialogContext).pop();
                _showNotification('Đã hủy đơn.');
              }
            },
            child: const Text('Xác nhận hủy'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  void _showRejectDialog() {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Từ chối nhận đơn',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: TextField(
          controller: controller,
          maxLines: 3,
          maxLength: 500,
          decoration: const InputDecoration(
            hintText: 'Nhập lý do từ chối (ít nhất 3 ký tự)...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = controller.text.trim();
              if (reason.length < 3) return;
              final rejected = await ref
                  .read(
                    providerOrderExecutionNotifierProvider(widget.orderId)
                        .notifier,
                  )
                  .rejectOrder(reason: reason);
              if (rejected && ctx.mounted) {
                Navigator.of(ctx).pop();
                _showNotification('Đã từ chối đơn.');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            child: const Text('Từ chối'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  Future<void> _makeCall(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri(scheme: 'tel', path: cleanPhone);
    if (cleanPhone.isNotEmpty && await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  String _mapCancellationReason(String? code) {
    switch (code) {
      case 'TRANSPORT_ISSUE':
        return 'Sự cố di chuyển';
      case 'CUSTOMER_UNREACHABLE':
        return 'Không liên hệ được khách';
      case 'LOCATION_INACCESSIBLE':
        return 'Không thể tiếp cận địa điểm';
      case 'UNSAFE_CONDITIONS':
        return 'Điều kiện không an toàn';
      case 'OTHER':
      default:
        return 'Lý do khác';
    }
  }

  LatLng? _extractCustomerLatLng(Map<String, dynamic> order) {
    final lat = (order['addressLatitude'] as num?)?.toDouble();
    final lng = (order['addressLongitude'] as num?)?.toDouble();
    if (lat != null &&
        lng != null &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        (lat != 0 || lng != 0)) {
      return LatLng(lat, lng);
    }
    return null;
  }

  String _extractDestinationLabel(Map<String, dynamic> order) {
    final streetLine = order['addressStreetLine']?.toString() ?? '';
    final addressLine = order['addressLine']?.toString() ?? '';
    final raw = streetLine.isNotEmpty ? streetLine : addressLine;
    final match = RegExp(
      r'(Căn|Phòng|Tầng)\s*[\w\.\-]+',
      caseSensitive: false,
    ).firstMatch(raw);
    if (match != null) {
      return match.group(0)!;
    }
    return 'Điểm hẹn';
  }

  Future<void> _onMarkArrivedPressed() async {
    try {
      final position = await ref
          .read(providerLocationCoordinatorProvider)
          .capture(requestPermission: true);
      if (position.accuracy > 100) {
        throw StateError(
          'GPS chưa đủ chính xác. Vui lòng ra nơi thoáng và thử lại.',
        );
      }
      final success = await ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
          .markArrived(
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyMeters: position.accuracy,
            capturedAt: position.timestamp,
          );
      if (success) _showNotification('Đã xác nhận bạn đến nơi.');
    } catch (error) {
      _showNotification(
        error is StateError
            ? error.message
            : 'Không lấy được GPS mới. Vui lòng thử lại.',
        isError: true,
      );
    }
  }

  Future<void> _onStartOrderPressed(bool hasBefore) async {
    if (!hasBefore) {
      final uploaded = await _pickAndUploadEvidence('BEFORE_WORK');
      if (!uploaded) return;
    }
    final success = await ref
        .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
        .startOrder();
    if (success) {
      _showNotification('Đã bắt đầu thực hiện dịch vụ.');
    }
  }

  Future<void> _onReportUnpaidPressed() async {
    final reason = await showPaymentDisputeReasonDialog(context);
    if (!mounted || reason == null) return;
    final success = await ref
        .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
        .openPaymentDispute(reason);
    if (!mounted) return;
    ref.invalidate(providerOrdersListProvider);
    if (success) {
      final status = ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId))
          .status;
      _showNotification(
        status == 'COMPLETED'
            ? 'Đơn đã được xác minh và hoàn thành.'
            : status == 'DISPUTED'
            ? 'Đơn chưa thanh toán đang chờ xử lý.'
            : 'Đã gửi báo cáo; đang chờ hỗ trợ xác minh thanh toán.',
      );
    } else {
      final error = ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId))
          .errorMessage;
      _showNotification(
        error ?? 'Chưa gửi được báo cáo. Vui lòng tải lại trạng thái.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(providerOrderRefreshSignalProvider(widget.orderId), (
      _,
      __,
    ) {
      ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
          .fetchDetail(silent: true, queueIfBusy: true);
    });

    final state = ref.watch(
      providerOrderExecutionNotifierProvider(widget.orderId),
    );
    final notifier = ref.read(
      providerOrderExecutionNotifierProvider(widget.orderId).notifier,
    );

    if (state.isLoading && state.order == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: AppBar(title: const Text('Tiến trình đơn dịch vụ')),
        body: const Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
      );
    }

    if (state.errorMessage != null && state.order == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: AppBar(title: const Text('Tiến trình đơn dịch vụ')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: Color(0xFFDC2626),
                ),
                const SizedBox(height: 12),
                Text(state.errorMessage!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => notifier.fetchDetail(),
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final order = state.order!;
    final status = order['status']?.toString() ?? '';
    final safetyScope = SafetyScope(widget.orderId, SafetyRole.provider);
    final safety = ref.watch(orderSafetyProvider(safetyScope));
    if (status == 'SAFETY_HOLD' || safety.blocksOrder) {
      return OrderSafetyScreen(
        scope: safetyScope,
        refreshOrder: () =>
            notifier.fetchDetail(silent: true, queueIfBusy: true),
      );
    }
    final paymentScope = PaymentDisputeScope(
      widget.orderId,
      PaymentDisputeRole.provider,
    );
    final payment = ref.watch(paymentDisputeProvider(paymentScope));
    Future<void> refreshPayment() async {
      await notifier.fetchDetail(silent: true, queueIfBusy: true);
      if (mounted) ref.invalidate(providerOrdersListProvider);
    }

    if (isPaymentDisputed(status) || payment.blocksActions) {
      return PaymentDisputeScreen(
        scope: paymentScope,
        snapshot: PaymentDisputeOrder.fromJson(order),
        refreshOrder: refreshPayment,
        onServerOrder: notifier.applyServerOrder,
        error: state.errorMessage,
      );
    }
    final evidenceList = (order['evidence'] as List<dynamic>?) ?? [];
    final hasBeforeWorkEvidence = evidenceList.any(
      (e) => e['type'] == 'BEFORE_WORK',
    );
    final cancellationReq =
        order['cancellationRequest'] as Map<String, dynamic>?;
    final cancellationStatus = cancellationReq?['status']?.toString();

    final liveTracking = ref
        .watch(providerLocationCoordinatorProvider)
        .tracking;
    final customerLatLng = _extractCustomerLatLng(order);
    final destinationLabel = _extractDestinationLabel(order);
    final routePoints = liveTracking?.hasFreshPosition == true
        ? liveTracking!.routePoints
        : <LatLng>[];
    final durationSeconds = liveTracking?.hasFreshPosition == true
        ? liveTracking!.durationSeconds
        : null;
    final distanceMeters = liveTracking?.hasFreshPosition == true
        ? liveTracking!.distanceMeters
        : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: ProviderOrderAppBar(
        safetyAction: canRaiseSafety(status)
            ? OrderSafetyButton(scope: safetyScope)
            : ((order['statusHistory'] as List? ?? []).whereType<Map>().any(
                    (entry) => entry['toStatus'] == 'SAFETY_HOLD',
                  )
                  ? OrderSafetyHistoryButton(
                      scope: safetyScope,
                      refreshOrder: () => notifier.fetchDetail(silent: true),
                    )
                  : null),
        orderId: widget.orderId,
        status: status,
        onReportIncident:
            status == 'ACCEPTED' ||
                status == 'EN_ROUTE' ||
                status == 'ARRIVED' ||
                status == 'IN_PROGRESS'
            ? (cancellationReq != null
                  ? null
                  : () => _showCancellationRequestDialog(order))
            : null,
      ),
      body: Column(
        children: [
          PaymentDisputeUpdates(
            scope: paymentScope,
            refreshOrder: refreshPayment,
          ),
          ProviderOrderStatusProgress(status: status),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primaryContainer,
              onRefresh: () => notifier.fetchDetail(silent: true),
              child: status == 'EN_ROUTE'
                  ? _buildEnRouteView(
                      order: order,
                      status: status,
                      customerLatLng: customerLatLng,
                      destinationLabel: destinationLabel,
                      routePoints: routePoints,
                      durationSeconds: durationSeconds,
                      distanceMeters: distanceMeters,
                      cancellationReq: cancellationReq,
                      cancellationStatus: cancellationStatus,
                    )
                  : status == 'IN_PROGRESS'
                  ? _buildInProgressView(
                      order: order,
                      state: state,
                      notifier: notifier,
                    )
                  : _buildStandardPhasedView(
                      order: order,
                      status: status,
                      customerLatLng: customerLatLng,
                      destinationLabel: destinationLabel,
                      routePoints: routePoints,
                      durationSeconds: durationSeconds,
                      distanceMeters: distanceMeters,
                      cancellationReq: cancellationReq,
                      cancellationStatus: cancellationStatus,
                      notifier: notifier,
                    ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: status == 'IN_PROGRESS'
          ? null
          : ProviderOrderBottomBar(
              status: status,
              hasBefore: hasBeforeWorkEvidence,
              cancellationStatus: cancellationStatus,
              isActionLoading: state.isActionLoading,
              onReject: _showRejectDialog,
              onAccept: () async {
                final success = await notifier.acceptOrder();
                if (success) {
                  _showNotification('Đã nhận đơn.');
                }
              },
              onStartTravel: () async {
                final success = await notifier.markEnRoute();
                if (success) {
                  _showNotification('Đã bắt đầu di chuyển tới khách.');
                }
              },
              onMarkArrived: _onMarkArrivedPressed,
              onStartOrder: () => _onStartOrderPressed(hasBeforeWorkEvidence),
            ),
    );
  }

  Widget _buildInProgressView({
    required Map<String, dynamic> order,
    required ProviderOrderExecutionState state,
    required ProviderOrderExecutionNotifier notifier,
  }) {
    final extras = ref.watch(
      orderAddOnsProvider(AddOnScope(widget.orderId, AddOnRole.provider)),
    );
    final addOnsSection = ProviderOrderAddOns(order: order);
    if (state.inProgressSubStep == 0) {
      return ProviderOrderServiceTimerView(
        order: order,
        addOnsSection: addOnsSection,
        onFinishService: () => notifier.setInProgressSubStep(1),
      );
    } else if (state.inProgressSubStep == 1) {
      return ProviderOrderEvidenceInspection(
        order: order,
        addOnsSection: addOnsSection,
        isActionLoading: state.isActionLoading,
        onUploadEvidence: _pickAndUploadEvidence,
        onBackToTimer: () => notifier.setInProgressSubStep(0),
        onProceedToSettlement: () => notifier.setInProgressSubStep(2),
      );
    } else {
      return ProviderOrderSettlementCard(
        order: order,
        addOnsSection: addOnsSection,
        completionBlocked:
            extras.busy ||
            extras.needsRefresh ||
            notifier.addOnsBlockCompletion,
        cashReceivedChecked: state.cashReceivedChecked,
        onCashCheckChanged: (val) => notifier.setCashReceivedChecked(val),
        isActionLoading: state.isActionLoading,
        onBackToEvidence: () => notifier.setInProgressSubStep(1),
        onConfirmComplete: () async {
          final success = await notifier.completeOrder(cashReceived: true);
          if (success) _showNotification('Đơn đã hoàn thành.');
        },
        onReportUnpaid: _onReportUnpaidPressed,
      );
    }
  }

  Widget _buildEnRouteView({
    required Map<String, dynamic> order,
    required String status,
    required LatLng? customerLatLng,
    required String destinationLabel,
    required List<LatLng> routePoints,
    required int? durationSeconds,
    required int? distanceMeters,
    required Map<String, dynamic>? cancellationReq,
    required String? cancellationStatus,
  }) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        if (customerLatLng != null)
          ProviderOrderTrackingMap(
            mapController: _mapController,
            customerLatLng: customerLatLng,
            providerLatLng: _providerLatLng,
            routePoints: routePoints,
            durationSeconds: durationSeconds,
            distanceMeters: distanceMeters,
            destinationLabel: destinationLabel,
            height: 320,
          )
        else
          const _MissingDestinationNotice(),

        Transform.translate(
          offset: const Offset(0, -24),
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xFFF8F9FF),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 16,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 80),
            child: Column(
              children: [
                if (cancellationReq != null && status != 'CANCELLED') ...[
                  ProviderOrderCancellationBanner(
                    cancellationReq: cancellationReq,
                    status: status,
                    cancellationStatus: cancellationStatus,
                    mapCancellationReason: _mapCancellationReason,
                  ),
                  const SizedBox(height: 12),
                ],

                ProviderOrderCustomerCard(order: order, onCall: _makeCall),
                const SizedBox(height: 12),

                ProviderOrderDestinationCard(order: order),
                const SizedBox(height: 12),

                const SizedBox(height: 52),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStandardPhasedView({
    required Map<String, dynamic> order,
    required String status,
    required LatLng? customerLatLng,
    required String destinationLabel,
    required List<LatLng> routePoints,
    required int? durationSeconds,
    required int? distanceMeters,
    required Map<String, dynamic>? cancellationReq,
    required String? cancellationStatus,
    required ProviderOrderExecutionNotifier notifier,
  }) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        ProviderOrderAddOns(order: order),
        if (status == 'COMPLETED' && order['paymentDisputeOpenedAt'] != null)
          PaymentDisputeSummary(
            order: PaymentDisputeOrder.fromJson(order),
            role: PaymentDisputeRole.provider,
          ),
        OrderRescheduleCard(
          scope: RescheduleScope(widget.orderId, RescheduleRole.provider),
          snapshot: RescheduleOrder.fromJson(order),
          mutationBlocked: ref
              .watch(providerOrderExecutionNotifierProvider(widget.orderId))
              .isActionLoading,
          refreshOrder: () async {
            await notifier.fetchDetail(silent: true, queueIfBusy: true);
            if (mounted) ref.invalidate(providerOrdersListProvider);
          },
        ),
        if (cancellationReq != null && status != 'CANCELLED') ...[
          ProviderOrderCancellationBanner(
            cancellationReq: cancellationReq,
            status: status,
            cancellationStatus: cancellationStatus,
            mapCancellationReason: _mapCancellationReason,
          ),
          const SizedBox(height: 12),
        ],

        if (status == 'ACCEPTED') ...[
          if (customerLatLng != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ProviderOrderTrackingMap(
                mapController: _mapController,
                customerLatLng: customerLatLng,
                providerLatLng: _providerLatLng,
                routePoints: routePoints,
                durationSeconds: durationSeconds,
                distanceMeters: distanceMeters,
                destinationLabel: destinationLabel,
                height: 200,
              ),
            )
          else
            const ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(12)),
              child: _MissingDestinationNotice(),
            ),
          const SizedBox(height: 12),
        ],

        if (status == 'COMPLETED') ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.check_circle_rounded,
                  size: 32,
                  color: Color(0xFF16A34A),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Đơn hàng đã hoàn thành',
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF166534),
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Giao dịch và phí nền tảng đã được hệ thống ghi nhận.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF15803D),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        ProviderOrderCustomerCard(
          order: order,
          onCall: _makeCall,
          onRecordContactAttempt: status == 'ARRIVED'
              ? () => notifier.recordContactAttempt()
              : null,
        ),
        const SizedBox(height: 12),

        ProviderOrderDestinationCard(order: order),
        const SizedBox(height: 12),

        const SizedBox(height: 80),
      ],
    );
  }
}

class _MissingDestinationNotice extends StatelessWidget {
  const _MissingDestinationNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 180,
      color: const Color(0xFFF1F5F4),
      padding: const EdgeInsets.all(24),
      alignment: Alignment.center,
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.location_off_outlined,
            size: 30,
            color: AppColors.onSurfaceVariant,
          ),
          SizedBox(height: 8),
          Text(
            'Đơn chưa có tọa độ điểm đến',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Hãy liên hệ khách để xác nhận địa chỉ trước khi di chuyển.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
