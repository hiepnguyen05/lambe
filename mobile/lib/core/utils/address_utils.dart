class AddressUtils {
  AddressUtils._();

  /// Removes duplicate comma-separated segments (case-insensitive) while
  /// keeping their original order.
  static String deduplicate(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return '';
    final seen = <String>{};
    final result = <String>[];
    for (final segment in trimmed.split(',')) {
      final cleaned = segment.trim();
      if (cleaned.isEmpty) continue;
      if (seen.add(cleaned.toLowerCase())) {
        result.add(cleaned);
      }
    }
    return result.join(', ');
  }

  /// Joins non-empty address segments and removes any duplicated parts.
  static String joinUnique(Iterable<String> parts) {
    return deduplicate(
      parts.map((e) => e.trim()).where((e) => e.isNotEmpty).join(', '),
    );
  }
}
