import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../di/feed_providers.dart';
import '../../application/feed_error.dart';

Future<void> showFeedReport(BuildContext context, String id) =>
    showDialog<void>(
      context: context,
      builder: (_) => _Report(id: id),
    );

class _Report extends ConsumerStatefulWidget {
  final String id;
  const _Report({required this.id});
  @override
  ConsumerState<_Report> createState() => _ReportState();
}

class _ReportState extends ConsumerState<_Report> {
  final _detail = TextEditingController(), _cancel = CancelToken();
  String _reason = 'SPAM';
  bool _busy = false;
  String? _error;
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Báo cáo bài đăng'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<String>(
            initialValue: _reason,
            isExpanded: true,
            items: const [
              DropdownMenuItem(value: 'SPAM', child: Text('Spam')),
              DropdownMenuItem(
                value: 'INAPPROPRIATE',
                child: Text('Nội dung không phù hợp'),
              ),
              DropdownMenuItem(value: 'PRIVACY', child: Text('Quyền riêng tư')),
              DropdownMenuItem(
                value: 'MISLEADING',
                child: Text('Thông tin sai lệch'),
              ),
              DropdownMenuItem(value: 'OTHER', child: Text('Lý do khác')),
            ],
            onChanged: _busy ? null : (value) => _reason = value!,
          ),
          TextField(
            controller: _detail,
            enabled: !_busy,
            maxLength: 500,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Thông tin bổ sung'),
          ),
          if (_error != null) Text(_error!),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: const Text('Đóng'),
      ),
      FilledButton(
        onPressed: _busy
            ? null
            : () async {
                setState(() {
                  _busy = true;
                  _error = null;
                });
                try {
                  await ref
                      .read(feedRepositoryProvider)
                      .report(widget.id, _reason, _detail.text, _cancel);
                  if (context.mounted) {
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(context);
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Đã gửi báo cáo để kiểm duyệt.'),
                      ),
                    );
                  }
                } catch (error) {
                  if (mounted) setState(() => _error = feedError(error));
                } finally {
                  if (mounted) setState(() => _busy = false);
                }
              },
        child: Text(_busy ? 'Đang gửi…' : 'Gửi báo cáo'),
      ),
    ],
  );
  @override
  void dispose() {
    _cancel.cancel();
    _detail.dispose();
    super.dispose();
  }
}
