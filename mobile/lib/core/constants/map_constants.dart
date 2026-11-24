class MapConstants {
  MapConstants._();

  /// Default OpenStreetMap raster tile template (open-source, keyless).
  static const String osmTileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// Package name identifying the mobile application for OSM tile usage policy compliance.
  static const String userAgentPackageName = 'com.lambe.mobile';

  /// Optional custom tile server template via --dart-define=MAP_TILE_URL=...
  static const String customTileUrl = String.fromEnvironment('MAP_TILE_URL');

  /// Active tile URL template to use for FlutterMap TileLayer.
  static String get tileUrlTemplate {
    if (customTileUrl.isNotEmpty) {
      return customTileUrl;
    }
    return osmTileUrl;
  }

  /// URL placeholders for FlutterMap TileLayer (empty by default for OSM).
  static const Map<String, String> tileAdditionalOptions = {};

  /// OSM no longer recommends sharded subdomains for its public tile server.
  static const List<String> tileSubdomains = [];

  static const String attribution = String.fromEnvironment(
    'MAP_ATTRIBUTION',
    defaultValue: '\u00A9 OpenStreetMap',
  );

  /// Maximum zoom level supported by the tiles.
  static const double maxZoom = 19.0;
}
