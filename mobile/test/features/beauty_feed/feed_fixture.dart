import 'package:dio/dio.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_mapper.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_repository.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_post.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_comment.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';

Map<String, dynamic> postJson({
  String id = 'post-1',
  bool liked = false,
  String status = 'PUBLISHED',
  String? review,
}) => {
  'id': id,
  'status': status,
  'caption': 'Tóc cho buổi hẹn',
  'revisionNumber': 2,
  'provider': {'id': 'provider-1', 'displayName': 'An', 'avatarUrl': null},
  'authorMember': null,
  'media': [
    {
      'id': 'media-1',
      'kind': 'IMAGE',
      'url': 'https://example.test/photo.png',
      'position': 0,
    },
  ],
  'services': [
    {
      'id': 'offering-1',
      'priceAmount': 150000,
      'durationMinutes': 45,
      'status': 'ACTIVE',
      'service': {
        'id': 'catalog-1',
        'name': 'Cắt tóc',
        'categoryId': 'category-1',
      },
    },
  ],
  'counts': {'likes': 3, 'comments': 1, 'saves': 2},
  'viewer': {'liked': liked, 'saved': false, 'followed': false},
  'createdAt': '2026-11-02T01:00:00Z',
  'updatedAt': '2026-11-02T02:00:00Z',
  'sharePath': '/feed/posts/$id',
  if (review != null)
    'organizationReview': {'status': review, 'note': 'Nội dung cần bổ sung'},
};
FeedPost post({
  String id = 'post-1',
  bool liked = false,
  bool managed = false,
  String status = 'PUBLISHED',
  String? review,
}) => feedPostFromJson(
  postJson(id: id, liked: liked, status: status, review: review),
  managed: managed,
);
Map<String, dynamic> commentJson({
  String id = 'comment-1',
  String? parent,
  bool deleted = false,
}) => {
  'id': id,
  'parentId': parent,
  'text': deleted ? null : 'Rất đẹp',
  'deleted': deleted,
  'user': {'id': 'user-1', 'fullName': 'Khách'},
  'createdAt': '2026-11-02T02:00:00Z',
};
DioException failure([int? status]) => DioException(
  requestOptions: RequestOptions(path: '/test'),
  response: status == null
      ? null
      : Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: status,
          data: {'message': 'Không thành công'},
        ),
  type: status == null
      ? DioExceptionType.receiveTimeout
      : DioExceptionType.badResponse,
);

class FakeFeedRepository extends FeedRepository {
  FakeFeedRepository() : super(Dio());
  Future<FeedPage<FeedPost>> Function(FeedScope, String?)? onList;
  Future<FeedPost> Function(FeedDetailScope)? onDetail;
  Future<bool> Function(String, String, bool)? onReact;
  Future<FeedPage<FeedComment>> Function(String?, String?)? onComments;
  Future<FeedComment> Function(String, String?)? onComment;
  Future<void> Function(String)? onRemove;
  Future<FeedPost> Function(int)? onUpdate;
  int listCalls = 0,
      detailCalls = 0,
      reactCalls = 0,
      commentCalls = 0,
      removeCalls = 0,
      updateCalls = 0;
  @override
  Future<FeedPage<FeedPost>> list(
    FeedScope scope,
    CancelToken cancel, {
    required bool signedIn,
    String? cursor,
  }) {
    listCalls++;
    return onList?.call(scope, cursor) ??
        Future.value(FeedPage([post()], null));
  }

  @override
  Future<FeedPost> detail(
    FeedDetailScope scope,
    CancelToken cancel, {
    required bool signedIn,
  }) {
    detailCalls++;
    return onDetail?.call(scope) ??
        Future.value(post(id: scope.id, managed: scope.manage));
  }

  @override
  Future<bool> react(String id, String kind, bool enabled, CancelToken cancel) {
    reactCalls++;
    return onReact?.call(id, kind, enabled) ?? Future.value(enabled);
  }

  @override
  Future<FeedPage<FeedComment>> comments(
    String postId,
    CancelToken cancel, {
    String? cursor,
    String? parentId,
  }) =>
      onComments?.call(cursor, parentId) ??
      Future.value(const FeedPage([], null));
  @override
  Future<FeedComment> comment(
    String postId,
    String text,
    CancelToken cancel, {
    String? parentId,
  }) {
    commentCalls++;
    return onComment?.call(text, parentId) ??
        Future.value(feedCommentFromJson(commentJson(parent: parentId)));
  }

  @override
  Future<void> remove(String id, CancelToken cancel) {
    removeCalls++;
    return onRemove?.call(id) ?? Future.value();
  }

  @override
  Future<FeedPost> update(
    String id,
    int revision,
    String caption,
    List<String> serviceIds,
    CancelToken cancel,
  ) {
    updateCalls++;
    return onUpdate?.call(revision) ??
        Future.value(post(id: id, managed: true));
  }
}
