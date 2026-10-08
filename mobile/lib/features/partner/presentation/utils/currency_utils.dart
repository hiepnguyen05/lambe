String numberToVietnameseText(String numStr) {
  final number = int.tryParse(numStr.replaceAll(RegExp(r'[^0-9]'), ''));
  if (number == null || number == 0) {
    return '';
  }

  String readGroup(int n) {
    const units = [
      'không',
      'một',
      'hai',
      'ba',
      'bốn',
      'năm',
      'sáu',
      'bảy',
      'tám',
      'chín',
    ];
    int h = n ~/ 100;
    int t = (n % 100) ~/ 10;
    int u = n % 10;

    String res = '';
    if (h > 0) {
      res += '${units[h]} trăm ';
    }

    if (t > 1) {
      res += '${units[t]} mươi ';
      if (u == 1) {
        res += 'mốt ';
      } else if (u == 4) {
        res += 'tư ';
      } else if (u == 5) {
        res += 'lăm ';
      } else if (u > 0) {
        res += '${units[u]} ';
      }
    } else if (t == 1) {
      res += 'mười ';
      if (u == 5) {
        res += 'lăm ';
      } else if (u > 0) {
        res += '${units[u]} ';
      }
    } else if (t == 0 && u > 0) {
      if (h > 0) {
        res += 'lẻ ';
      }
      res += '${units[u]} ';
    }
    return res.trim();
  }

  if (number < 1000) {
    return '${readGroup(number)} đồng';
  }

  String res = '';
  int million = number ~/ 1000000;
  int thousand = (number % 1000000) ~/ 1000;
  int units = number % 1000;

  if (million > 0) {
    res += '${readGroup(million)} triệu ';
  }
  if (thousand > 0) {
    if (million > 0 && thousand < 100) {
      if (thousand < 10) {
        res += 'không trăm lẻ ';
      } else {
        res += 'không trăm ';
      }
    }
    res += '${readGroup(thousand)} ngàn ';
  }
  if (units > 0) {
    if ((million > 0 || thousand > 0) && units < 100) {
      if (units < 10) {
        res += 'không trăm lẻ ';
      } else {
        res += 'không trăm ';
      }
    }
    res += readGroup(units);
  }

  res = res.trim();
  if (res.isEmpty) {
    return '';
  }
  return '${res[0].toUpperCase()}${res.substring(1)} đồng';
}
