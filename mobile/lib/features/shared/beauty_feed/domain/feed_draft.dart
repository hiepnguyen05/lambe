class FeedDraft {
  final String caption;
  final String? memberId;
  final List<String> serviceIds;
  final bool includesCustomer, hasConsent;
  const FeedDraft({
    required this.caption,
    this.memberId,
    required this.serviceIds,
    required this.includesCustomer,
    required this.hasConsent,
  });
  String? validate() {
    final length = caption.trim().runes.length;
    if (length < 1 || length > 2000) {
      return 'Nội dung cần từ 1 đến 2.000 ký tự.';
    }
    if (serviceIds.isEmpty ||
        serviceIds.length > 5 ||
        serviceIds.toSet().length != serviceIds.length) {
      return 'Chọn 1–5 dịch vụ khác nhau đang cung cấp.';
    }
    if (includesCustomer && !hasConsent) {
      return 'Cần được khách đồng ý sử dụng hình ảnh trước khi đăng.';
    }
    return null;
  }
}
