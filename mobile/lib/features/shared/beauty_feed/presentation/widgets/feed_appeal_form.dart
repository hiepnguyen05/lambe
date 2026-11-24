import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../di/feed_providers.dart';

class FeedAppealForm extends ConsumerStatefulWidget {
  final String postId;
  final int revision;
  const FeedAppealForm({
    super.key,
    required this.postId,
    required this.revision,
  });
  @override
  ConsumerState<FeedAppealForm> createState() => _FeedAppealFormState();
}

class _FeedAppealFormState extends ConsumerState<FeedAppealForm> {
  final reason = TextEditingController();
  final cancel = CancelToken();
  bool busy = false, sent = false;
  String? message;
  @override
  void dispose() {
    cancel.cancel();
    reason.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || sent || reason.text.trim().length < 5) return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      await ref
          .read(feedRepositoryProvider)
          .appeal(widget.postId, widget.revision, reason.text, cancel);
      if (mounted) {
        setState(() {
          sent = true;
          message = 'Đã gửi khiếu nại. Nền tảng sẽ xem xét lại bài đăng.';
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          message = e.response?.statusCode == 409
              ? 'Bài đã thay đổi, đã có khiếu nại hoặc quá hạn 30 ngày. Hãy làm mới bài.'
              : 'Chưa xác nhận được việc gửi khiếu nại. Hãy thử lại.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          message = 'Không gửi được khiếu nại. Hãy làm mới bài và thử lại.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Yêu cầu kiểm tra lại quyết định'),
        const Text(
          'Bạn có thể gửi một khiếu nại trong 30 ngày từ quyết định từ chối.',
        ),
        if (!sent) ...[
          TextField(
            controller: reason,
            enabled: !busy,
            maxLength: 1000,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Lý do khiếu nại (ít nhất 5 ký tự)',
            ),
            onChanged: (_) => setState(() {}),
          ),
          FilledButton(
            onPressed: busy || reason.text.trim().length < 5 ? null : submit,
            child: Text(busy ? 'Đang gửi…' : 'Gửi khiếu nại'),
          ),
        ],
        if (message != null) Text(message!),
      ],
    ),
  );
}
