import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../address/domain/entities/address_entity.dart';
import '../../../catalog/domain/entities/service_item_entity.dart';
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
    if (state == null || state!.service.id != service.id) {
      final initialAddress = defaultAddress;
      final contactName = (initialAddress?.contactName?.isNotEmpty ?? false)
          ? initialAddress!.contactName!
          : (defaultContactName ?? '');
      final contactPhone = (initialAddress?.contactPhone?.isNotEmpty ?? false)
          ? initialAddress!.contactPhone!
          : (defaultContactPhone ?? '');

      // Khung giờ mặc định cho SCHEDULED là 90 phút sau hiện tại (làm tròn lên 30 phút)
      final now = DateTime.now();
      final defaultScheduled =
          _nextHalfHour(now.add(const Duration(minutes: 90)));

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

  static DateTime _nextHalfHour(DateTime dt) {
    final minuteRemainder = dt.minute % 30;
    final minutesToAdd = minuteRemainder == 0 ? 0 : 30 - minuteRemainder;
    final rounded = dt.add(Duration(minutes: minutesToAdd));
    return DateTime(
        rounded.year, rounded.month, rounded.day, rounded.hour, rounded.minute);
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
        scheduledAt: _nextHalfHour(now.add(const Duration(minutes: 90))),
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
  }) {
    if (state == null) return;
    state = state!.copyWith(
      providerId: providerId,
      providerServiceId: providerServiceId,
      providerDisplayName: providerDisplayName,
      providerAvatarUrl: providerAvatarUrl,
      providerPriceAmount: providerPriceAmount,
      providerDistanceKm: providerDistanceKm,
    );
  }

  void clearProvider() {
    if (state == null) return;
    state = state!.copyWith(clearProvider: true);
  }

  void reset() {
    state = null;
  }
}

final bookingDraftProvider =
    StateNotifierProvider<BookingDraftNotifier, BookingDraftEntity?>((ref) {
  return BookingDraftNotifier();
});
