enum IncomePeriod { today, week, month }

class ProviderPeriodEarnings {
  final double netIncome;
  final double grossIncome;
  final double commissionDeducted;
  final double platformSubsidy;
  final int completedOrders;

  const ProviderPeriodEarnings({
    this.netIncome = 0.0,
    this.grossIncome = 0.0,
    this.commissionDeducted = 0.0,
    this.platformSubsidy = 0.0,
    this.completedOrders = 0,
  });
}

/// Computes provider earnings across completed orders for [period] in local time.
ProviderPeriodEarnings summarizeProviderEarnings(
  Iterable<Map<String, dynamic>> orders, {
  required IncomePeriod period,
  DateTime? now,
}) {
  final clock = (now ?? DateTime.now()).toLocal();
  final todayStart = DateTime(clock.year, clock.month, clock.day);
  final weekStart = todayStart.subtract(Duration(days: todayStart.weekday - 1));
  final monthStart = DateTime(clock.year, clock.month);

  final DateTime rangeStart;
  final DateTime rangeEnd;
  switch (period) {
    case IncomePeriod.today:
      rangeStart = todayStart;
      rangeEnd = todayStart.add(const Duration(days: 1));
    case IncomePeriod.week:
      rangeStart = weekStart;
      rangeEnd = weekStart.add(const Duration(days: 7));
    case IncomePeriod.month:
      rangeStart = monthStart;
      rangeEnd = DateTime(clock.year, clock.month + 1);
  }

  var gross = 0.0;
  var commission = 0.0;
  var subsidy = 0.0;
  var count = 0;

  for (final order in orders) {
    if (order['status']?.toString() != 'COMPLETED') continue;
    final rawTs =
        (order['completedAt'] ?? order['updatedAt'] ?? order['scheduledAt'])
            ?.toString();
    final ts = rawTs != null ? DateTime.tryParse(rawTs)?.toLocal() : null;
    if (ts == null) continue;
    if (ts.isBefore(rangeStart) || !ts.isBefore(rangeEnd)) continue;

    gross += (order['totalAmount'] as num?)?.toDouble() ?? 0.0;
    commission += (order['commissionAmount'] as num?)?.toDouble() ?? 0.0;
    subsidy += (order['platformFundedAmount'] as num?)?.toDouble() ?? 0.0;
    count++;
  }

  return ProviderPeriodEarnings(
    netIncome: gross + subsidy - commission,
    grossIncome: gross,
    commissionDeducted: commission,
    platformSubsidy: subsidy,
    completedOrders: count,
  );
}
