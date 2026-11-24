import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/map_constants.dart';

void main() {
  const expectedCustomUrl = String.fromEnvironment('TEST_MAP_TILE_URL');

  test('resolves the compile-time map tile configuration', () {
    if (expectedCustomUrl.isNotEmpty) {
      expect(MapConstants.tileUrlTemplate, expectedCustomUrl);
      expect(MapConstants.tileAdditionalOptions, const {'apiKey': 'test-key'});
    } else {
      expect(MapConstants.tileUrlTemplate, MapConstants.osmTileUrl);
      expect(MapConstants.tileUrlTemplate, isNot(contains('cartocdn.com')));
      expect(MapConstants.tileAdditionalOptions, isEmpty);
    }
    expect(MapConstants.tileSubdomains, isEmpty);
  });
}
