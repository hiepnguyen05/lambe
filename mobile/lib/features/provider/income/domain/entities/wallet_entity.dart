class WalletEntity {
  final double balanceAmount;
  final double heldAmount;
  final double availableAmount;
  final String currencyCode;

  const WalletEntity({
    required this.balanceAmount,
    required this.heldAmount,
    required this.availableAmount,
    required this.currencyCode,
  });

  factory WalletEntity.fromJson(Map<String, dynamic> json) {
    return WalletEntity(
      balanceAmount: (json['balanceAmount'] as num?)?.toDouble() ?? 0.0,
      heldAmount: (json['heldAmount'] as num?)?.toDouble() ?? 0.0,
      availableAmount: (json['availableAmount'] as num?)?.toDouble() ?? 0.0,
      currencyCode: json['currencyCode'] as String? ?? 'VND',
    );
  }
}
