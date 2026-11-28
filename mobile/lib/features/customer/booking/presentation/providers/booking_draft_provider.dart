import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/features/shared/address/domain/entities/address_entity.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';

import '../../domain/entities/booking_draft_entity.dart';
import '../../domain/entities/inline_order_address.dart';

class BookingDraftNotifier extends StateNotifier<BookingDraftEntity?> {
  BookingDraftNotifier() : super(null);

  void initialize({
    required ServiceItemEntity service,
    AddressEntity? defaultAddress,
    String? defaultContactName,
    String? defaultContactPhone,
  }) {
    // Nếu chuyển dịch vụ mới hoặc chưa có state
    if (state == null ||
        state!.service.id != service.id ||
        state!.rematchSourceOrderId != null) {
      final initialAddress = defaultAddress;
      final contactName = (initialAddress?.contactName?.isNotEmpty ?? false)
          ? initialAddress!.contactName!
          : (defaultContactName ?? '');
      final contactPhone = (initialAddress?.contactPhone?.isNotEmpty ?? false)
          ? initialAddress!.contactPhone!
          : (defaultContactPhone ?? '');

      // Khung giờ mặc định cho SCHEDULED là 90 phút sau hiện tại (làm tròn lên 30 phút), hoặc sáng mai nếu đã tối muộn
      final now = DateTime.now();
      final defaultScheduled = _computeDefaultScheduledTime(now);

      state = BookingDraftEntity(
        service: service,
        addressSource: initialAddress != null ? 'SAVED' : 'SAVED',
        customerAddressId: initialAddress?.id,
        selectedAddress: initialAddress,
        contactName: contactName,
        contactPhone: contactPhone,
        bookingType: BookingType.asap,
        scheduledAt: defaultScheduled,
      );
    }
  }

  void initializeRematch({
    required String sourceOrderId,
    required ServiceItemEntity service,
    required Map<String, dynamic> orderDraft,
  }) {
    final address = Map<String, dynamic>.from(
      orderDraft['inlineAddress'] as Map,
    );
    state = BookingDraftEntity(
      service: service,
      rematchSourceOrderId: sourceOrderId,
      addressSource: 'INLINE',
      inlineAddress: InlineOrderAddress.fromJson(address),
      contactName: orderDraft['contactName']?.toString() ?? '',
      contactPhone: orderDraft['contactPhone']?.toString() ?? '',
      customerNote: orderDraft['customerNote']?.toString() ?? '',
      bookingType: BookingType.fromApiValue(
        orderDraft['bookingType']?.toString(),
      ),
      scheduledAt: DateTime.tryParse(
        orderDraft['scheduledAt']?.toString() ?? '',
      )?.toLocal(),
    );
  }

  static DateTime _computeDefaultScheduledTime(DateTime now) {
    final minLeadTime = now.add(const Duration(minutes: 60));
    final todayEnd = DateTime(now.year, now.month, now.day, 22, 0);
    if (minLeadTime.isAfter(todayEnd)) {
      final tomorrow = now.add(const Duration(days: 1));
      return DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 7, 0);
    }
    final target = _nextHalfHour(now.add(const Duration(minutes: 90)));
    if (target.isAfter(todayEnd)) {
      final tomorrow = now.add(const Duration(days: 1));
      return DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 7, 0);
    }
    return target;
  }

  static DateTime _nextHalfHour(DateTime dt) {
    final minuteRemainder = dt.minute % 30;
    final minutesToAdd = minuteRemainder == 0 ? 0 : 30 - minuteRemainder;
    final rounded = dt.add(Duration(minutes: minutesToAdd));
    return DateTime(
      rounded.year,
      rounded.month,
      rounded.day,
      rounded.hour,
      rounded.minute,
    );
  }

  void selectSavedAddress(AddressEntity address) {
    if (state == null) return;
    state = state!.copyWith(
      addressSource: 'SAVED',
      customerAddressId: address.id,
      selectedAddress: address,
      clearInlineAddress: true,
      contactName: address.contactName?.isNotEmpty == true
          ? address.contactName!
          : state!.contactName,
      contactPhone: address.contactPhone?.isNotEmpty == true
          ? address.contactPhone!
          : state!.contactPhone,
    );
  }

  void setInlineAddress(InlineOrderAddress inlineAddress) {
    if (state == null) return;
    state = state!.copyWith(
      addressSource: 'INLINE',
      customerAddressId: null,
      selectedAddress: null,
      inlineAddress: inlineAddress,
    );
  }

  void setContactName(String name) {
    if (state == null) return;
    state = state!.copyWith(contactName: name);
  }

  void setContactPhone(String phone) {
    if (state == null) return;
    state = state!.copyWith(contactPhone: phone);
  }

  void setBookingType(BookingType type) {
    if (state == null) return;
    if (type == BookingType.scheduled && state!.scheduledAt == null) {
      final now = DateTime.now();
      state = state!.copyWith(
        bookingType: type,
        scheduledAt: _computeDefaultScheduledTime(now),
      );
    } else {
      state = state!.copyWith(bookingType: type);
    }
  }

  void setScheduledAt(DateTime dateTime) {
    if (state == null) return;
    state = state!.copyWith(
      bookingType: BookingType.scheduled,
      scheduledAt: dateTime,
    );
  }

  void setCustomerNote(String note) {
    if (state == null) return;
    state = state!.copyWith(customerNote: note);
  }

  void selectProvider({
    required String providerId,
    required String providerServiceId,
    required String providerDisplayName,
    String? providerAvatarUrl,
    int? providerPriceAmount,
    double? providerDistanceKm,
    String? assignedMemberId,
    String? assignedMemberName,
  }) {
    if (state == null) return;
    state = state!.copyWith(
      providerId: providerId,
      providerServiceId: providerServiceId,
      providerDisplayName: providerDisplayName,
      providerAvatarUrl: providerAvatarUrl,
      providerPriceAmount: providerPriceAmount,
      providerDistanceKm: providerDistanceKm,
      assignedMemberId: assignedMemberId,
      assignedMemberName: assignedMemberName,
    );
  }

  void selectSpecialist({String? memberId, String? memberName}) {
    if (state == null) return;
    if (memberId == null) {
      state = state!.copyWith(clearAssignedMember: true);
    } else {
      state = state!.copyWith(
        assignedMemberId: memberId,
        assignedMemberName: memberName,
      );
    }
  }

  void clearProvider() {
    if (state == null) return;
    state = state!.copyWith(clearProvider: true);
  }

  void markProviderRejected() {
    final current = state;
    if (current == null) return;
    final rejected = current.providerId;
    state = current.copyWith(
      clearProvider: true,
      rejectedProviderIds: rejected == null
          ? current.rejectedProviderIds
          : [...current.rejectedProviderIds, rejected],
    );
  }

  void reset() {
    state = null;
  }
}

final bookingDraftProvider =
    StateNotifierProvider<BookingDraftNotifier, BookingDraftEntity?>((ref) {
      ref.watch(authNotifierProvider.select((s) => s.valueOrNull?.id));
      return BookingDraftNotifier();
    });
