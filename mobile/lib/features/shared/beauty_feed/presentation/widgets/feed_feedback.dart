import 'package:flutter/material.dart';

class FeedFeedback extends StatelessWidget {
  final String text;
  final VoidCallback? retry;
  const FeedFeedback(this.text, {super.key, this.retry});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      children: [
        Text(text, textAlign: TextAlign.center),
        if (retry != null)
          TextButton.icon(
            onPressed: retry,
            icon: const Icon(Icons.refresh),
            label: const Text('Tải lại'),
          ),
      ],
    ),
  );
}
