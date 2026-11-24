class ProviderReview {
  final String id;
  final int rating;
  final String? comment;
  final DateTime createdAt;
  final String? assignedMemberName;
  const ProviderReview({
    required this.id,
    required this.rating,
    this.comment,
    required this.createdAt,
    this.assignedMemberName,
  });

  factory ProviderReview.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final rating = json['rating'];
    final at = DateTime.tryParse(json['createdAt']?.toString() ?? '');
    if (id is! String ||
        id.isEmpty ||
        rating is! int ||
        rating < 1 ||
        rating > 5 ||
        at == null) {
      throw const FormatException('Đánh giá không hợp lệ.');
    }
    final assigned = json['assignedMember'];
    return ProviderReview(
      id: id,
      rating: rating,
      createdAt: at,
      comment: json['comment'] as String?,
      assignedMemberName: assigned is Map
          ? assigned['displayName'] as String?
          : null,
    );
  }
}

class ProviderReviewPage {
  final int count;
  final double? averageRating;
  final List<ProviderReview> reviews;
  final String? nextCursor;
  const ProviderReviewPage({
    required this.count,
    this.averageRating,
    required this.reviews,
    this.nextCursor,
  });

  factory ProviderReviewPage.fromJson(Map<String, dynamic> json) {
    final count = json['count'];
    final rating = json['averageRating'];
    final rows = json['reviews'];
    if (count is! int ||
        count < 0 ||
        rows is! List ||
        (rating != null &&
            (rating is! num || !rating.isFinite || rating < 1 || rating > 5))) {
      throw const FormatException('Danh sách đánh giá không hợp lệ.');
    }
    return ProviderReviewPage(
      count: count,
      averageRating: (rating as num?)?.toDouble(),
      reviews: rows
          .map(
            (row) =>
                ProviderReview.fromJson(Map<String, dynamic>.from(row as Map)),
          )
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}
