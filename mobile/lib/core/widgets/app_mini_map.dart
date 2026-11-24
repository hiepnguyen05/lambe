import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../constants/map_constants.dart';
import '../theme/app_colors.dart';
import 'app_map_tile_layer.dart';

enum AppMiniMapMode { customerTracking, providerNavigation, addressPicker }

class AppMiniMap extends StatefulWidget {
  final MapController mapController;
  final AppMiniMapMode mode;
  final LatLng initialCenter;
  final LatLng? destination;
  final LatLng? currentPosition;
  final List<LatLng> routePoints;
  final int? durationSeconds;
  final int? distanceMeters;
  final String destinationLabel;
  final String positionLabel;
  final ValueChanged<LatLng>? onSelectLocation;
  final VoidCallback? onNavigate;
  final bool showControls;

  const AppMiniMap({
    super.key,
    required this.mapController,
    required this.mode,
    required this.initialCenter,
    this.destination,
    this.currentPosition,
    this.routePoints = const [],
    this.durationSeconds,
    this.distanceMeters,
    this.destinationLabel = 'Điểm hẹn',
    this.positionLabel = 'Bạn ở đây',
    this.onSelectLocation,
    this.onNavigate,
    this.showControls = true,
  });

  @override
  State<AppMiniMap> createState() => _AppMiniMapState();
}

class _AppMiniMapState extends State<AppMiniMap> with TickerProviderStateMixin {
  late final AnimationController _movement;
  late final AnimationController _pulse;
  LatLng? _start;
  LatLng? _end;
  bool _didFitRoute = false;
  bool _following = false;

  @override
  void initState() {
    super.initState();
    _start = widget.currentPosition;
    _end = widget.currentPosition;
    _movement = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4500),
      value: 1,
    );
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
    _scheduleInitialFit();
  }

  @override
  void didUpdateWidget(covariant AppMiniMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.mode != oldWidget.mode ||
        widget.destination != oldWidget.destination) {
      _didFitRoute = false;
    }
    if (widget.currentPosition != oldWidget.currentPosition) {
      final next = widget.currentPosition;
      if (next == null) {
        _movement.stop();
        _start = null;
        _end = null;
      } else {
        final displayed = _displayedPosition;
        _start = displayed ?? next;
        _end = next;
        if (displayed == null || displayed == next) {
          _movement.value = 1;
        } else {
          _movement.forward(from: 0);
        }
        if (_following && _didFitRoute) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              widget.mapController.move(next, widget.mapController.camera.zoom);
            }
          });
        }
      }
    }
    _scheduleInitialFit();
  }

  LatLng? get _displayedPosition {
    final end = _end;
    if (end == null) return null;
    final start = _start ?? end;
    final progress = _movement.value;
    return LatLng(
      start.latitude + (end.latitude - start.latitude) * progress,
      start.longitude + (end.longitude - start.longitude) * progress,
    );
  }

  void _scheduleInitialFit() {
    if (_didFitRoute ||
        widget.mode == AppMiniMapMode.addressPicker ||
        widget.currentPosition == null ||
        widget.destination == null) {
      return;
    }
    _didFitRoute = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _showRoute();
    });
  }

  double get _maxZoom => switch (widget.mode) {
    AppMiniMapMode.customerTracking => 15,
    AppMiniMapMode.providerNavigation => 18,
    AppMiniMapMode.addressPicker => 19,
  };

  void _showRoute() {
    final destination = widget.destination;
    final position = widget.currentPosition;
    if (destination == null) return;
    if (position == null) {
      widget.mapController.move(destination, _maxZoom.clamp(0, 16));
      return;
    }
    widget.mapController.fitCamera(
      CameraFit.bounds(
        bounds: LatLngBounds.fromPoints([position, destination]),
        padding: const EdgeInsets.fromLTRB(48, 96, 48, 48),
        maxZoom: _maxZoom.clamp(0, 15),
      ),
    );
  }

  void _centerOnPosition() {
    final position = widget.currentPosition;
    if (position == null) return;
    if (widget.mode == AppMiniMapMode.providerNavigation) {
      setState(() => _following = true);
    }
    widget.mapController.move(position, _maxZoom.clamp(0, 16));
  }

  @override
  void dispose() {
    _movement.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isAddress = widget.mode == AppMiniMapMode.addressPicker;
    final hasRoute =
        widget.currentPosition != null && widget.routePoints.length > 1;

    return RepaintBoundary(
      child: Stack(
        children: [
        FlutterMap(
          mapController: widget.mapController,
          options: MapOptions(
            initialCenter: widget.currentPosition ?? widget.initialCenter,
            initialZoom: isAddress ? 16 : 14.5,
            minZoom: isAddress ? 12 : 11,
            maxZoom: _maxZoom,
            backgroundColor: LambeTrackingMapTone.backgroundColor,
            onTap: widget.onSelectLocation == null
                ? null
                : (_, point) => widget.onSelectLocation!(point),
            onPositionChanged: (_, hasGesture) {
              if (hasGesture && _following) setState(() => _following = false);
            },
          ),
          children: [
            const AppMapTileLayer.tracking(),
            if (hasRoute)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: widget.routePoints,
                    strokeWidth: 9,
                    color: const Color(0xE6FFFFFF),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                  Polyline(
                    points: widget.routePoints,
                    strokeWidth: 5,
                    color: AppColors.primaryContainer,
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                ],
              ),
            AnimatedBuilder(
              animation: Listenable.merge([_movement, _pulse]),
              builder: (context, _) {
                final position = _displayedPosition;
                return MarkerLayer(
                  markers: [
                    if (widget.destination != null)
                      Marker(
                        point: widget.destination!,
                        width: 94,
                        height: 72,
                        child: _DestinationMarker(
                          label: widget.destinationLabel,
                        ),
                      ),
                    if (position != null && !isAddress)
                      Marker(
                        point: position,
                        width: 94,
                        height: 78,
                        child: _CurrentPositionMarker(
                          label: widget.positionLabel,
                          pulse: _pulse.value,
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
        if (widget.showControls) ...[
          Positioned(
            top: 14,
            left: 14,
            right: 68,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _MapSummary(
                isAddress: isAddress,
                hasDestination: widget.destination != null,
                hasPosition: widget.currentPosition != null,
                durationSeconds: widget.durationSeconds,
                distanceMeters: widget.distanceMeters,
              ),
            ),
          ),
          Positioned(
            top: 14,
            right: 14,
            child: Column(
              children: [
                if (widget.mode == AppMiniMapMode.providerNavigation &&
                    widget.onNavigate != null) ...[
                  _MapButton(
                    icon: Icons.near_me_rounded,
                    tooltip: 'Mở chỉ đường',
                    onTap: widget.onNavigate,
                  ),
                  const SizedBox(height: 8),
                ],
                _MapButton(
                  icon: isAddress
                      ? Icons.center_focus_strong_rounded
                      : Icons.my_location_rounded,
                  tooltip: isAddress
                      ? 'Xem địa chỉ đã chọn'
                      : widget.mode == AppMiniMapMode.providerNavigation
                      ? 'Bám theo vị trí của tôi'
                      : 'Xem vị trí chuyên viên',
                  onTap: isAddress
                      ? () => widget.mapController.move(
                          widget.destination ?? widget.initialCenter,
                          16,
                        )
                      : widget.currentPosition == null
                      ? null
                      : _centerOnPosition,
                ),
                if (!isAddress) ...[
                  const SizedBox(height: 8),
                  _MapButton(
                    icon: Icons.alt_route_rounded,
                    tooltip: 'Xem toàn bộ hành trình',
                    onTap: _showRoute,
                  ),
                ],
              ],
            ),
          ),
        ],
        Positioned(
          bottom: 8,
          left: 8,
          child: Material(
            color: const Color(0xE6FFFFFF),
            borderRadius: BorderRadius.circular(4),
            child: InkWell(
              onTap: () => launchUrl(
                Uri.parse('https://www.openstreetmap.org/copyright'),
              ),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                child: Text(
                  MapConstants.attribution,
                  style: TextStyle(
                    fontSize: 9,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
}

class _MapSummary extends StatelessWidget {
  final bool isAddress;
  final bool hasDestination;
  final bool hasPosition;
  final int? durationSeconds;
  final int? distanceMeters;

  const _MapSummary({
    required this.isAddress,
    required this.hasDestination,
    required this.hasPosition,
    required this.durationSeconds,
    required this.distanceMeters,
  });

  @override
  Widget build(BuildContext context) {
    final hasRoute =
        hasPosition &&
        durationSeconds != null &&
        distanceMeters != null &&
        durationSeconds! >= 0 &&
        distanceMeters! >= 0;
    final title = isAddress
        ? hasDestination
              ? 'Địa chỉ đã chọn'
              : 'Chạm để chọn vị trí'
        : hasRoute
        ? '${(durationSeconds! / 60).ceil()} phút'
        : hasPosition
        ? 'Đang tính tuyến'
        : 'Đang chờ vị trí';
    final distance = hasRoute
        ? distanceMeters! < 1000
              ? '${distanceMeters!} m'
              : '${(distanceMeters! / 1000).toStringAsFixed(1).replaceFirst('.', ',')} km'
        : null;

    return Material(
      color: Colors.white,
      elevation: 2,
      shadowColor: const Color(0x220B1C30),
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Wrap(
          spacing: 10,
          runSpacing: 2,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.circle, size: 8, color: AppColors.primary),
                const SizedBox(width: 6),
                Text(
                  title,
                  maxLines: 1,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
              ],
            ),
            if (distance != null)
              Text(
                distance,
                maxLines: 1,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DestinationMarker extends StatelessWidget {
  final String label;

  const _DestinationMarker({required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const _MarkerCircle(
          icon: Icons.location_on_rounded,
          color: AppColors.primary,
        ),
        const SizedBox(height: 3),
        _MarkerLabel(label: label, dot: true),
      ],
    );
  }
}

class _CurrentPositionMarker extends StatelessWidget {
  final String label;
  final double pulse;

  const _CurrentPositionMarker({required this.label, required this.pulse});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 54,
          height: 44,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Transform.scale(
                scale: 1 + pulse * 0.55,
                child: Opacity(
                  opacity: 0.5 * (1 - pulse),
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: const BoxDecoration(
                      color: AppColors.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
              const _MarkerCircle(
                icon: Icons.delivery_dining_rounded,
                color: AppColors.primaryContainer,
              ),
            ],
          ),
        ),
        const SizedBox(height: 2),
        _MarkerLabel(label: label),
      ],
    );
  }
}

class _MarkerCircle extends StatelessWidget {
  final IconData icon;
  final Color color;

  const _MarkerCircle({required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 6,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Icon(icon, color: Colors.white, size: 20),
    );
  }
}

class _MarkerLabel extends StatelessWidget {
  final String label;
  final bool dot;

  const _MarkerLabel({required this.label, this.dot = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 94, minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xF5FFFFFF),
        borderRadius: BorderRadius.circular(10),
        boxShadow: const [
          BoxShadow(
            color: Color(0x260F172A),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            const Icon(Icons.circle, size: 6, color: AppColors.secondary),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                softWrap: false,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  const _MapButton({required this.icon, required this.tooltip, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      child: Tooltip(
        message: tooltip,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(icon, size: 20, color: AppColors.primary),
          ),
        ),
      ),
    );
  }
}
