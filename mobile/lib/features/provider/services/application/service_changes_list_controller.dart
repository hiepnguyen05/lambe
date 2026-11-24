import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/provider_services_repository.dart';
import '../domain/service_change.dart';
import 'service_operation.dart';

class ServiceChangesListState {
  final List<ServiceChange> items;
  final bool loading, hasMore, loaded;
  final String? error;
  const ServiceChangesListState({
    this.items = const [],
    this.loading = false,
    this.hasMore = false,
    this.loaded = false,
    this.error,
  });
}

class ServiceChangesListController
    extends StateNotifier<ServiceChangesListState> {
  final ProviderServicesRepository repository;
  final ServiceChangeStatus? filter;
  final cancel = CancelToken();
  int _page = 0, _generation = 0;
  ServiceChangesListController(this.repository, this.filter)
    : super(const ServiceChangesListState());
  Future<void> load({bool refresh = false}) async {
    if (!refresh && (state.loading || (state.loaded && !state.hasMore))) return;
    final generation = refresh ? ++_generation : _generation;
    final page = refresh ? 1 : _page + 1;
    final previous = state;
    state = ServiceChangesListState(
      items: previous.items,
      loaded: previous.loaded,
      loading: true,
      hasMore: previous.hasMore,
    );
    try {
      final result = await repository.changes(
        cancel,
        status: filter,
        page: page,
      );
      if (!mounted || generation != _generation) return;
      _page = page;
      final unique = <String, ServiceChange>{
        for (final item in refresh ? <ServiceChange>[] : previous.items)
          item.id: item,
      };
      for (final item in result.items) {
        unique[item.id] = item;
      }
      state = ServiceChangesListState(
        items: unique.values.toList(growable: false),
        loaded: true,
        hasMore: result.hasMore,
      );
    } catch (error) {
      if (mounted && generation == _generation) {
        state = ServiceChangesListState(
          items: previous.items,
          loaded: previous.loaded,
          hasMore: previous.hasMore,
          error: serviceError(error),
        );
      }
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}
