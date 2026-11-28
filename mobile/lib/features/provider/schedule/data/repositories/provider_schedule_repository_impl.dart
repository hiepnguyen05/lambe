import '../../domain/entities/provider_calendar_block_entity.dart';
import '../../domain/entities/provider_setup_entity.dart';
import '../../domain/entities/provider_working_hour_entity.dart';
import '../../domain/repositories/provider_schedule_repository.dart';
import '../datasources/provider_schedule_remote_datasource.dart';

class ProviderScheduleRepositoryImpl implements ProviderScheduleRepository {
  final ProviderScheduleRemoteDataSource _remoteDataSource;

  ProviderScheduleRepositoryImpl(this._remoteDataSource);

  @override
  Future<ProviderSetupEntity> getSetup() {
    return _remoteDataSource.getSetup();
  }

  @override
  Future<void> updateServiceArea(ProviderSetupEntity setup) =>
      _remoteDataSource.updateServiceArea(setup);

  @override
  Future<void> updateWorkingHours(
    List<ProviderWorkingHourEntity> workingHours,
  ) {
    return _remoteDataSource.updateWorkingHours(workingHours);
  }

  @override
  Future<List<ProviderCalendarBlockEntity>> getCalendar({
    required DateTime from,
    required DateTime to,
  }) {
    return _remoteDataSource.getCalendar(from: from, to: to);
  }

  @override
  Future<ProviderCalendarBlockEntity> createTimeOff({
    required DateTime from,
    required DateTime to,
    required String reason,
  }) {
    return _remoteDataSource.createTimeOff(from: from, to: to, reason: reason);
  }

  @override
  Future<void> deleteTimeOff(String id) {
    return _remoteDataSource.deleteTimeOff(id);
  }
}
