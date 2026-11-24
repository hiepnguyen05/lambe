import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../application/service_operation.dart';
import '../../di/provider_services_providers.dart';

Future<void> showServiceDocument(
  BuildContext context,
  String requestId,
  String documentId,
) => showDialog<void>(
  context: context,
  builder: (_) =>
      _ServiceDocumentViewer(requestId: requestId, documentId: documentId),
);

class _ServiceDocumentViewer extends ConsumerStatefulWidget {
  final String requestId, documentId;
  const _ServiceDocumentViewer({
    required this.requestId,
    required this.documentId,
  });
  @override
  ConsumerState<_ServiceDocumentViewer> createState() =>
      _ServiceDocumentViewerState();
}

class _ServiceDocumentViewerState extends ConsumerState<_ServiceDocumentViewer>
    with WidgetsBindingObserver {
  ImageProvider? _image;
  CancelToken? _cancel;
  String? _error;
  bool _loading = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(_load);
  }

  void _clear() {
    final image = _image;
    _image = null;
    if (image != null) unawaited(image.evict());
  }

  Future<void> _load() async {
    if (!mounted || _loading) return;
    _clear();
    final cancel = _cancel = CancelToken();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bytes = await ref
          .read(serviceChangeMediaRepositoryProvider)
          .image(widget.requestId, widget.documentId, cancel);
      if (mounted && !cancel.isCancelled) {
        setState(
          () => _image = ResizeImage(
            MemoryImage(bytes),
            width: 1200,
            height: 1200,
            policy: ResizeImagePolicy.fit,
          ),
        );
      }
    } catch (error) {
      if (mounted && !cancel.isCancelled) {
        setState(() => _error = serviceError(error));
      }
    } finally {
      if (mounted && !cancel.isCancelled) setState(() => _loading = false);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _cancel?.cancel();
      _clear();
      setState(() {
        _loading = false;
        _error = 'Ảnh đã đóng khi ứng dụng về nền. Hãy mở lại để xem.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(serviceChangeMediaRepositoryProvider);
    ref.listen(authNotifierProvider.select((value) => value.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != next) {
        _cancel?.cancel();
        _clear();
        setState(() {
          _loading = false;
          _error = 'Phiên đăng nhập đã thay đổi. Hãy đóng tài liệu này.';
        });
      }
    });
    return AlertDialog(
      title: const Text('Tài liệu riêng tư'),
      content: SizedBox(
        width: 600,
        height: MediaQuery.sizeOf(context).height * .5,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _image != null
            ? InteractiveViewer(
                child: Image(
                  image: _image!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => const Center(
                    child: Text('Chưa hiển thị được ảnh. Hãy tải lại.'),
                  ),
                ),
              )
            : Center(child: Text(_error ?? 'Chưa có ảnh.')),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : _load,
          child: const Text('Tải lại ảnh'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Đóng'),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _clear();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
