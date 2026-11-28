import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../domain/entities/customer_order_entity.dart';
import '../providers/customer_orders_providers.dart';
import '../widgets/cancellation/order_cancellation_bottom_sheet.dart';
import '../widgets/review/order_review_bottom_sheet.dart';

abstract class CustomerOrderActionCoordinator {
  static Future<void> makeCall(BuildContext context, String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri(scheme: 'tel', path: cleanPhone);
    if (cleanPhone.isNotEmpty && await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (context.mounted) {
      AppDialog.error(context, message: 'Không thể gọi đến $phone');
    }
  }

  static void openCancellationSheet({
    required BuildContext context,
    required WidgetRef ref,
    required String orderId,
  }) {
    OrderCancellationBottomSheet.show(
      context,
      onConfirm: (reason) async {
        final success = await ref
            .read(customerOrderDetailNotifierProvider(orderId).notifier)
            .cancelOrder(reason);
        if (context.mounted && success) {
          AppDialog.success(
            context,
            message: 'Đã hủy đơn đặt lịch thành công.',
          );
          ref.invalidate(customerOrdersListProvider);
        }
        return success;
      },
    );
  }

  static Future<void> openReviewSheet({
    required BuildContext context,
    required WidgetRef ref,
    required CustomerOrderEntity order,
  }) async {
    String? latestError;
    final saved = await OrderReviewBottomSheet.show(
      context,
      providerName: order.provider?.displayName ?? 'Chuyên viên',
      serviceName: order.serviceName,
      getErrorMessage: () => latestError,
      onConfirm: (rating, comment) async {
        latestError = null;
        final provider = customerOrderDetailNotifierProvider(order.id);
        final sub = ref.listenManual(provider, (_, _) {});
        try {
          final success = await ref
              .read(provider.notifier)
              .submitReview(rating: rating, comment: comment);
          if (!success) {
            latestError = sub.read().errorMessage;
          }
          return success;
        } finally {
          sub.close();
        }
      },
    );
    if (saved == true && context.mounted) {
      ref.invalidate(customerOrdersListProvider);
      await AppDialog.success(
        context,
        message: 'Cảm ơn bạn đã gửi đánh giá dịch vụ!',
      );
    }
  }
}
