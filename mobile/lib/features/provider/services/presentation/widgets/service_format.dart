import 'package:intl/intl.dart';

final _money = NumberFormat.decimalPattern('vi_VN');
String serviceMoney(int value) => '${_money.format(value)} đ';
String serviceTime(DateTime value) =>
    '${DateFormat('HH:mm dd/MM/yyyy').format(value.toUtc().add(const Duration(hours: 7)))} (giờ Việt Nam)';
