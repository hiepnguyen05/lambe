import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../domain/feed_post.dart';
import '../domain/feed_scope.dart';
import '../domain/feed_comment.dart';
import 'feed_mapper.dart';
import 'feed_local_cache.dart';

class FeedRepository {
  final Dio dio;
  final FeedLocalCache? local;
  FeedRepository(this.dio, {this.local});
  Future<void> reportComment(
    String id,
    String reason,
    CancelToken cancel,
  ) async => ApiResponseParser.ensureSuccess(
    await dio.post(
      '/me/feed/comments/$id/reports',
      data: {'reason': reason},
      cancelToken: cancel,
    ),
  );
  Future<void> appeal(
    String id,
    int revision,
    String reason,
    CancelToken cancel,
  ) async => ApiResponseParser.ensureSuccess(
    await dio.post(
      '/me/feed/posts/$id/appeal',
      data: {'revisionNumber': revision, 'reason': reason.trim()},
      cancelToken: cancel,
    ),
  );
  Future<FeedPage<FeedPost>> list(
    FeedScope scope,
    CancelToken cancel, {
    required bool signedIn,
    String? cursor,
  }) async {
    final path = scope.mode == FeedMode.all
        ? (signedIn ? '/me/feed/posts' : '/feed/posts')
        : '/me/feed/${scope.mode.name}';
    final response = await dio.get(
      path,
      queryParameters: {
        'limit': 20,
        if (cursor != null) 'cursor': cursor,
        if (scope.providerId != null) 'providerId': scope.providerId,
        if (scope.serviceId != null) 'serviceId': scope.serviceId,
        if (scope.categorySlug != null && scope.categorySlug!.trim().isNotEmpty)
          'categorySlug': scope.categorySlug!.trim(),
        if (scope.search != null && scope.search!.trim().isNotEmpty)
          'search': scope.search!.trim(),
      },
      cancelToken: cancel,
    );
    return feedPageFromJson(
      ApiResponseParser.dataMap(response),
      (json) => feedPostFromJson(json, managed: scope.mode == FeedMode.mine),
    );
  }

  Future<FeedPost> detail(
    FeedDetailScope scope,
    CancelToken cancel, {
    required bool signedIn,
  }) async {
    final path = scope.manage
        ? '/me/feed/posts/${scope.id}/manage'
        : '${signedIn ? '/me' : ''}/feed/posts/${scope.id}';
    late final Map<String, dynamic> body;
    try {
      body = ApiResponseParser.dataMap(
        await dio.get(path, cancelToken: cancel),
      );
    } on DioException catch (error) {
      if (const {403, 404}.contains(error.response?.statusCode)) {
        await local?.remove(scope.id);
      }
      rethrow;
    }
    final value = feedPostFromJson(body, managed: scope.manage);
    if (value.id != scope.id) {
      throw const FormatException('Bài đăng không khớp.');
    }
    return value;
  }

  Future<bool> react(
    String id,
    String kind,
    bool enabled,
    CancelToken cancel,
  ) async {
    if (!const {'like', 'save', 'follow'}.contains(kind)) {
      throw ArgumentError('Invalid interaction');
    }
    final path = kind == 'follow'
        ? '/me/feed/providers/$id/follow'
        : '/me/feed/posts/$id/$kind';
    final response = enabled
        ? await dio.put(path, cancelToken: cancel)
        : await dio.delete(path, cancelToken: cancel);
    final value = ApiResponseParser.dataMap(
      response,
    )[kind == 'follow' ? 'following' : '${kind}d'];
    // "like" -> liked, "save" -> saved.
    if (value is! bool) throw const FormatException('Thiếu kết quả tương tác.');
    return value;
  }

  Future<FeedPage<FeedComment>> comments(
    String postId,
    CancelToken cancel, {
    String? cursor,
    String? parentId,
  }) async => feedPageFromJson(
    ApiResponseParser.dataMap(
      await dio.get(
        '/feed/posts/$postId/comments${parentId == null ? '' : '/$parentId/replies'}',
        queryParameters: {'limit': 20, if (cursor != null) 'cursor': cursor},
        cancelToken: cancel,
      ),
    ),
    feedCommentFromJson,
  );
  Future<FeedComment> comment(
    String postId,
    String text,
    CancelToken cancel, {
    String? parentId,
  }) async => feedCommentFromJson(
    ApiResponseParser.dataMap(
      await dio.post(
        '/me/feed/posts/$postId/comments',
        data: {'text': text.trim(), if (parentId != null) 'parentId': parentId},
        cancelToken: cancel,
      ),
    ),
  );
  Future<void> deleteComment(
    String postId,
    String id,
    CancelToken cancel,
  ) async => ApiResponseParser.ensureSuccess(
    await dio.delete(
      '/me/feed/posts/$postId/comments/$id',
      cancelToken: cancel,
    ),
  );
  Future<void> report(
    String id,
    String reason,
    String? detail,
    CancelToken cancel,
  ) async => ApiResponseParser.ensureSuccess(
    await dio.post(
      '/me/feed/posts/$id/reports',
      data: {
        'reason': reason,
        if (detail?.trim().isNotEmpty == true) 'detail': detail!.trim(),
      },
      cancelToken: cancel,
    ),
  );
  Future<FeedPost> update(
    String id,
    int revision,
    String caption,
    List<String> serviceIds,
    CancelToken cancel,
  ) async => feedPostFromJson(
    ApiResponseParser.dataMap(
      await dio.patch(
        '/me/feed/posts/$id',
        data: {
          'revisionNumber': revision,
          'caption': caption.trim(),
          'providerServiceIds': serviceIds,
        },
        cancelToken: cancel,
      ),
    ),
    managed: true,
  );
  Future<void> remove(String id, CancelToken cancel) async =>
      ApiResponseParser.ensureSuccess(
        await dio.delete('/me/feed/posts/$id', cancelToken: cancel),
      );
}
