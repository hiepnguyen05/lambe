import 'package:equatable/equatable.dart';

class ProviderWorkingHourEntity extends Equatable {
  final int dayOfWeek; // 0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7
  final int startMinute; // 0..1439 (e.g. 480 = 08:00)
  final int endMinute; // 1..1440 (e.g. 1260 = 21:00)
  final bool isWorking;

  const ProviderWorkingHourEntity({
    required this.dayOfWeek,
    this.startMinute = 480, // 08:00
    this.endMinute = 1260, // 21:00
    this.isWorking = true,
  });

  String get dayName {
    switch (dayOfWeek) {
      case 1:
        return 'Thứ Hai';
      case 2:
        return 'Thứ Ba';
      case 3:
        return 'Thứ Tư';
      case 4:
        return 'Thứ Năm';
      case 5:
        return 'Thứ Sáu';
      case 6:
        return 'Thứ Bảy';
      case 0:
      default:
        return 'Chủ Nhật';
    }
  }

  String get shortDayName {
    switch (dayOfWeek) {
      case 1:
        return 'T2';
      case 2:
        return 'T3';
      case 3:
        return 'T4';
      case 4:
        return 'T5';
      case 5:
        return 'T6';
      case 6:
        return 'T7';
      case 0:
      default:
        return 'CN';
    }
  }

  String get startTimeFormatted {
    final hour = (startMinute ~/ 60).toString().padLeft(2, '0');
    final min = (startMinute % 60).toString().padLeft(2, '0');
    return '$hour:$min';
  }

  String get endTimeFormatted {
    final hour = (endMinute ~/ 60).toString().padLeft(2, '0');
    final min = (endMinute % 60).toString().padLeft(2, '0');
    return '$hour:$min';
  }

  double get workingHoursCount {
    if (!isWorking || endMinute <= startMinute) return 0;
    return (endMinute - startMinute) / 60.0;
  }

  ProviderWorkingHourEntity copyWith({
    int? dayOfWeek,
    int? startMinute,
    int? endMinute,
    bool? isWorking,
  }) {
    return ProviderWorkingHourEntity(
      dayOfWeek: dayOfWeek ?? this.dayOfWeek,
      startMinute: startMinute ?? this.startMinute,
      endMinute: endMinute ?? this.endMinute,
      isWorking: isWorking ?? this.isWorking,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dayOfWeek': dayOfWeek,
      'startMinute': startMinute,
      'endMinute': endMinute,
    };
  }

  factory ProviderWorkingHourEntity.fromJson(Map<String, dynamic> json) {
    return ProviderWorkingHourEntity(
      dayOfWeek: (json['dayOfWeek'] as num).toInt(),
      startMinute: (json['startMinute'] as num).toInt(),
      endMinute: (json['endMinute'] as num).toInt(),
      isWorking: true,
    );
  }

  @override
  List<Object?> get props => [dayOfWeek, startMinute, endMinute, isWorking];
}
