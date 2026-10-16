import 'package:equatable/equatable.dart';

import '../../../address/domain/entities/address_entity.dart';
import '../../../catalog/domain/entities/service_item_entity.dart';
import 'inline_order_address.dart';

enum BookingType {
  asap,
  scheduled;

  String toApiValue() => this == BookingType.asap ? 'ASAP' : 'SCHEDULED';

  static BookingType fromApiValue(String? value) {
    if (value == 'SCHEDULED') return BookingType.scheduled;
    return BookingType.asap;
  }
}

class BookingDraftEntity extends Equatable {
  final ServiceItemEntity service;
  final String? providerId;
  final String? providerServiceId;
  final String? providerDisplayName;
  final String? providerAvatarUrl;
  final int? providerPriceAmount;
  final double? providerDistanceKm;

  // Address
  final String addressSource; // 'SAVED' | 'INLINE'
  final String? customerAddressId;
  final AddressEntity? selectedAddress;
  final InlineOrderAddress? inlineAddress;

  // Contact
  final String contactName;
  final String contactPhone;

  // Timing
  final BookingType bookingType;
  final DateTime? scheduledAt;

  // Notes
  final String customerNote;

  const BookingDraftEntity({
    required this.service,
    this.providerId,
    this.providerServiceId,
    this.providerDisplayName,
    this.providerAvatarUrl,
    this.providerPriceAmount,
    this.providerDistanceKm,
    this.addressSource = 'SAVED',
    this.customerAddressId,
    this.selectedAddress,
    this.inlineAddress,
    this.contactName = '',
    this.contactPhone = '',
    this.bookingType = BookingType.asap,
    this.scheduledAt,
    this.customerNote = '',
  });

  bool get hasValidAddress {
    if (addressSource == 'SAVED') {
      return customerAddressId != null && customerAddressId!.isNotEmpty;
    }
    return inlineAddress != null &&
        inlineAddress!.addressLine.trim().length >= 5 &&
        inlineAddress!.latitude != 0.0 &&
        inlineAddress!.longitude != 0.0;
  }

  bool get hasValidContact {
    final name = contactName.trim();
    final phone = contactPhone.trim();
    final phoneRegex = RegExp(r'^(0|\+84)(3|5|7|8|9)[0-9]{8}$');
    return name.length >= 2 && name.length <= 100 && phoneRegex.hasMatch(phone);
  }

  bool get hasValidTime {
    if (bookingType == BookingType.asap) return true;
    if (scheduledAt == null) return false;
    final now = DateTime.now();
    final minLeadTime = now.add(const Duration(minutes: 55)); // 60 mins cushion
    final maxLeadTime = now.add(const Duration(days: 30));
    return scheduledAt!.isAfter(minLeadTime) &&
        scheduledAt!.isBefore(maxLeadTime);
  }

  bool get isConfigValid =>
      hasValidAddress && hasValidContact && hasValidTime;

  BookingDraftEntity copyWith({
    ServiceItemEntity? service,
    String? providerId,
    String? providerServiceId,
    String? providerDisplayName,
    String? providerAvatarUrl,
    int? providerPriceAmount,
    double? providerDistanceKm,
    String? addressSource,
    String? customerAddressId,
    AddressEntity? selectedAddress,
    InlineOrderAddress? inlineAddress,
    String? contactName,
    String? contactPhone,
    BookingType? bookingType,
    DateTime? scheduledAt,
    String? customerNote,
    bool clearProvider = false,
    bool clearInlineAddress = false,
  }) {
    return BookingDraftEntity(
      service: service ?? this.service,
      providerId: clearProvider ? null : (providerId ?? this.providerId),
      providerServiceId: clearProvider
          ? null
          : (providerServiceId ?? this.providerServiceId),
      providerDisplayName: clearProvider
          ? null
          : (providerDisplayName ?? this.providerDisplayName),
      providerAvatarUrl: clearProvider
          ? null
          : (providerAvatarUrl ?? this.providerAvatarUrl),
      providerPriceAmount: clearProvider
          ? null
          : (providerPriceAmount ?? this.providerPriceAmount),
      providerDistanceKm: clearProvider
          ? null
          : (providerDistanceKm ?? this.providerDistanceKm),
      addressSource: addressSource ?? this.addressSource,
      customerAddressId: customerAddressId ?? this.customerAddressId,
      selectedAddress: selectedAddress ?? this.selectedAddress,
      inlineAddress: clearInlineAddress
          ? null
          : (inlineAddress ?? this.inlineAddress),
      contactName: contactName ?? this.contactName,
      contactPhone: contactPhone ?? this.contactPhone,
      bookingType: bookingType ?? this.bookingType,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      customerNote: customerNote ?? this.customerNote,
    );
  }

  @override
  List<Object?> get props => [
        service,
        providerId,
        providerServiceId,
        providerDisplayName,
        providerAvatarUrl,
        providerPriceAmount,
        providerDistanceKm,
        addressSource,
        customerAddressId,
        selectedAddress,
        inlineAddress,
        contactName,
        contactPhone,
        bookingType,
        scheduledAt,
        customerNote,
      ];
}
