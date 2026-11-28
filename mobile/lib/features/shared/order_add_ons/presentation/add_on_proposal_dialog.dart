import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../application/order_add_ons_controller.dart';
import '../domain/order_add_on.dart';
import 'add_on_format.dart';

/// Lưu danh sách proposalId đã bật dialog theo phiên đăng nhập hiện tại
/// (tránh bật trùng giữa OrderNotificationCoordinator và màn hình đơn hàng).
final announcedAddOnProposalIdsProvider = Provider<Set<String>>((ref) {
  ref.watch(authNotifierProvider.select((auth) => auth.valueOrNull?.id));
  return <String>{};
});

class AddOnProposalDialog extends ConsumerStatefulWidget {
  static String? activeProposalId;

  final AddOnScope scope;
  final String currencyCode;
  final OrderAddOn proposal;
  final void Function(Map<String, dynamic>)? onServerOrder;
  final Future<void> Function()? onAfterDecision;

  const AddOnProposalDialog({
    super.key,
    required this.scope,
    required this.currencyCode,
    required this.proposal,
    this.onServerOrder,
    this.onAfterDecision,
  });

  static Future<bool?> show(
    BuildContext context,
    WidgetRef ref, {
    required AddOnScope scope,
    required String currencyCode,
    required OrderAddOn proposal,
    void Function(Map<String, dynamic>)? onServerOrder,
    Future<void> Function()? onAfterDecision,
  }) async {
    if (!context.mounted) return null;
    if (activeProposalId == proposal.id) return null;
    final announced = ref.read(announcedAddOnProposalIdsProvider);
    announced.add(proposal.id);
    activeProposalId = proposal.id;
    try {
      return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) => AddOnProposalDialog(
          scope: scope,
          currencyCode: currencyCode,
          proposal: proposal,
          onServerOrder: onServerOrder,
          onAfterDecision: onAfterDecision,
        ),
      );
    } finally {
      if (activeProposalId == proposal.id) {
        activeProposalId = null;
      }
    }
  }

  @override
  ConsumerState<AddOnProposalDialog> createState() =>
      _AddOnProposalDialogState();
}

class _AddOnProposalDialogState extends ConsumerState<AddOnProposalDialog> {
  bool _submitting = false;
  String? _errorText;

  Future<void> _decide(bool approve) async {
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _errorText = null;
    });

    final notifier = ref.read(orderAddOnsProvider(widget.scope).notifier);
    final outcome = await notifier.decide(widget.proposal, approve);
    if (!mounted) return;

    if (!outcome.success) {
      final err = ref.read(orderAddOnsProvider(widget.scope)).error;
      setState(() {
        _submitting = false;
        _errorText = err ?? 'Chưa gửi được phản hồi. Vui lòng thử lại.';
      });
      return;
    }

    if (outcome.orderJson != null) {
      widget.onServerOrder?.call(outcome.orderJson!);
    }
    if (widget.onAfterDecision != null) {
      unawaited(widget.onAfterDecision!());
    }
    if (mounted) {
      Navigator.of(context).pop(approve);
    }
  }

  @override
  Widget build(BuildContext context) {
    final proposal = widget.proposal;
    final currency = widget.currencyCode;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      titlePadding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
      title: Row(
        children: [
          const Icon(
            Icons.add_task_rounded,
            color: AppColors.primary,
            size: 22,
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Đề nghị thêm dịch vụ',
              style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800),
            ),
          ),
          IconButton(
            tooltip: 'Đóng',
            onPressed: _submitting
                ? null
                : () => Navigator.of(context).pop(null),
            icon: const Icon(
              Icons.close_rounded,
              size: 20,
              color: AppColors.textMuted,
            ),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            proposal.serviceName,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.onBackground,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '+${addOnMoney(proposal.priceAmount, currency)} · ${proposal.durationMinutes} phút',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Tổng đơn nếu đồng ý: ${addOnMoney(proposal.proposedTotalAmount, currency)}',
            style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          const SizedBox(height: 4),
          Text(
            'Hạn xác nhận: ${addOnTime(proposal.expiresAt)}',
            style: const TextStyle(fontSize: 12, color: Color(0xFFB45309)),
          ),
          if (proposal.note?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Text(
              'Ghi chú: ${proposal.note!.trim()}',
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.textMuted,
              ),
            ),
          ],
          if (_errorText != null) ...[
            const SizedBox(height: 10),
            Text(
              _errorText!,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
      actions: [
        OutlinedButton(
          onPressed: _submitting ? null : () => _decide(false),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFFB91C1C),
            side: const BorderSide(color: Color(0xFFFECACA)),
          ),
          child: const Text('Từ chối'),
        ),
        FilledButton(
          onPressed: _submitting ? null : () => _decide(true),
          style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
          child: _submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Đồng ý'),
        ),
      ],
    );
  }
}
