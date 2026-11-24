import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:mobile/features/customer/discovery/domain/provider_search_request.dart';
import 'package:mobile/features/customer/discovery/data/provider_discovery_repository.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/booking_provider_candidate_entity.dart';
import './booking_draft_provider.dart';

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

  const CandidateFilterState({this.sortOption = CandidateSortOption.nearest});

  bool get hasActiveFilters => sortOption != CandidateSortOption.nearest;

  CandidateFilterState copyWith({CandidateSortOption? sortOption}) {
    return CandidateFilterState(sortOption: sortOption ?? this.sortOption);
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
    StateNotifierProvider.autoDispose<
      CandidateFilterNotifier,
      CandidateFilterState
    >((ref) {
      return CandidateFilterNotifier();
    });

final bookingCandidatesProvider =
    FutureProvider.autoDispose<List<BookingProviderCandidateEntity>>((
      ref,
    ) async {
      final draft = ref.watch(bookingDraftProvider);
      if (draft == null) return const [];

      final dio = ref.watch(dioProvider);

      if (draft.rematchSourceOrderId case final sourceId?) {
        final response = await dio.get(
          ApiEndpoints.rematchCandidates(sourceId),
          queryParameters: {'radiusKm': 30, 'limit': 20},
        );
        final data = ApiResponseParser.dataMap(response);
        final list = data['candidates'] as List<dynamic>? ?? const [];
        return list
            .whereType<Map<String, dynamic>>()
            .map(BookingProviderCandidateEntity.fromJson)
            .toList();
      }

      if (draft.customerAddressId == null &&
          draft.inlineAddress == null &&
          draft.selectedAddress == null) {
        throw StateError(
          'Vui lòng chọn địa chỉ phục vụ trước khi tìm chuyên viên.',
        );
      }

      final cancel = CancelToken();
      ref.onDispose(() => cancel.cancel());
      return ref
          .watch(providerDiscoveryRepositoryProvider)
          .search(
            ProviderSearchRequest(
              serviceId: draft.service.id,
              bookingType: draft.bookingType,
              scheduledAt: draft.scheduledAt,
              customerAddressId: draft.addressSource == 'SAVED'
                  ? draft.customerAddressId
                  : null,
              latitude:
                  draft.inlineAddress?.latitude ??
                  draft.selectedAddress?.latitude,
              longitude:
                  draft.inlineAddress?.longitude ??
                  draft.selectedAddress?.longitude,
            ),
            cancelToken: cancel,
          );
    });

final filteredBookingCandidatesProvider =
    Provider.autoDispose<AsyncValue<List<BookingProviderCandidateEntity>>>((
      ref,
    ) {
      final candidatesAsync = ref.watch(bookingCandidatesProvider);
      final filter = ref.watch(candidateFilterProvider);

      return candidatesAsync.whenData((list) {
        var result = List<BookingProviderCandidateEntity>.from(list);
        final rejected =
            ref.watch(bookingDraftProvider)?.rejectedProviderIds ?? [];
        result.removeWhere((candidate) => rejected.contains(candidate.id));

        // Áp dụng sắp xếp theo tab được chọn (Gần nhất, Sao, Giá thấp, Giá cao)
        switch (filter.sortOption) {
          case CandidateSortOption.nearest:
            result.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
            break;
          case CandidateSortOption.highestRated:
            result.sort((a, b) {
              final cmp = (b.rating ?? -1).compareTo(a.rating ?? -1);
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
