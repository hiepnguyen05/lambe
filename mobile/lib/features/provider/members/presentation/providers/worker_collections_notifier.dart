import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/worker_collection_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

class WorkerCollectionsState {
  final WorkerCollectionSummaryEntity? summary;
  final List<WorkerCollectionOrderItemEntity> orders;
  final bool isLoading;
  final String? errorMessage;

  const WorkerCollectionsState({
    this.summary,
    this.orders = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  WorkerCollectionsState copyWith({
    WorkerCollectionSummaryEntity? summary,
    List<WorkerCollectionOrderItemEntity>? orders,
    bool? isLoading,
    String? errorMessage,
  }) {
    return WorkerCollectionsState(
      summary: summary ?? this.summary,
      orders: orders ?? this.orders,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class WorkerCollectionsNotifier
    extends StateNotifier<WorkerCollectionsState> {
  final ProviderMembersRepository _repository;
  final String membershipId;

  WorkerCollectionsNotifier(this._repository, this.membershipId)
      : super(const WorkerCollectionsState(isLoading: true)) {
    loadCollections();
  }

  Future<void> loadCollections({DateTime? from, DateTime? to}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final results = await Future.wait([
        _repository.getWorkerCollectionsSummary(membershipId, from: from, to: to),
        _repository.getWorkerCollectionsOrders(membershipId, from: from, to: to),
      ]);

      final summary = results[0] as WorkerCollectionSummaryEntity;
      final orders = results[1] as List<WorkerCollectionOrderItemEntity>;

      state = state.copyWith(
        summary: summary,
        orders: orders,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Lỗi nạp báo cáo tiền mặt: ${e.toString()}',
      );
    }
  }
}

final workerCollectionsProvider = StateNotifierProvider.autoDispose
    .family<WorkerCollectionsNotifier, WorkerCollectionsState, String>(
  (ref, membershipId) {
    final repository = ref.watch(providerMembersRepositoryProvider);
    return WorkerCollectionsNotifier(repository, membershipId);
  },
);

