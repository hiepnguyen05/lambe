import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

class OrganizationFeedItem {
  final String id;
  final String title;
  final String? content;
  final String? mediaUrl;
  final int revisionNumber;
  final String? authorName;
  final String? authorAvatarUrl;
  final DateTime createdAt;

  const OrganizationFeedItem({
    required this.id,
    required this.title,
    this.content,
    this.mediaUrl,
    required this.revisionNumber,
    this.authorName,
    this.authorAvatarUrl,
    required this.createdAt,
  });

  factory OrganizationFeedItem.fromJson(Map<String, dynamic> json) {
    final authorMap = json['authorMember'] is Map
        ? Map<String, dynamic>.from(json['authorMember'] as Map)
        : null;
    final mediaList = json['media'] is List ? json['media'] as List : null;
    final firstMedia = mediaList != null && mediaList.isNotEmpty && mediaList.first is Map
        ? mediaList.first['url']?.toString()
        : null;

    return OrganizationFeedItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Tác phẩm làm đẹp',
      content: json['content']?.toString() ?? json['caption']?.toString(),
      mediaUrl: firstMedia ?? json['thumbnailUrl']?.toString(),
      revisionNumber: (json['revisionNumber'] as num?)?.toInt() ?? 1,
      authorName: authorMap?['displayName']?.toString() ?? 'Nhân viên',
      authorAvatarUrl: authorMap?['avatarUrl']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class OrganizationFeedReviewState {
  final List<OrganizationFeedItem> pendingPosts;
  final bool isLoading;
  final bool isSubmitting;
  final String? errorMessage;

  const OrganizationFeedReviewState({
    this.pendingPosts = const [],
    this.isLoading = false,
    this.isSubmitting = false,
    this.errorMessage,
  });

  OrganizationFeedReviewState copyWith({
    List<OrganizationFeedItem>? pendingPosts,
    bool? isLoading,
    bool? isSubmitting,
    String? errorMessage,
  }) {
    return OrganizationFeedReviewState(
      pendingPosts: pendingPosts ?? this.pendingPosts,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage,
    );
  }
}

class OrganizationFeedReviewNotifier
    extends StateNotifier<OrganizationFeedReviewState> {
  final ProviderMembersRepository _repository;

  OrganizationFeedReviewNotifier(this._repository)
      : super(const OrganizationFeedReviewState(isLoading: true)) {
    loadPendingPosts();
  }

  Future<void> loadPendingPosts() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final raw = await _repository.getPendingOrganizationFeedPosts();
      final posts = raw.map((m) => OrganizationFeedItem.fromJson(m)).toList();
      state = state.copyWith(pendingPosts: posts, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Lỗi tải danh sách bài duyệt: ${e.toString()}',
      );
    }
  }

  Future<bool> reviewPost({
    required String postId,
    required int revisionNumber,
    required String decision, // 'APPROVE' | 'REJECT'
    String? note,
  }) async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      await _repository.reviewOrganizationFeedPost(
        postId,
        revisionNumber,
        decision,
        note,
      );
      state = state.copyWith(
        pendingPosts: state.pendingPosts.where((p) => p.id != postId).toList(),
        isSubmitting: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Lỗi kiểm duyệt: ${e.toString()}',
      );
      return false;
    }
  }
}

final organizationFeedReviewProvider = StateNotifierProvider.autoDispose<
    OrganizationFeedReviewNotifier, OrganizationFeedReviewState>(
  (ref) {
    final repository = ref.watch(providerMembersRepositoryProvider);
    return OrganizationFeedReviewNotifier(repository);
  },
);

