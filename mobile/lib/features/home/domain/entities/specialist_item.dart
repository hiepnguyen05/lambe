/// Domain Entity đại diện cho một chuyên viên làm đẹp nổi bật trên trang chủ
class SpecialistItem {
  final String id;
  final String name;
  final String specialty;
  final String avatarUrl;
  final double rating;
  final int reviewCount;
  final String distance;
  final String eta;
  final int startingPrice;
  final String unit;
  final bool isVerified;
  final String? highlightTag;

  const SpecialistItem({
    required this.id,
    required this.name,
    required this.specialty,
    required this.avatarUrl,
    required this.rating,
    required this.reviewCount,
    required this.distance,
    required this.eta,
    required this.startingPrice,
    this.unit = 'lần',
    this.isVerified = true,
    this.highlightTag,
  });
}
