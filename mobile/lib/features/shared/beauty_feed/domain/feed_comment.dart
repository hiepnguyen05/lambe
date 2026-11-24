import 'feed_post.dart';

class FeedComment {
  final String id;
  final String? parentId, text;
  final bool deleted;
  final FeedIdentity user;
  final DateTime createdAt;
  final List<FeedComment> replies;
  final int replyCount;
  const FeedComment({
    required this.id,
    this.parentId,
    this.text,
    required this.deleted,
    required this.user,
    required this.createdAt,
    this.replies = const [],
    this.replyCount = 0,
  });
}
