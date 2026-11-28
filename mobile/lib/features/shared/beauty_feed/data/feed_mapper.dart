import '../domain/feed_post.dart';
import '../domain/feed_comment.dart';
import '../domain/feed_scope.dart';

Map<String, dynamic> feedMap(Object? value) =>
    Map<String, dynamic>.from(value as Map);
String feedString(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Thiếu dữ liệu bài đăng.');
  }
  return value;
}

int _count(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Dữ liệu số lượng không hợp lệ.');
  }
  return value;
}

String mediaUrl(Object? value) {
  final url = feedString(value), uri = Uri.tryParse(value as String);
  if (uri == null ||
      uri.scheme != 'https' ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty) {
    throw const FormatException('Đường dẫn media không hợp lệ.');
  }
  return url;
}

FeedIdentity _identity(Map<String, dynamic> data, {bool user = false}) =>
    FeedIdentity(
      feedString(data['id']),
      (data[user ? 'fullName' : 'displayName'] as String?) ??
          (user ? 'Khách hàng' : 'Đối tác'),
      data['avatarUrl'] as String?,
    );
FeedPost feedPostFromJson(Map<String, dynamic> json, {bool managed = false}) {
  final counts = feedMap(json['counts']), viewer = feedMap(json['viewer']);
  final review = json['organizationReview'] == null
      ? null
      : feedMap(json['organizationReview']);
  return FeedPost(
    id: feedString(json['id']),
    caption: json['caption'] as String,
    status: feedString(json['status']),
    sharePath: feedString(json['sharePath']),
    provider: _identity(feedMap(json['provider'])),
    author: json['authorMember'] == null
        ? null
        : _identity(feedMap(json['authorMember'])),
    revision: _count(json['revisionNumber']),
    likes: _count(counts['likes']),
    comments: _count(counts['comments']),
    saves: _count(counts['saves']),
    liked: viewer['liked'] as bool,
    saved: viewer['saved'] as bool,
    followed: viewer['followed'] as bool,
    managed: managed,
    organizationStatus: review?['status'] as String?,
    organizationNote: review?['note'] as String?,
    moderationStatus: managed && json['moderation'] is Map
        ? (json['moderation'] as Map)['status'] as String?
        : null,
    moderationNote: managed && json['moderation'] is Map
        ? (json['moderation'] as Map)['note'] as String?
        : null,
    createdAt: DateTime.parse(feedString(json['createdAt'])).toUtc(),
    updatedAt: DateTime.parse(feedString(json['updatedAt'])).toUtc(),
    media: (json['media'] as List)
        .map((v) {
          final row = feedMap(v), kind = feedString(row['kind']);
          if (!const {'IMAGE', 'VIDEO'}.contains(kind)) {
            throw const FormatException('Loại media không được hỗ trợ.');
          }
          return FeedMedia(
            id: feedString(row['id']),
            kind: kind,
            url: mediaUrl(row['url']),
            position: _count(row['position']),
            width: row['width'] as int?,
            height: row['height'] as int?,
            duration: (row['durationSeconds'] as num?)?.toDouble(),
          );
        })
        .toList(growable: false),
    services: (json['services'] as List)
        .map((v) {
          final row = feedMap(v), service = feedMap(row['service']);
          final category = service['category'];
          final categorySlug = category is Map
              ? category['slug'] as String?
              : service['categorySlug'] as String?;
          return FeedService(
            id: feedString(row['id']),
            serviceId: feedString(service['id']),
            name: feedString(service['name']),
            status: feedString(row['status']),
            categoryId: service['categoryId'] as String?,
            categorySlug: categorySlug,
            price: _count(row['priceAmount']),
            duration: row['durationMinutes'] as int?,
          );
        })
        .toList(growable: false),
  );
}

FeedComment feedCommentFromJson(Map<String, dynamic> row) => FeedComment(
  id: feedString(row['id']),
  parentId: row['parentId'] as String?,
  text: row['text'] as String?,
  deleted: row['deleted'] == true,
  user: _identity(feedMap(row['user']), user: true),
  createdAt: DateTime.parse(feedString(row['createdAt'])).toUtc(),
  replyCount: row['replyCount'] as int? ?? 0,
  replies: (row['replies'] as List? ?? [])
      .map((v) => feedCommentFromJson(feedMap(v)))
      .toList(growable: false),
);
FeedPage<T> feedPageFromJson<T>(
  Map<String, dynamic> json,
  T Function(Map<String, dynamic>) parse,
) => FeedPage(
  (json['data'] as List).map((v) => parse(feedMap(v))).toList(growable: false),
  json['nextCursor'] as String?,
);
