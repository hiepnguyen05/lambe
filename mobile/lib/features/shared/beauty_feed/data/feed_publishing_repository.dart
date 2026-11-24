import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';

import '../domain/feed_draft.dart';
import '../domain/feed_post.dart';
import 'feed_mapper.dart';

class FeedPublishingRepository {
  final Dio dio;
  FeedPublishingRepository(this.dio);

  Future<FeedPublishingContext> context(CancelToken cancel) async {
    final data = ApiResponseParser.dataMap(
      await dio.get('/me/feed/publishing-context', cancelToken: cancel),
    );
    final offerings = (data['offerings'] as List? ?? const [])
        .map((value) => offeringFromJson(objectMap(value)))
        .toList(growable: false);
    return FeedPublishingContext(
      providerId: data['providerId'] as String,
      memberId: data['memberId'] as String?,
      offerings: offerings,
    );
  }

  Future<FeedPost> create(
    FeedDraft draft,
    List<XFile> files,
    CancelToken cancel,
    void Function(int, int) progress,
    String idempotencyKey,
  ) async {
    if (files.isEmpty || files.length > 6) {
      throw const ValidationFailure('Chọn 1–6 ảnh hoặc một video MP4.');
    }
    final parts = <MultipartFile>[];
    var total = 0;
    var hasVideo = false;
    for (final file in files) {
      final length = await file.length();
      if (length < 1 || length > 30 * 1024 * 1024) {
        throw const ValidationFailure(
          'Video tối đa 30 MB; mỗi ảnh tối đa 5 MB.',
        );
      }
      final header = await file
          .openRead(0, length < 12 ? length : 12)
          .expand((chunk) => chunk)
          .toList();
      bool starts(List<int> value) =>
          header.length >= value.length &&
          List.generate(
            value.length,
            (i) => header[i] == value[i],
          ).every((v) => v);
      final video =
          header.length >= 12 &&
          String.fromCharCodes(header.sublist(4, 8)) == 'ftyp';
      final format = starts([255, 216, 255])
          ? 'jpg'
          : starts([137, 80, 78, 71, 13, 10, 26, 10])
          ? 'png'
          : header.length >= 12 &&
                starts('RIFF'.codeUnits) &&
                String.fromCharCodes(header.sublist(8, 12)) == 'WEBP'
          ? 'webp'
          : null;
      if (video) {
        hasVideo = true;
        if (files.length != 1 || !file.name.toLowerCase().endsWith('.mp4')) {
          throw const ValidationFailure(
            'Video phải là một file MP4 riêng, không trộn ảnh.',
          );
        }
      } else if (format == null || length > 5 * 1024 * 1024) {
        throw const ValidationFailure(
          'Chỉ nhận JPEG, PNG, WEBP tối đa 5 MB/ảnh hoặc một MP4.',
        );
      }
      total += length;
      if (total > 30 * 1024 * 1024) {
        throw const ValidationFailure('Tổng media tối đa 30 MB.');
      }
      parts.add(
        MultipartFile.fromStream(
          () => file.openRead(),
          length,
          filename: 'feed_${parts.length}.${video ? 'mp4' : format}',
        ),
      );
    }
    final response = await dio.post(
      hasVideo ? '/me/feed/posts/video' : '/me/feed/posts',
      data: FormData.fromMap({
        'caption': draft.caption.trim(),
        if (draft.memberId != null) 'memberId': draft.memberId,
        'providerServiceIds': jsonEncode(draft.serviceIds),
        'includesCustomer': draft.includesCustomer.toString(),
        'hasCustomerConsent': draft.hasConsent.toString(),
        if (hasVideo) 'file': parts.single else 'files': parts,
      }),
      options: Options(
        headers: {'idempotency-key': idempotencyKey},
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(seconds: 90),
      ),
      cancelToken: cancel,
      onSendProgress: progress,
    );
    return feedPostFromJson(ApiResponseParser.dataMap(response), managed: true);
  }
}

class FeedPublishingContext {
  final String providerId;
  final String? memberId;
  final List<ProviderOffering> offerings;

  const FeedPublishingContext({
    required this.providerId,
    required this.memberId,
    required this.offerings,
  });
}
