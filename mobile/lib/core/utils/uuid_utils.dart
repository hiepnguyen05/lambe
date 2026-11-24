import 'dart:math';

class UuidUtils {
  static final Random _random = Random.secure();

  static String generateV4() {
    final values = List<int>.generate(16, (i) => _random.nextInt(256));
    // Set version to 0100 (UUIDv4)
    values[6] = (values[6] & 0x0f) | 0x40;
    // Set variant to 10xx (RFC 4122)
    values[8] = (values[8] & 0x3f) | 0x80;

    String toHex(int value) => value.toRadixString(16).padLeft(2, '0');

    return '${toHex(values[0])}${toHex(values[1])}${toHex(values[2])}${toHex(values[3])}-'
        '${toHex(values[4])}${toHex(values[5])}-'
        '${toHex(values[6])}${toHex(values[7])}-'
        '${toHex(values[8])}${toHex(values[9])}-'
        '${toHex(values[10])}${toHex(values[11])}${toHex(values[12])}${toHex(values[13])}${toHex(values[14])}${toHex(values[15])}';
  }
}
