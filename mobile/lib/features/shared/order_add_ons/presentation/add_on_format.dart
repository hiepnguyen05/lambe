import 'package:intl/intl.dart';

final _amount = NumberFormat.decimalPattern('vi_VN');
final _time = DateFormat('HH:mm · dd/MM/yyyy');
String addOnMoney(int value, String currency) =>
    '${_amount.format(value)} ${currency == 'VND' ? 'đ' : currency}';
String addOnTime(DateTime value) =>
    _time.format(value.toUtc().add(const Duration(hours: 7)));
