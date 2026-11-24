import 'package:flutter/material.dart';

class ServiceAsyncMessage extends StatelessWidget {
  final String message;
  final VoidCallback? retry;
  const ServiceAsyncMessage({super.key, required this.message, this.retry});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      children: [
        Text(message, textAlign: TextAlign.center),
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
