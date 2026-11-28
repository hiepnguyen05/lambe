import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/app_mini_map.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';

import '../../di/provider_schedule_providers.dart';
import '../../domain/entities/provider_setup_entity.dart';

class ProviderServiceAreaScreen extends ConsumerStatefulWidget {
  const ProviderServiceAreaScreen({super.key});

  @override
  ConsumerState<ProviderServiceAreaScreen> createState() =>
      _ProviderServiceAreaScreenState();
}

class _ProviderServiceAreaScreenState
    extends ConsumerState<ProviderServiceAreaScreen> {
  final _name = TextEditingController();
  final _map = MapController();
  final _form = GlobalKey<FormState>();
  LatLng? _center;
  int _radius = 10;
  bool _loading = true, _saving = false, _locating = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _message(Object error) => error is DioException
      ? ExceptionHandler.extractMessage(error)
      : error.toString().replaceFirst('Exception: ', '');

  Future<void> _load() async {
    try {
      final setup = await ref
          .read(providerScheduleRepositoryProvider)
          .getSetup();
      if (!mounted) return;
      _name.text = setup.serviceAreaName;
      setState(() {
        _radius = setup.serviceRadiusKm.clamp(1, 50);
        if (setup.serviceAreaLatitude != null &&
            setup.serviceAreaLongitude != null) {
          _center = LatLng(
            setup.serviceAreaLatitude!,
            setup.serviceAreaLongitude!,
          );
        }
        _loading = false;
        _loadError = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = _message(error);
        });
      }
    }
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      final position = await ref
          .read(providerLocationCoordinatorProvider)
          .capture(requestPermission: true);
      if (!mounted) return;
      final point = LatLng(position.latitude, position.longitude);
      setState(() => _center = point);
      _map.move(point, 14);
    } catch (error) {
      if (mounted) AppDialog.error(context, message: _message(error));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    if (_saving || !_form.currentState!.validate()) return;
    final center = _center;
    if (center == null) {
      AppDialog.warning(context, message: 'Hãy chọn tâm khu vực trên bản đồ.');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(providerScheduleRepositoryProvider)
          .updateServiceArea(
            ProviderSetupEntity(
              serviceAreaName: _name.text.trim(),
              serviceAreaLatitude: center.latitude,
              serviceAreaLongitude: center.longitude,
              serviceRadiusKm: _radius,
            ),
          );
      if (!mounted) return;
      ref.invalidate(providerDashboardProvider);
      ref.invalidate(partnerProfileNotifierProvider);
      ref.invalidate(providerScheduleNotifierProvider);
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) AppDialog.error(context, message: _message(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Khu vực phục vụ')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_loadError!, textAlign: TextAlign.center),
                    TextButton(
                      onPressed: () {
                        setState(() => _loading = true);
                        _load();
                      },
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            )
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text(
                    'Chọn nơi bạn thường nhận lịch hẹn',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Đặt trước dùng tâm khu vực và bán kính bạn lưu ở đây, kể cả khi bạn offline. Đặt ngay dùng vị trí GPS khi bạn bật hoạt động.',
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _name,
                    enabled: !_saving,
                    maxLength: 200,
                    decoration: const InputDecoration(
                      labelText: 'Tên khu vực',
                      hintText: 'Ví dụ: Từ Sơn, Bắc Ninh',
                      prefixIcon: Icon(Icons.place_outlined),
                    ),
                    validator: (value) => (value?.trim().length ?? 0) < 2
                        ? 'Nhập tên khu vực từ 2 ký tự.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _saving || _locating ? null : _locate,
                    icon: _locating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.my_location),
                    label: Text(
                      _locating
                          ? 'Đang lấy vị trí...'
                          : 'Lấy vị trí hiện tại làm tâm',
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Chạm bản đồ để điều chỉnh tâm khu vực.'),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 280,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: IgnorePointer(
                        ignoring: _saving || _locating,
                        child: AppMiniMap(
                          mapController: _map,
                          mode: AppMiniMapMode.addressPicker,
                          initialCenter:
                              _center ?? const LatLng(21.028511, 105.804817),
                          destination: _center,
                          destinationLabel: 'Tâm khu vực phục vụ',
                          onSelectLocation: (point) =>
                              setState(() => _center = point),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Bán kính phục vụ: $_radius km',
                    style: Theme.of(context).textTheme.titleMedium
                        ?.copyWith(color: colors.primary),
                  ),
                  Slider(
                    value: _radius.toDouble(),
                    min: 1,
                    max: 50,
                    divisions: 49,
                    label: '$_radius km',
                    onChanged: _saving
                        ? null
                        : (value) => setState(() => _radius = value.round()),
                  ),
                  const Text(
                    'Khách đặt trước trong phạm vi này có thể tìm thấy bạn nếu dịch vụ và lịch làm việc phù hợp.',
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _saving || _locating ? null : _save,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check),
                    label: Text(
                      _saving ? 'Đang lưu...' : 'Lưu khu vực phục vụ',
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }
}
