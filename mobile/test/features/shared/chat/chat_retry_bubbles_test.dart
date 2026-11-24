import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/upload_payload.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_message_entity.dart';
import 'package:mobile/features/shared/chat/presentation/widgets/bubbles/chat_image_bubble.dart';
import 'package:mobile/features/shared/chat/presentation/widgets/bubbles/chat_pending_images.dart';
import 'package:mobile/features/shared/chat/presentation/widgets/bubbles/chat_service_card_bubble.dart';
import 'package:mobile/features/shared/chat/presentation/widgets/bubbles/chat_text_bubble.dart';

UploadPayload _image() => UploadPayload(
  bytes: base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
  ),
  fileName: 'photo.png',
);

ChatMessageEntity _pending(ChatMessageKind kind) => ChatMessageEntity(
  id: 'pending:client-1',
  sequence: 1,
  kind: kind,
  text: 'Hello',
  providerServiceId: 'service-1',
  clientMessageId: 'client-1',
  createdAt: DateTime(2026, 10, 30, 10, 30),
  isSending: true,
);

Widget _host(Widget child) => MaterialApp(
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  testWidgets(
    'IMAGE shows local previews, sending status, and a retry action',
    (tester) async {
      final pending = _pending(ChatMessageKind.image);
      final images = [_image(), _image()];
      var retries = 0;
      Widget bubble(ChatMessageEntity message, {bool mine = true}) => _host(
        ChatImageBubble(
          message: message,
          isMine: mine,
          pendingImages: images,
          onRetry: () => retries++,
        ),
      );
      await tester.pumpWidget(bubble(pending));
      expect(find.byType(Image), findsNWidgets(2));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Gửi lại'), findsNothing);

      final failed = pending.copyWith(isSending: false, hasError: true);
      await tester.pumpWidget(bubble(failed));
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.tap(find.text('Gửi lại'));
      expect(retries, 1);

      await tester.pumpWidget(bubble(failed, mine: false));
      expect(find.text('Gửi lại'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'evicted IMAGE remains visible and explains selecting images again',
    (tester) async {
      await tester.pumpWidget(
        _host(
          ChatImageBubble(
            message: _pending(ChatMessageKind.image)
                .copyWith(isSending: false, hasError: true),
            isMine: true,
          ),
        ),
      );
      expect(find.textContaining('Vui lòng chọn ảnh'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      expect(find.text('Gửi lại'), findsNothing);
      expect(find.byType(Image), findsNothing);
    },
  );

  testWidgets(
    'SERVICE_CARD retries failure and only opens a persisted service',
    (tester) async {
      final pending = _pending(ChatMessageKind.serviceCard);
      var retries = 0;
      var selected = 0;
      Widget bubble(ChatMessageEntity message) => _host(
        ChatServiceCardBubble(
          message: message,
          isMine: true,
          onRetry: () => retries++,
          onSelectService: () => selected++,
        ),
      );
      await tester.pumpWidget(bubble(pending));
      expect(find.text('Dịch vụ làm đẹp'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(
        tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
        isNull,
      );
      expect(find.text('Gửi lại'), findsNothing);

      await tester.pumpWidget(
        bubble(pending.copyWith(isSending: false, hasError: true)),
      );
      await tester.tap(find.text('Gửi lại'));
      expect(retries, 1);
      expect(
        tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
        isNull,
      );

      await tester.pumpWidget(
        bubble(
          pending.copyWith(
            id: 'saved-1',
            isSending: false,
            payload: {
              'serviceName': 'Facial',
              'priceAmount': 120000,
              'durationMinutes': 45,
            },
          ),
        ),
      );
      expect(find.text('Facial'), findsOneWidget);
      expect(find.text('45 phút'), findsOneWidget);
      expect(find.byIcon(Icons.done_all_rounded), findsOneWidget);
      expect(find.text('Gửi lại'), findsNothing);
      await tester.tap(find.byType(ElevatedButton));
      expect(selected, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('TEXT retains the existing failure retry action', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      _host(
        ChatTextBubble(
          message: _pending(ChatMessageKind.text)
              .copyWith(isSending: false, hasError: true),
          isMine: true,
          onRetry: () => retries++,
        ),
      ),
    );
    expect(find.text('Hello'), findsOneWidget);
    await tester.tap(find.text('Gửi lại'));
    expect(retries, 1);
  });

  testWidgets(
    'local preview removes retained bytes from image cache on replacement and disposal',
    (tester) async {
      await tester.pumpWidget(_host(ChatPendingImages(images: [_image()])));
      final firstProvider = tester.widget<Image>(find.byType(Image)).image;
      final firstKey = await firstProvider.obtainKey(ImageConfiguration.empty);
      await tester.runAsync(
        () => precacheImage(firstProvider, tester.element(find.byType(Image))),
      );
      await tester.pumpAndSettle();
      expect(imageCache.containsKey(firstKey), isTrue);

      await tester.pumpWidget(_host(ChatPendingImages(images: [_image()])));
      final secondProvider = tester.widget<Image>(find.byType(Image)).image;
      final secondKey = await secondProvider.obtainKey(
        ImageConfiguration.empty,
      );
      await tester.runAsync(
        () => precacheImage(secondProvider, tester.element(find.byType(Image))),
      );
      await tester.pumpAndSettle();
      expect(imageCache.containsKey(firstKey), isFalse);
      expect(imageCache.containsKey(secondKey), isTrue);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      expect(imageCache.containsKey(secondKey), isFalse);
      expect(tester.takeException(), isNull);
    },
  );
}
