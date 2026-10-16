import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/location/user_location_provider.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../domain/entities/booking_draft_entity.dart';
import '../../domain/entities/booking_provider_candidate_entity.dart';
import 'booking_draft_provider.dart';

enum CandidateSortOption {
  nearest('Gần nhất'),
  highestRated('Sao'),
  priceAsc('Giá thấp'),
  priceDesc('Giá cao');

  final String label;
  const CandidateSortOption(this.label);
}

class CandidateFilterState {
  final CandidateSortOption sortOption;

  const CandidateFilterState({
    this.sortOption = CandidateSortOption.nearest,
  });

  bool get hasActiveFilters =>
      sortOption != CandidateSortOption.nearest;

  CandidateFilterState copyWith({
    CandidateSortOption? sortOption,
  }) {
    return CandidateFilterState(
      sortOption: sortOption ?? this.sortOption,
    );
  }
}

class CandidateFilterNotifier extends StateNotifier<CandidateFilterState> {
  CandidateFilterNotifier() : super(const CandidateFilterState());

  void setSortOption(CandidateSortOption sort) {
    state = state.copyWith(sortOption: sort);
  }

  void reset() {
    state = const CandidateFilterState();
  }
}

final candidateFilterProvider =
    StateNotifierProvider.autoDispose<CandidateFilterNotifier, CandidateFilterState>((ref) {
  return CandidateFilterNotifier();
});

final bookingCandidatesProvider =
    FutureProvider.autoDispose<List<BookingProviderCandidateEntity>>((ref) async {
  final draft = ref.watch(bookingDraftProvider);
  if (draft == null) return const [];

  final dio = ref.watch(dioProvider);

  final Map<String, dynamic> body = {
    'serviceId': draft.service.id,
    'bookingType': draft.bookingType.toApiValue(),
    'radiusKm': 30,
    'limit': 20,
  };

  if (draft.bookingType == BookingType.scheduled && draft.scheduledAt != null) {
    body['scheduledAt'] = draft.scheduledAt!.toUtc().toIso8601String();
  }

  if (draft.addressSource == 'SAVED' && draft.customerAddressId != null) {
    body['customerAddressId'] = draft.customerAddressId;
  } else if (draft.inlineAddress != null) {
    body['latitude'] = draft.inlineAddress!.latitude;
    body['longitude'] = draft.inlineAddress!.longitude;
  } else if (draft.selectedAddress != null) {
    body['latitude'] = draft.selectedAddress!.latitude;
    body['longitude'] = draft.selectedAddress!.longitude;
  } else {
    final userLoc = ref.read(userLocationProvider);
    body['latitude'] = userLoc.latitude;
    body['longitude'] = userLoc.longitude;
  }

  try {
    debugPrint('🚀 [DiscoverySearch] Request body: $body');
    final response = await dio.post(
      ApiEndpoints.providerDiscoverySearch,
      data: body,
    );
    debugPrint('🚀 [DiscoverySearch] Status: ${response.statusCode}, Body: ${response.data}');

    final list = ApiResponseParser.dataList(response);
    return list
        .whereType<Map<String, dynamic>>()
        .map((item) => BookingProviderCandidateEntity.fromJson(item))
        .toList();
  } catch (e, st) {
    debugPrint('❌ [DiscoverySearch] Error: $e\n$st');
    rethrow;
  }
});

final filteredBookingCandidatesProvider =
    Provider.autoDispose<AsyncValue<List<BookingProviderCandidateEntity>>>((ref) {
  final candidatesAsync = ref.watch(bookingCandidatesProvider);
  final filter = ref.watch(candidateFilterProvider);

  return candidatesAsync.whenData((list) {
    var result = List<BookingProviderCandidateEntity>.from(list);

    // Áp dụng sắp xếp theo tab được chọn (Gần nhất, Sao, Giá thấp, Giá cao)
    switch (filter.sortOption) {
      case CandidateSortOption.nearest:
        result.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
        break;
      case CandidateSortOption.highestRated:
        result.sort((a, b) {
          final cmp = b.rating.compareTo(a.rating);
          if (cmp != 0) return cmp;
          return b.reviewCount.compareTo(a.reviewCount);
        });
        break;
      case CandidateSortOption.priceAsc:
        result.sort((a, b) => a.priceAmount.compareTo(b.priceAmount));
        break;
      case CandidateSortOption.priceDesc:
        result.sort((a, b) => b.priceAmount.compareTo(a.priceAmount));
        break;
    }

    return result;
  });
});
