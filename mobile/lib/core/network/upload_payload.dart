class UploadPayload {
  final List<int> bytes;
  final String fileName;

  const UploadPayload({required this.bytes, required this.fileName});
}
