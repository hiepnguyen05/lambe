import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../providers/worker_workspace_notifier.dart';

class WorkerReceivingRadiusDialog extends StatefulWidget {
  final int currentRadius;
  final int maxOrganizationRadius;

  const WorkerReceivingRadiusDialog({
    super.key,
    required this.currentRadius,
    required this.maxOrganizationRadius,
  });

  static Future<void> show(
    BuildContext context, {
    required int currentRadius,
    required int maxOrganizationRadius,
  }) {
    return showDialog(
      context: context,
      builder: (_) => WorkerReceivingRadiusDialog(
        currentRadius: currentRadius,
        maxOrganizationRadius: maxOrganizationRadius,
      ),
    );
  }

  @override
  State<WorkerReceivingRadiusDialog> createState() =>
      _WorkerReceivingRadiusDialogState();
}

class _WorkerReceivingRadiusDialogState
    extends State<WorkerReceivingRadiusDialog> {
  late double _radius;

  @override
  void initState() {
    super.initState();
    _radius = widget.currentRadius.toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final maxR = widget.maxOrganizationRadius > 0
        ? widget.maxOrganizationRadius.toDouble()
        : 30.0;

    return AlertDialog(
      title: const Text('Bán kính nhận đơn cá nhân'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Chọn bán kính tối đa bạn có thể di chuyển phục vụ khách hàng (tối đa ${widget.maxOrganizationRadius} km theo quy định của cơ sở):',
            style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563)),
          ),
          const SizedBox(height: 20),
          Center(
            child: Text(
              '${_radius.round()} km',
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
          ),
          Slider(
            value: _radius.clamp(1.0, maxR),
            min: 1.0,
            max: maxR,
            divisions: maxR.toInt(),
            activeColor: AppColors.primary,
            onChanged: (val) {
              setState(() {
                _radius = val;
              });
            },
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        Consumer(
          builder: (context, ref, _) => ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(context);
              await ref
                  .read(workerWorkspaceProvider.notifier)
                  .updateRadius(_radius.round());
            },
            child: const Text('Lưu cài đặt'),
          ),
        ),
      ],
    );
  }
}

