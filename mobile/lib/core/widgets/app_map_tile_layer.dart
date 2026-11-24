import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../constants/map_constants.dart';

enum AppMapAppearance { standard, tracking }

class AppMapTileLayer extends StatelessWidget {
  final AppMapAppearance appearance;

  const AppMapTileLayer({
    super.key,
    this.appearance = AppMapAppearance.standard,
  });

  const AppMapTileLayer.tracking({super.key})
    : appearance = AppMapAppearance.tracking;

  @override
  Widget build(BuildContext context) {
    final tileLayer = TileLayer(
      urlTemplate: MapConstants.tileUrlTemplate,
      additionalOptions: MapConstants.tileAdditionalOptions,
      subdomains: MapConstants.tileSubdomains,
      userAgentPackageName: MapConstants.userAgentPackageName,
      maxZoom: MapConstants.maxZoom,
    );

    return switch (appearance) {
      AppMapAppearance.standard => LambeMapTone(child: tileLayer),
      AppMapAppearance.tracking => LambeTrackingMapTone(child: tileLayer),
    };
  }
}

class LambeMapTone extends StatelessWidget {
  final Widget child;

  const LambeMapTone({super.key, required this.child});

  static const _colorMatrix = <double>[
    0.686,
    0.176,
    0.018,
    0,
    20,
    0.052,
    0.810,
    0.018,
    0,
    26,
    0.052,
    0.176,
    0.651,
    0,
    25,
    0,
    0,
    0,
    1,
    0,
  ];

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: ColorFiltered(
        colorFilter: const ColorFilter.matrix(_colorMatrix),
        child: child,
      ),
    );
  }
}

class LambeTrackingMapTone extends StatelessWidget {
  static const Color backgroundColor = Color(0xFFEDF3F2);

  final Widget child;

  const LambeTrackingMapTone({super.key, required this.child});

  static const colorMatrix = <double>[
    0.91,
    0.03,
    0,
    0,
    4,
    0.01,
    0.95,
    0,
    0,
    3,
    0,
    0.02,
    0.93,
    0,
    5,
    0,
    0,
    0,
    1,
    0,
  ];

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: ColoredBox(
        color: backgroundColor,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Opacity(
              opacity: 0.96,
              child: ColorFiltered(
                colorFilter: const ColorFilter.matrix(colorMatrix),
                child: child,
              ),
            ),
            const IgnorePointer(child: ColoredBox(color: Color(0x04FFFFFF))),
          ],
        ),
      ),
    );
  }
}
