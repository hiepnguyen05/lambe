import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class FeedUncertainNotice extends StatelessWidget {
  final VoidCallback retryUncertain;
  const FeedUncertainNotice({super.key, required this.retryUncertain});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text(
        'Chưa rõ kết quả gửi. Bạn có thể kiểm tra Bài của tôi hoặc gửi lại an toàn.',
      ),
      TextButton(
        onPressed: () => context.push('/feed?mode=mine'),
        child: const Text('Kiểm tra bài của tôi'),
      ),
      TextButton(
        onPressed: () async {
          final confirm = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Gửi lại bài?'),
              content: const Text(
                'Máy chủ sẽ dùng cùng mã yêu cầu nên không tạo bài trùng nếu lần trước đã được lưu.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Quay lại'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Tôi đã kiểm tra'),
                ),
              ],
            ),
          );
          if (confirm == true && context.mounted) retryUncertain();
        },
        child: const Text('Gửi lại an toàn'),
      ),
    ],
  );
}
