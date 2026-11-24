/// Tiện ích hỗ trợ tìm kiếm tiếng Việt không dấu & có dấu chuẩn xác 100%
class VietnameseSearchUtils {
  static const _vietnameseChars = {
    'a': 'áàảãạăắằẳẵặâấầẩẫậ',
    'A': 'ÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ',
    'd': 'đ',
    'D': 'Đ',
    'e': 'éèẻẽẹêếềểễệ',
    'E': 'ÉÈẺẼẸÊẾỀỂỄỆ',
    'i': 'íìỉĩị',
    'I': 'ÍÌỈĨỊ',
    'o': 'óòỏõọôốồổỗộơớờởỡợ',
    'O': 'ÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ',
    'u': 'úùủũụưứừửữự',
    'U': 'ÚÙỦŨỤƯỨỪỬỮỰ',
    'y': 'ýỳỷỹỵ',
    'Y': 'ÝỲỶỸỴ',
  };

  static final Map<int, String> _diacriticLookup = () {
    final map = <int, String>{};
    _vietnameseChars.forEach((plain, diacritics) {
      for (var i = 0; i < diacritics.length; i++) {
        map[diacritics.codeUnitAt(i)] = plain;
      }
    });
    return map;
  }();

  /// Bỏ toàn bộ dấu tiếng Việt bằng một lượt duyệt duy nhất O(N)
  static String removeDiacritics(String str) {
    if (str.isEmpty) return str;
    final buffer = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      final code = str.codeUnitAt(i);
      final replaced = _diacriticLookup[code];
      if (replaced != null) {
        buffer.write(replaced);
      } else {
        buffer.writeCharCode(code);
      }
    }
    return buffer.toString();
  }

  /// Kiểm tra chuỗi [source] có khớp với từ khóa tìm kiếm [query] không
  /// Hỗ trợ cả gõ có dấu lẫn không dấu, hỗ trợ tách từ thông minh
  static bool matches(String source, String query) {
    final cleanQuery = query.trim();
    if (cleanQuery.isEmpty) return true;

    final normalizedSource = removeDiacritics(source).toLowerCase();
    final normalizedQuery = removeDiacritics(cleanQuery).toLowerCase();

    // 1. Khớp chuỗi không dấu
    if (normalizedSource.contains(normalizedQuery)) return true;

    // 2. Khớp chuỗi nguyên bản
    if (source.toLowerCase().contains(cleanQuery.toLowerCase())) return true;

    // 3. Khớp từng từ (ví dụ gõ "cat nam" thì tìm được "Cắt tóc nam cơ bản")
    final queryWords = normalizedQuery
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty);
    if (queryWords.length > 1) {
      return queryWords.every((word) => normalizedSource.contains(word));
    }

    return false;
  }
}
