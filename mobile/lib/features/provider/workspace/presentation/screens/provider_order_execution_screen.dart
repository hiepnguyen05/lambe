import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/order_reschedule_card.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_history_button.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_button.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_screen.dart';
import 'package:flutter/material.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';
import 'package:mobile/features/shared/payment_dispute/application/payment_dispute_controller.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_reason_dialog.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_screen.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_summary.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_updates.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import '../widgets/execution/provider_order_detail_view.dart';
import '../widgets/execution/provider_order_destination_card.dart';
import '../widgets/execution/provider_order_execution_cards.dart';
import '../widgets/execution/provider_order_tracking_map.dart';
import '../widgets/execution/provider_order_service_timer_view.dart';
import '../widgets/execution/provider_order_settlement_card.dart';

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

  void _showError(String message) {
    if (!mounted) return;
    AppDialog.error(context, message: message);
  }

  Future<bool> _pickAndUploadEvidence(String type) async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1080,
        maxHeight: 1080,
        imageQuality: 72,
      );
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
          _showError('Cần bật vị trí thiết bị để chụp ảnh xác nhận đã đến.');
          return false;
        }
      }

      return await ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
          .uploadEvidence(type, picked.path, latitude: lat, longitude: lng);
    } catch (e) {
      _showError(
        'Không thể chụp/tải ảnh: ${e.toString().replaceFirst("Exception: ", "")}',
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
        return ref
            .read(
              providerOrderExecutionNotifierProvider(widget.orderId).notifier,
            )
            .requestCancellation(reason: reason, detail: detail);
      },
    );
  }

  void _showAcceptedCancellationDialog() {
    var reason = '';
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hủy đơn đã nhận'),
        content: TextField(
          onChanged: (value) => reason = value.trim(),
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
              if (reason.length < 3) return;
              final cancelled = await ref
                  .read(
                    providerOrderExecutionNotifierProvider(widget.orderId)
                        .notifier,
                  )
                  .cancelOrder(reason: reason);
              if (cancelled && dialogContext.mounted) {
                Navigator.of(dialogContext).pop();
              }
            },
            child: const Text('Xác nhận hủy'),
          ),
        ],
      ),
    );
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
    if (cleanPhone.isEmpty) {
      _showError('Chưa có số điện thoại của khách hàng.');
      return;
    }
    final uri = Uri(scheme: 'tel', path: cleanPhone);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      _showError('Không thể mở ứng dụng gọi điện trên thiết bị.');
    }
  }

  Future<void> _openExternalNavigation(LatLng destination) async {
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': '${destination.latitude},${destination.longitude}',
      'travelmode': 'driving',
      'dir_action': 'navigate',
    });
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      _showError('Không thể mở ứng dụng chỉ đường Google Maps.');
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
      await ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
          .markArrived(
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyMeters: position.accuracy,
            capturedAt: position.timestamp,
          );
    } catch (error) {
      _showError(
        error is StateError
            ? error.message
            : 'Không lấy được GPS mới. Vui lòng thử lại.',
      );
    }
  }

  Future<void> _onStartOrderPressed(bool hasBefore) async {
    if (!hasBefore) {
      await _pickAndUploadEvidence('BEFORE_WORK');
      return;
    }
    await ref
        .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
        .startOrder();
  }

  Future<void> _onFinishServicePressed(
    bool hasAfterWork,
    ProviderOrderExecutionNotifier notifier,
  ) async {
    if (!hasAfterWork) {
      final uploaded = await _pickAndUploadEvidence('AFTER_WORK');
      if (!uploaded || !mounted) return;
    }
    notifier.setInProgressSubStep(2);
  }

  Future<void> _onReportUnpaidPressed() async {
    final reason = await showPaymentDisputeReasonDialog(context);
    if (!mounted || reason == null) return;
    final success = await ref
        .read(providerOrderExecutionNotifierProvider(widget.orderId).notifier)
        .openPaymentDispute(reason);
    if (!mounted) return;
    ref.invalidate(providerOrdersListProvider);
    if (!success) {
      final error = ref
          .read(providerOrderExecutionNotifierProvider(widget.orderId))
          .errorMessage;
      _showError(
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

    ref.listen<ProviderOrderExecutionState>(
      providerOrderExecutionNotifierProvider(widget.orderId),
      (prev, next) {
        if (next.order != null &&
            next.errorMessage != null &&
            next.errorMessage != prev?.errorMessage) {
          final msg = next.errorMessage!;
          ref
              .read(
                providerOrderExecutionNotifierProvider(widget.orderId).notifier,
              )
              .clearError();
          _showError(msg);
        }
      },
    );

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
    final hasAfterWorkEvidence = evidenceList.any(
      (e) => e['type'] == 'AFTER_WORK',
    );
    final cancellationReq =
        order['cancellationRequest'] as Map<String, dynamic>?;
    final cancellationStatus = cancellationReq?['status']?.toString();

    final locationCoordinator = ref.watch(providerLocationCoordinatorProvider);
    final liveTracking = locationCoordinator.tracking;
    final customerLatLng = _extractCustomerLatLng(order);
    final providerPos =
        locationCoordinator.currentPosition ??
        (liveTracking?.hasFreshPosition == true
            ? liveTracking!.position
            : null);
    final straightLineMeters = providerPos != null && customerLatLng != null
        ? const Distance()
              .as(LengthUnit.Meter, providerPos, customerLatLng)
              .round()
        : null;
    final canMarkArrived =
        customerLatLng == null ||
        (straightLineMeters != null && straightLineMeters <= 300);
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

    final tourId = switch (status) {
      'ACCEPTED' =>
        order['bookingType'] == 'SCHEDULED'
            ? 'provider_order_scheduled'
            : 'provider_order_accepted',
      'ARRIVED' => 'provider_order_arrived',
      'IN_PROGRESS' =>
        state.inProgressSubStep == 2
            ? 'provider_order_settlement'
            : 'provider_order_work',
      'COMPLETED' => 'provider_order_complete',
      _ => 'provider_workflow',
    };
    return GuidanceTrigger(
      tourId: tourId,
      enabled:
          [
            'ACCEPTED',
            'ARRIVED',
            'IN_PROGRESS',
            'COMPLETED',
          ].contains(status) &&
          !state.isActionLoading &&
          cancellationStatus == null,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: ProviderOrderAppBar(
          safetyAction: canRaiseSafety(status, role: safetyScope.role)
              ? OrderSafetyButton(scope: safetyScope)
              : ((order['statusHistory'] as List? ?? []).whereType<Map>().any(
                      (entry) => entry['toStatus'] == 'SAFETY_HOLD',
                    )
                    ? OrderSafetyHistoryButton(
                        scope: safetyScope,
                        refreshOrder: () => notifier.fetchDetail(silent: true),
                      )
                    : null),
        ),
        body: GuidanceAnchor(
          id: 'provider_order_body',
          child: Column(
            children: [
              PaymentDisputeUpdates(
                scope: paymentScope,
                refreshOrder: refreshPayment,
              ),
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.primaryContainer,
                  onRefresh: () => notifier.fetchDetail(silent: true),
                  child:
                      (status == 'EN_ROUTE' ||
                          (status == 'ACCEPTED' &&
                              order['bookingType'] != 'SCHEDULED'))
                      ? _buildTravelView(
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
                      : (status == 'ARRIVED' || status == 'IN_PROGRESS')
                      ? _buildWorkExecutionView(
                          order: order,
                          status: status,
                          cancellationReq: cancellationReq,
                          cancellationStatus: cancellationStatus,
                          state: state,
                          notifier: notifier,
                        )
                      : _buildStandardPhasedView(
                          order: order,
                          status: status,
                          cancellationReq: cancellationReq,
                          cancellationStatus: cancellationStatus,
                          notifier: notifier,
                        ),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar:
            (status == 'IN_PROGRESS' && state.inProgressSubStep == 2)
            ? null
            : GuidanceAnchor(
                id: 'provider_order_action',
                child: ProviderOrderBottomBar(
                  status: status,
                  bookingType: order['bookingType']?.toString() ?? 'ASAP',
                  departureAvailableAt: DateTime.tryParse(
                    order['departureAvailableAt']?.toString() ?? '',
                  ),
                  scheduledAt: DateTime.tryParse(
                    order['scheduledAt']?.toString() ?? '',
                  ),
                  hasBefore: hasBeforeWorkEvidence,
                  hasAfter: hasAfterWorkEvidence,
                  cancellationStatus: cancellationStatus,
                  isActionLoading: state.isActionLoading,
                  canMarkArrived: canMarkArrived,
                  distanceMetersToCustomer: straightLineMeters,
                  onReject: _showRejectDialog,
                  onAccept: () => notifier.acceptOrder(),
                  onStartTravel: () => notifier.markEnRoute(),
                  onCancelOrder: cancellationReq == null
                      ? () => _showCancellationRequestDialog(order)
                      : null,
                  onMarkArrived: _onMarkArrivedPressed,
                  onStartOrder: () =>
                      _onStartOrderPressed(hasBeforeWorkEvidence),
                  onFinishService: () =>
                      _onFinishServicePressed(hasAfterWorkEvidence, notifier),
                ),
              ),
      ),
    );
  }

  Widget _buildOrderBanners({
    required Map<String, dynamic> order,
    required String status,
    required Map<String, dynamic>? cancellationReq,
    required String? cancellationStatus,
    required bool isActionLoading,
    required ProviderOrderExecutionNotifier notifier,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        OrderRescheduleCard(
          scope: RescheduleScope(widget.orderId, RescheduleRole.provider),
          snapshot: RescheduleOrder.fromJson(order),
          onContact: (order['contactPhone'] as String?)?.isNotEmpty == true
              ? () => _makeCall(order['contactPhone'] as String)
              : null,
          onCancel: status == 'ACCEPTED' && cancellationReq == null
              ? () => _showAcceptedCancellationDialog()
              : null,
          mutationBlocked: isActionLoading,
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
      ],
    );
  }

  Widget _buildWorkExecutionView({
    required Map<String, dynamic> order,
    required String status,
    required Map<String, dynamic>? cancellationReq,
    required String? cancellationStatus,
    required ProviderOrderExecutionState state,
    required ProviderOrderExecutionNotifier notifier,
  }) {
    final extras = ref.watch(
      orderAddOnsProvider(AddOnScope(widget.orderId, AddOnRole.provider)),
    );
    final evidenceList = (order['evidence'] as List<dynamic>?) ?? const [];
    final afterWorkList = evidenceList
        .whereType<Map>()
        .where((e) => e['type'] == 'AFTER_WORK')
        .toList();
    final isPaused = order['workPausedAt'] != null;

    if (status == 'IN_PROGRESS' && state.inProgressSubStep == 2) {
      return ProviderOrderSettlementCard(
        order: order,
        completionBlocked: extras.busy || notifier.addOnsBlockCompletion,
        cashReceivedChecked: state.cashReceivedChecked,
        onCashCheckChanged: (val) => notifier.setCashReceivedChecked(val),
        isActionLoading: state.isActionLoading,
        onBackToWork: () => notifier.setInProgressSubStep(0),
        onCaptureAfterMore: afterWorkList.length < 5
            ? () => _pickAndUploadEvidence('AFTER_WORK')
            : null,
        onConfirmComplete: () async {
          final success = await notifier.completeOrder(cashReceived: true);
          if (success && mounted) {
            ref.invalidate(providerOrdersListProvider);
            ref.invalidate(providerDashboardProvider);
            context.go('/provider/home');
          }
        },
        onReportUnpaid: _onReportUnpaidPressed,
      );
    }

    return ProviderOrderServiceTimerView(
      order: order,
      topBanner: _buildOrderBanners(
        order: order,
        status: status,
        cancellationReq: cancellationReq,
        cancellationStatus: cancellationStatus,
        isActionLoading: state.isActionLoading,
        notifier: notifier,
      ),
      addOnsSection: ProviderOrderAddOns(order: order),
      customerSection: ProviderOrderCustomerCard(
        order: order,
        onCall: _makeCall,
        onRecordContactAttempt: status == 'ARRIVED'
            ? () => notifier.recordContactAttempt()
            : null,
      ),
      isActionLoading: state.isActionLoading,
      onCaptureBefore: status == 'ARRIVED'
          ? () => _pickAndUploadEvidence('BEFORE_WORK')
          : null,
      onTogglePause: status == 'IN_PROGRESS'
          ? () {
              if (isPaused) {
                notifier.resumeWork();
              } else {
                notifier.pauseWork();
              }
            }
          : null,
    );
  }

  Widget _buildTravelView({
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
            height: 300,
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

                if (order['bookingType'] == 'SCHEDULED')
                  OrderRescheduleCard(
                    scope: RescheduleScope(
                      widget.orderId,
                      RescheduleRole.provider,
                    ),
                    snapshot: RescheduleOrder.fromJson(order),
                    mutationBlocked: ref
                        .watch(
                          providerOrderExecutionNotifierProvider(
                            widget.orderId,
                          ),
                        )
                        .isActionLoading,
                    refreshOrder: () => ref
                        .read(
                          providerOrderExecutionNotifierProvider(widget.orderId)
                              .notifier,
                        )
                        .fetchDetail(silent: true, queueIfBusy: true),
                    onContact:
                        (order['contactPhone'] as String?)?.isNotEmpty == true
                        ? () => _makeCall(order['contactPhone'] as String)
                        : null,
                    onCancel: cancellationReq == null
                        ? () => _showCancellationRequestDialog(order)
                        : null,
                  ),
                ProviderOrderCustomerCard(order: order, onCall: _makeCall),
                const SizedBox(height: 12),

                ProviderOrderDestinationCard(
                  order: order,
                  onNavigate: customerLatLng != null
                      ? () => _openExternalNavigation(customerLatLng)
                      : null,
                ),
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
    required Map<String, dynamic>? cancellationReq,
    required String? cancellationStatus,
    required ProviderOrderExecutionNotifier notifier,
  }) {
    final isActionLoading = ref
        .watch(providerOrderExecutionNotifierProvider(widget.orderId))
        .isActionLoading;

    return ProviderOrderDetailView(
      order: order,
      onCall: _makeCall,
      topBanners: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == 'COMPLETED' && order['paymentDisputeOpenedAt'] != null)
            PaymentDisputeSummary(
              order: PaymentDisputeOrder.fromJson(order),
              role: PaymentDisputeRole.provider,
            ),
          _buildOrderBanners(
            order: order,
            status: status,
            cancellationReq: cancellationReq,
            cancellationStatus: cancellationStatus,
            isActionLoading: isActionLoading,
            notifier: notifier,
          ),
        ],
      ),
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
