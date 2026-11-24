import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/utils/vietnamese_search_utils.dart';

void main() {
  group('VietnameseSearchUtils Tests', () {
    test('removeDiacritics correctly strips accents from lowercase and uppercase', () {
      expect(
        VietnameseSearchUtils.removeDiacritics('Cắt tóc nam cơ bản'),
        'Cat toc nam co ban',
      );
      expect(
        VietnameseSearchUtils.removeDiacritics('ĐÀ NẴNG'),
        'DA NANG',
      );
      expect(
        VietnameseSearchUtils.removeDiacritics('Gội đầu & massage'),
        'Goi dau & massage',
      );
    });

    test('matches finds exact and diacritic-free matches', () {
      const source = 'Cắt tóc nam cơ bản';

      expect(VietnameseSearchUtils.matches(source, 'cat nam'), isTrue);
      expect(VietnameseSearchUtils.matches(source, 'Cắt tóc'), isTrue);
      expect(VietnameseSearchUtils.matches(source, 'toc co ban'), isTrue);
      expect(VietnameseSearchUtils.matches(source, 'uốn nhuộm'), isFalse);
      expect(VietnameseSearchUtils.matches(source, ''), isTrue);
    });
  });
}

