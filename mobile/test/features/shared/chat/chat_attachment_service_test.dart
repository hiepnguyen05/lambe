import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/shared/chat/application/chat_attachment_service.dart';

void main() {
  group('ChatAttachmentService', () {
    const service = ChatAttachmentService();

    test('prepares valid images within size limit', () async {
      final file1 = XFile.fromData(
        Uint8List.fromList([1, 2, 3, 4]),
        path: 'photo1.jpg',
      );
      final file2 = XFile.fromData(
        Uint8List.fromList([5, 6, 7]),
        path: 'photo2.png',
      );

      final result = await service.prepareUploads([file1, file2]);

      expect(result.oversizedFiles, isEmpty);
      expect(result.uploads.length, equals(2));
      expect(result.uploads[0].fileName, equals('photo1.jpg'));
      expect(result.uploads[0].bytes, equals([1, 2, 3, 4]));
      expect(result.uploads[1].fileName, equals('photo2.png'));
    });

    test('flags oversized files and preserves under-limit files', () async {
      final small = XFile.fromData(
        Uint8List.fromList([10, 20]),
        path: 'small.jpg',
      );
      final big = XFile.fromData(Uint8List(100), path: 'big.jpg');

      final result = await service.prepareUploads([
        small,
        big,
      ], maxBytesPerFile: 50);

      expect(result.oversizedFiles, equals(['big.jpg']));
      expect(result.uploads.length, equals(1));
      expect(result.uploads.first.fileName, equals('small.jpg'));
    });

    test('caps max attachments to configured limit', () async {
      final files = List.generate(
        6,
        (i) => XFile.fromData(Uint8List.fromList([i]), path: 'img_$i.jpg'),
      );

      final result = await service.prepareUploads(files, maxCount: 3);

      expect(result.uploads.length, equals(3));
      expect(
        result.uploads.map((u) => u.fileName),
        equals(['img_0.jpg', 'img_1.jpg', 'img_2.jpg']),
      );
    });
  });
}
