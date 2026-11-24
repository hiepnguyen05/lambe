import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';

import '../application/new_service_change_controller.dart';
import '../application/provider_offering_controller.dart';
import '../application/service_change_controller.dart';
import '../application/service_changes_list_controller.dart';
import '../application/service_resource_state.dart';
import '../data/provider_services_repository.dart';
import '../data/service_change_media_repository.dart';
import '../domain/provider_offering.dart';
import '../domain/service_change.dart';

final providerServicesRepositoryProvider = Provider(
  (ref) => ProviderServicesRepository(ref.watch(dioProvider)),
);
final serviceChangeMediaRepositoryProvider = Provider.autoDispose((ref) {
  final download = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      maxRedirects: 2,
    ),
  );
  ref.onDispose(() => download.close(force: true));
  return ServiceChangeMediaRepository(ref.watch(dioProvider), download);
});

final ownProviderServicesProvider =
    FutureProvider.autoDispose<List<ProviderOffering>>((ref) {
      final user = ref.watch(
        authNotifierProvider.select((v) => v.valueOrNull?.id),
      );
      if (user == null) return [];
      final cancel = CancelToken();
      ref.onDispose(cancel.cancel);
      return ref.watch(providerServicesRepositoryProvider).offerings(cancel);
    });

class ServiceEditorOptions {
  final List<ServiceDefinition> services;
  final List<ServiceCategoryOption> categories;
  final List<ProviderOffering> offerings;
  const ServiceEditorOptions(this.services, this.categories, this.offerings);
}

final serviceEditorOptionsProvider =
    FutureProvider.autoDispose<ServiceEditorOptions>((ref) async {
      ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id));
      final cancel = CancelToken();
      ref.onDispose(cancel.cancel);
      final repository = ref.watch(providerServicesRepositoryProvider);
      final values = await Future.wait([
        repository.catalog(cancel),
        repository.categories(cancel),
        repository.offerings(cancel),
      ]);
      return ServiceEditorOptions(
        values[0] as List<ServiceDefinition>,
        values[1] as List<ServiceCategoryOption>,
        values[2] as List<ProviderOffering>,
      );
    });

final serviceChangesListProvider = StateNotifierProvider.autoDispose
    .family<
      ServiceChangesListController,
      ServiceChangesListState,
      ServiceChangeStatus?
    >((ref, filter) {
      ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id));
      return ServiceChangesListController(
        ref.watch(providerServicesRepositoryProvider),
        filter,
      )..load();
    });

void _refreshOfferings(Ref ref) {
  if (ref.exists(ownProviderServicesProvider)) {
    ref.invalidate(ownProviderServicesProvider);
  }
  if (ref.exists(partnerProfileNotifierProvider)) {
    ref.invalidate(partnerProfileNotifierProvider);
  }
  if (ref.exists(providerDashboardProvider)) {
    unawaited(
      ref.read(providerDashboardProvider.notifier).refreshAvailability(),
    );
  }
}

void _refreshChangeLists(Ref ref) {
  for (final filter in <ServiceChangeStatus?>[
    null,
    ...ServiceChangeStatus.values,
  ]) {
    final source = serviceChangesListProvider(filter);
    if (ref.exists(source)) {
      unawaited(ref.read(source.notifier).load(refresh: true));
    }
  }
}

final providerOfferingProvider = StateNotifierProvider.autoDispose
    .family<
      ProviderOfferingController,
      ServiceResourceState<ProviderOffering>,
      String
    >((ref, id) {
      ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id));
      return ProviderOfferingController(
        ref.watch(providerServicesRepositoryProvider),
        id,
        changed: () => _refreshOfferings(ref),
      )..load();
    });
final serviceChangeProvider = StateNotifierProvider.autoDispose
    .family<
      ServiceChangeController,
      ServiceResourceState<ServiceChange>,
      String
    >((ref, id) {
      ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id));
      late final ServiceChangeController controller;
      controller = ServiceChangeController(
        ref.watch(providerServicesRepositoryProvider),
        ref.watch(serviceChangeMediaRepositoryProvider),
        id,
        changed: () {
          _refreshChangeLists(ref);
          if (controller.isApproved) {
            if (ref.exists(ownProviderServicesProvider)) {
              ref.invalidate(ownProviderServicesProvider);
            }
            if (ref.exists(partnerProfileNotifierProvider)) {
              ref.invalidate(partnerProfileNotifierProvider);
            }
            final offeringId = controller.providerOfferingId;
            if (offeringId != null) {
              ref.invalidate(providerOfferingProvider(offeringId));
            }
          }
        },
      );
      controller.load();
      return controller;
    });
final newServiceChangeProvider = StateNotifierProvider.autoDispose
    .family<
      NewServiceChangeController,
      ServiceResourceState<ServiceChange>,
      String?
    >((ref, offeringId) {
      ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id));
      final controller = NewServiceChangeController(
        ref.watch(providerServicesRepositoryProvider),
        changed: () => _refreshChangeLists(ref),
      );
      KeepAliveLink? pending;
      final remove = controller.addListener((state) {
        if (state.busy || state.uncertain) {
          pending ??= ref.keepAlive();
        } else {
          pending?.close();
          pending = null;
        }
      });
      ref.onDispose(remove);
      return controller;
    });
