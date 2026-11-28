import 'package:equatable/equatable.dart';

enum FeedMode { all, following, saved, mine }

class FeedScope extends Equatable {
  final FeedMode mode;
  final String? providerId, serviceId, categorySlug, search;
  const FeedScope({
    this.mode = FeedMode.all,
    this.providerId,
    this.serviceId,
    this.categorySlug,
    this.search,
  });
  @override
  List<Object?> get props => [mode, providerId, serviceId, categorySlug, search];
}

class FeedDetailScope extends Equatable {
  final String id;
  final bool manage;
  const FeedDetailScope(this.id, {this.manage = false});
  @override
  List<Object?> get props => [id, manage];
}

class FeedPage<T> {
  final List<T> items;
  final String? cursor;
  const FeedPage(this.items, this.cursor);
}
