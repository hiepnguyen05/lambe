import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/data/provider_services_repository.dart';
import 'package:mobile/features/provider/services/data/service_change_media_repository.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';
import 'package:mobile/features/provider/services/domain/service_change_draft.dart';

Map<String, dynamic> definitionJson() => {
  'id': 'service',
  'name': 'Cắt tóc nam',
  'slug': 'cat-toc-nam',
  'minPriceAmount': 50000,
  'maxPriceAmount': 200000,
  'defaultDurationMinutes': 45,
  'requiresCertificate': true,
  'minPortfolioImages': 2,
  'minExperienceYears': 1,
  'category': {'id': 'category', 'name': 'Tóc'},
};
Map<String, dynamic> offeringJson({
  String status = 'ACTIVE',
  String? blocker,
}) => {
  'id': 'offering',
  'serviceId': 'service',
  'status': status,
  'priceAmount': 100000,
  'durationMinutes': 60,
  'blockerCode': blocker,
  'description': 'Tạo kiểu theo yêu cầu',
  'service': definitionJson(),
};
Map<String, dynamic> changeJson({
  String id = 'request',
  ServiceChangeStatus status = ServiceChangeStatus.draft,
  ServiceChangeType type = ServiceChangeType.updateOffering,
}) => {
  'id': id,
  'type': type.wire,
  'status': status.wire,
  'providerServiceId': type == ServiceChangeType.updateOffering
      ? 'offering'
      : null,
  'serviceId': type == ServiceChangeType.proposeNew ? null : 'service',
  'categoryId': type == ServiceChangeType.proposeNew ? 'category' : null,
  'proposedName': type == ServiceChangeType.proposeNew
      ? 'Tạo kiểu đi tiệc'
      : null,
  'proposedPriceAmount': 120000,
  'proposedDurationMinutes': 75,
  'proposedDescription': 'Mô tả mới',
  'updatedAt': '2026-11-02T08:00:00Z',
  'submittedAt': status == ServiceChangeStatus.draft
      ? null
      : '2026-11-02T08:10:00Z',
  'reviewNote': status == ServiceChangeStatus.needsChanges
      ? 'Ảnh chứng chỉ bị mờ.'
      : null,
  'service': type == ServiceChangeType.proposeNew ? null : definitionJson(),
  'category': type == ServiceChangeType.proposeNew
      ? {'id': 'category', 'name': 'Tóc'}
      : null,
  'documents': <Map<String, dynamic>>[],
};
ServiceChangeDraft draft({
  ServiceChangeType type = ServiceChangeType.updateOffering,
  int price = 120000,
  int? duration = 75,
}) => ServiceChangeDraft(
  type: type,
  offeringId: type == ServiceChangeType.updateOffering ? 'offering' : null,
  serviceId: type == ServiceChangeType.addExisting ? 'service' : null,
  categoryId: type == ServiceChangeType.proposeNew ? 'category' : null,
  name: type == ServiceChangeType.proposeNew ? ' Tạo kiểu đi tiệc ' : null,
  description: ' Mô tả mới ',
  price: price,
  duration: duration,
);
DioException failure([int? status]) => DioException(
  requestOptions: RequestOptions(),
  type: status == null
      ? DioExceptionType.receiveTimeout
      : DioExceptionType.badResponse,
  response: status == null
      ? null
      : Response(
          requestOptions: RequestOptions(),
          statusCode: status,
          data: {'message': 'Đơn đặt ngay đang chờ phản hồi.'},
        ),
);

class FakeProviderServicesRepository extends ProviderServicesRepository {
  FakeProviderServicesRepository() : super(Dio());
  ProviderOffering currentOffering = offeringFromJson(offeringJson());
  ServiceDefinition definition = definitionFromJson(definitionJson());
  ServiceChange current = changeFromJson(changeJson());
  int puts = 0, creates = 0, updates = 0, submissions = 0, withdrawals = 0;
  ServiceChangeDraft? sent;
  Future<ProviderOffering> Function()? onOffering, onAvailability;
  Future<ServiceChange> Function()? onRead, onCreate, onSubmit;
  Future<ServiceChangesPage> Function(ServiceChangeStatus?, int)? onPage;
  @override
  Future<List<ProviderOffering>> offerings(CancelToken cancel) async => [
    currentOffering,
  ];
  @override
  Future<ProviderOffering> offering(String id, CancelToken cancel) async =>
      onOffering != null ? onOffering!() : currentOffering;
  @override
  Future<ProviderOffering> availability(
    String id,
    bool active,
    CancelToken cancel,
  ) async {
    puts++;
    if (onAvailability != null) return onAvailability!();
    return currentOffering = offeringFromJson(
      offeringJson(status: active ? 'ACTIVE' : 'INACTIVE'),
    );
  }

  @override
  Future<List<ServiceDefinition>> catalog(CancelToken cancel) async => [
    definition,
  ];
  @override
  Future<ServiceDefinition> catalogService(
    String slug,
    CancelToken cancel,
  ) async => definition;
  @override
  Future<List<ServiceCategoryOption>> categories(CancelToken cancel) async => [
    definition.category,
  ];
  @override
  Future<ServiceChangesPage> changes(
    CancelToken cancel, {
    ServiceChangeStatus? status,
    int page = 1,
    int limit = 20,
  }) async => onPage != null
      ? onPage!(status, page)
      : ServiceChangesPage(
          [if (status == null || status == current.status) current],
          page,
          1,
        );
  @override
  Future<ServiceChange> change(String id, CancelToken cancel) async =>
      onRead != null ? onRead!() : current;
  @override
  Future<ServiceChange> create(
    ServiceChangeDraft draft,
    CancelToken cancel,
  ) async {
    creates++;
    sent = draft;
    return onCreate != null ? onCreate!() : current;
  }

  @override
  Future<ServiceChange> update(
    String id,
    ServiceChangeDraft draft,
    CancelToken cancel,
  ) async {
    updates++;
    sent = draft;
    return current = changeFromJson({
      ...changeJson(type: draft.type),
      'proposedName': draft.name?.trim(),
      'categoryId': draft.categoryId,
      'proposedPriceAmount': draft.price,
      'proposedDurationMinutes': draft.duration,
      'proposedDescription': draft.description?.trim(),
      'updatedAt': '2026-11-02T08:01:00Z',
    });
  }

  @override
  Future<ServiceChange> submit(String id, CancelToken cancel) async {
    submissions++;
    if (onSubmit != null) return onSubmit!();
    return current = changeFromJson(
      changeJson(status: ServiceChangeStatus.pending),
    );
  }

  @override
  Future<ServiceChange> withdraw(String id, CancelToken cancel) async {
    withdrawals++;
    return current = changeFromJson(
      changeJson(status: ServiceChangeStatus.withdrawn),
    );
  }
}

class FakeServiceMediaRepository extends ServiceChangeMediaRepository {
  int uploads = 0, removals = 0;
  FakeServiceMediaRepository() : super(Dio(), Dio());
  @override
  Future<ServiceChangeDocument> upload(
    String id,
    String type,
    XFile file,
    CancelToken cancel,
  ) async {
    uploads++;
    return ServiceChangeDocument(id: 'document', type: type, status: 'PENDING');
  }

  @override
  Future<void> remove(String id, String documentId, CancelToken cancel) async {
    removals++;
  }
}
