import 'package:intl/intl.dart';

/// Shared Vietnamese currency formatters to avoid repeated [NumberFormat] allocations.
class CurrencyUtils {
  CurrencyUtils._();

  static final NumberFormat vndCurrency = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  static final NumberFormat vndDecimal = NumberFormat.decimalPattern('vi_VN');

  static String formatVnd(num? amount) => vndCurrency.format(amount ?? 0);

  static String formatVndCompact(num? amount, {String suffix = 'đ'}) =>
      '${vndDecimal.format(amount ?? 0)}$suffix';
}
