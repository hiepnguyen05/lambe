import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/data/provider_services_repository.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';

import 'support/service_fakes.dart';

void main() {
  test('all offering and proposal operations use the exact REST paths, methods and DTOs', () async {
    final requests = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          Object data;
          Map<String, dynamic>? meta;
          if (options.path == '/services') {
            data = [definitionJson()];
          } else if (options.path.startsWith('/services/')) {
            data = definitionJson();
          } else if (options.path == '/categories') {
            data = [
              {'id': 'category', 'name': 'Tóc'},
            ];
          } else if (options.path == ProviderServicesRepository.offeringsPath) {
            data = [offeringJson()];
          } else if (options.path.startsWith(
            '${ProviderServicesRepository.offeringsPath}/',
          )) {
            data = offeringJson(
              status: options.method == 'PUT' ? 'INACTIVE' : 'ACTIVE',
            );
          } else if (options.path == ProviderServicesRepository.changesPath &&
              options.method == 'GET') {
            data = [changeJson()];
            meta = {'page': 2, 'totalPages': 3};
          } else {
            data = changeJson();
          }
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': data,
                if (meta != null) 'meta': meta,
              },
            ),
          );
        },
      ),
    );
    final repo = ProviderServicesRepository(dio), cancel = CancelToken();
    await repo.offerings(cancel);
    await repo.offering('offering', cancel);
    await repo.availability('offering', false, cancel);
    await repo.catalog(cancel);
    await repo.catalogService('cat-toc-nam', cancel);
    await repo.categories(cancel);
    final page = await repo.changes(
      cancel,
      status: ServiceChangeStatus.needsChanges,
      page: 2,
    );
    expect(page.hasMore, isTrue);
    expect(requests.last.queryParameters, {
      'page': 2,
      'limit': 20,
      'status': 'NEEDS_CHANGES',
    });
    await repo.create(draft(), cancel);
    await repo.update('request', draft(), cancel);
    await repo.change('request', cancel);
    await repo.submit('request', cancel);
    await repo.withdraw('request', cancel);
    expect(requests.map((v) => '${v.method} ${v.path}'), [
      'GET /me/provider/services',
      'GET /me/provider/services/offering',
      'PUT /me/provider/services/offering/availability',
      'GET /services',
      'GET /services/cat-toc-nam',
      'GET /categories',
      'GET /me/provider/service-change-requests',
      'POST /me/provider/service-change-requests',
      'PATCH /me/provider/service-change-requests/request',
      'GET /me/provider/service-change-requests/request',
      'POST /me/provider/service-change-requests/request/submit',
      'POST /me/provider/service-change-requests/request/withdraw',
    ]);
    expect(requests[2].data, {'active': false});
    expect(requests[7].data, containsPair('providerServiceId', 'offering'));
    expect(requests[8].data, isNot(contains('type')));
    expect(requests.every((v) => v.cancelToken == cancel), isTrue);
  });
  test('a mismatched offering or proposal ID is never adopted', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {
              'success': true,
              'data': options.path.contains('/services/')
                  ? {...offeringJson(), 'id': 'other'}
                  : changeJson(id: 'other'),
            },
          ),
        ),
      ),
    );
    final repo = ProviderServicesRepository(dio);
    await expectLater(
      () => repo.offering('offering', CancelToken()),
      throwsFormatException,
    );
    await expectLater(
      () => repo.change('request', CancelToken()),
      throwsFormatException,
    );
  });
  test('invalid pagination metadata is rejected instead of inventing a complete list', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {
              'success': true,
              'data': [],
              'meta': {'page': 99, 'totalPages': 100},
            },
          ),
        ),
      ),
    );
    expect(
      () => ProviderServicesRepository(dio).changes(CancelToken()),
      throwsFormatException,
    );
  });
}
