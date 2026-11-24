import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';

/// Typed navigation data for bookings started from a public provider profile.
class ProviderBookingEntry {
  final ServiceItemEntity service;
  final String providerId;
  final String providerServiceId;
  final String providerDisplayName;
  final String? providerAvatarUrl;
  final int priceAmount;
  final String? assignedMemberId;
  final String? assignedMemberName;

  const ProviderBookingEntry({
    required this.service,
    required this.providerId,
    required this.providerServiceId,
    required this.providerDisplayName,
    this.providerAvatarUrl,
    required this.priceAmount,
    this.assignedMemberId,
    this.assignedMemberName,
  });
}
