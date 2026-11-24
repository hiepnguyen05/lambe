class BookingSubmissionEntity {
  final String id;
  final String status;
  final DateTime? providerResponseDeadlineAt;

  const BookingSubmissionEntity({
    required this.id,
    required this.status,
    this.providerResponseDeadlineAt,
  });

  factory BookingSubmissionEntity.fromJson(Map<String, dynamic> json) {
    final id = json['id']?.toString();
    final status = json['status']?.toString();
    if (id == null || id.isEmpty || status == null || status.isEmpty) {
      throw const FormatException('Máy chủ trả về đơn đặt lịch không hợp lệ.');
    }
    return BookingSubmissionEntity(
      id: id,
      status: status,
      providerResponseDeadlineAt: DateTime.tryParse(
        json['providerResponseDeadlineAt']?.toString() ?? '',
      ),
    );
  }
}
