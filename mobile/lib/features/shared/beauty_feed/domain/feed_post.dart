import 'package:equatable/equatable.dart';

class FeedIdentity extends Equatable {
  final String id, name;
  final String? avatar;
  const FeedIdentity(this.id, this.name, this.avatar);
  @override
  List<Object?> get props => [id, name, avatar];
}

class FeedMedia extends Equatable {
  final String id, kind, url;
  final int position;
  final int? width, height;
  final double? duration;
  const FeedMedia({
    required this.id,
    required this.kind,
    required this.url,
    required this.position,
    this.width,
    this.height,
    this.duration,
  });
  bool get video => kind == 'VIDEO';
  @override
  List<Object?> get props => [id, kind, url, position, width, height, duration];
}

class FeedService extends Equatable {
  final String id, serviceId, name, status;
  final int price;
  final int? duration;
  const FeedService({
    required this.id,
    required this.serviceId,
    required this.name,
    required this.status,
    required this.price,
    this.duration,
  });
  @override
  List<Object?> get props => [id, serviceId, name, status, price, duration];
}

class FeedPost extends Equatable {
  final String id, caption, status, sharePath;
  final FeedIdentity provider;
  final FeedIdentity? author;
  final List<FeedMedia> media;
  final List<FeedService> services;
  final int revision, likes, comments, saves;
  final bool liked, saved, followed, managed;
  final String? organizationStatus, organizationNote;
  final String? moderationStatus, moderationNote;
  final DateTime createdAt, updatedAt;
  const FeedPost({
    required this.id,
    required this.caption,
    required this.status,
    required this.sharePath,
    required this.provider,
    this.author,
    required this.media,
    required this.services,
    required this.revision,
    required this.likes,
    required this.comments,
    required this.saves,
    required this.liked,
    required this.saved,
    required this.followed,
    this.managed = false,
    this.organizationStatus,
    this.organizationNote,
    this.moderationStatus,
    this.moderationNote,
    required this.createdAt,
    required this.updatedAt,
  });
  bool get published =>
      status == 'PUBLISHED' &&
      (moderationStatus == null || moderationStatus == 'APPROVED') &&
      (organizationStatus == null || organizationStatus == 'APPROVED');
  String get moderationLabel => status == 'HIDDEN'
      ? 'Đã bị nền tảng ẩn'
      : status == 'DELETED'
      ? 'Đã xóa'
      : moderationStatus == 'PENDING'
      ? 'Chờ nền tảng kiểm duyệt'
      : moderationStatus == 'REJECTED'
      ? 'Nền tảng đã từ chối'
      : switch (organizationStatus) {
          'PENDING' => 'Chờ tổ chức duyệt',
          'REJECTED' => 'Tổ chức đã từ chối',
          _ => 'Đã công khai',
        };
  @override
  List<Object?> get props => [
    id,
    caption,
    status,
    sharePath,
    provider,
    author,
    media,
    services,
    revision,
    likes,
    comments,
    saves,
    liked,
    saved,
    followed,
    managed,
    organizationStatus,
    organizationNote,
    moderationStatus,
    moderationNote,
    updatedAt,
  ];
}
