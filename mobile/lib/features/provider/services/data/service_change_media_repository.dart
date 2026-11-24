import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../domain/service_change.dart';
import 'provider_services_repository.dart';
import 'provider_service_mapper.dart';

const maxServiceDocumentBytes = 5 * 1024 * 1024;

class ServiceChangeMediaRepository {
  final Dio api, download;
  ServiceChangeMediaRepository(this.api, this.download);
  String _path(String id) =>
      '${ProviderServicesRepository.changesPath}/$id/documents';
  Future<ServiceChangeDocument> upload(
    String id,
    String type,
    XFile file,
    CancelToken cancel,
  ) async {
    if (!const {'PROFESSIONAL_CERTIFICATE', 'PORTFOLIO'}.contains(type)) {
      throw const ValidationFailure('Loại tài liệu không hợp lệ.');
    }
    if (await file.length() > maxServiceDocumentBytes) {
      throw const ValidationFailure('Ảnh tối đa 5 MB.');
    }
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || bytes.length > maxServiceDocumentBytes) {
      throw const ValidationFailure('Ảnh phải có dung lượng tối đa 5 MB.');
    }
    final response = await api.post(
      '${_path(id)}/$type',
      data: FormData.fromMap({
        'file': MultipartFile.fromBytes(
          bytes,
          filename: 'document.${_imageFormat(bytes)}',
        ),
      }),
      cancelToken: cancel,
    );
    return documentFromJson(ApiResponseParser.dataMap(response));
  }

  Future<void> remove(String id, String documentId, CancelToken cancel) async =>
      ApiResponseParser.ensureSuccess(
        await api.delete('${_path(id)}/$documentId', cancelToken: cancel),
      );
  Future<Uint8List> image(
    String id,
    String documentId,
    CancelToken cancel,
  ) async {
    // Signed URLs remain local to this call; the download client has no Lambe credentials.
    final data = ApiResponseParser.dataMap(
      await api.get('${_path(id)}/$documentId/access', cancelToken: cancel),
    );
    final uri = Uri.tryParse(data['url']?.toString() ?? '');
    if (uri == null ||
        uri.scheme != 'https' ||
        !uri.host.endsWith('.cloudinary.com') ||
        uri.userInfo.isNotEmpty) {
      throw const ServerFailure('Đường dẫn xem ảnh riêng tư không hợp lệ.');
    }
    final response = await download.get<ResponseBody>(
      uri.toString(),
      options: Options(responseType: ResponseType.stream),
      cancelToken: cancel,
    );
    final bytes = BytesBuilder(copy: false);
    await for (final chunk in response.data!.stream) {
      if (bytes.length + chunk.length > maxServiceDocumentBytes) {
        throw const ServerFailure('Ảnh vượt quá dung lượng cho phép.');
      }
      bytes.add(chunk);
    }
    final image = bytes.takeBytes();
    _imageFormat(image);
    return image;
  }

  String _imageFormat(Uint8List bytes) {
    bool starts(List<int> value) =>
        bytes.length >= value.length &&
        List.generate(
          value.length,
          (i) => bytes[i] == value[i],
        ).every((v) => v);
    if (starts([255, 216, 255])) return 'jpg';
    if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'png';
    if (starts('GIF87a'.codeUnits) || starts('GIF89a'.codeUnits)) return 'gif';
    if (bytes.length >= 12 &&
        starts('RIFF'.codeUnits) &&
        String.fromCharCodes(bytes.sublist(8, 12)) == 'WEBP') {
      return 'webp';
    }
    throw const ValidationFailure(
      'Chỉ nhận ảnh JPEG, PNG, WEBP hoặc GIF; không nhận SVG/PDF.',
    );
  }
}
