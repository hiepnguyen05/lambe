import '../entities/provider_calendar_block_entity.dart';
import '../entities/provider_setup_entity.dart';
import '../entities/provider_working_hour_entity.dart';

abstract class ProviderScheduleRepository {
  Future<ProviderSetupEntity> getSetup();
  Future<void> updateWorkingHours(List<ProviderWorkingHourEntity> workingHours);
  Future<List<ProviderCalendarBlockEntity>> getCalendar({
    required DateTime from,
    required DateTime to,
  });
  Future<ProviderCalendarBlockEntity> createTimeOff({
    required DateTime from,
    required DateTime to,
    required String reason,
  });
  Future<void> deleteTimeOff(String id);
}
