import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../di/provider_workspace_providers.dart';
import '../../domain/entities/provider_voucher_entity.dart';
import '../widgets/vouchers/create_provider_voucher_bottom_sheet.dart';

class ProviderVouchersScreen extends ConsumerWidget {
  const ProviderVouchersScreen({super.key});

  void _confirmDisable(
    BuildContext context,
    WidgetRef ref,
    ProviderVoucherEntity voucher,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Xác nhận ngừng voucher',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Bạn có chắc muốn ngừng áp dụng mã "${voucher.code}"?\n'
          'Khách hàng sẽ không thể áp dụng mã này cho các đơn đặt mới nữa (các đơn đã tạo trước đó vẫn giữ nguyên giá).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Quay lại'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final success = await ref
                  .read(providerVouchersNotifierProvider.notifier)
                  .disableVoucher(voucher.id);
              if (context.mounted && success) {
                AppDialog.success(
                  context,
                  message: 'Đã ngừng áp dụng mã ${voucher.code}.',
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            child: const Text('Ngừng áp dụng'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerVouchersNotifierProvider);
    final currency = CurrencyUtils.vndCurrency;
    final dateFormat = DateFormat('dd/MM/yyyy');

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text(
          'Mã ưu đãi của tôi',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0B1C30),
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 20,
            color: Color(0xFF0B1C30),
          ),
          onPressed: () => context.pop(),
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () =>
            ref.read(providerVouchersNotifierProvider.notifier).loadVouchers(),
        child: state.isLoading && state.vouchers.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF0F766E)),
              )
            : state.vouchers.isEmpty
            ? _buildEmptyState(context)
            : ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                children: [
                  // Banner giải thích quyền lợi
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.stars_rounded,
                          color: Color(0xFF16A34A),
                          size: 20,
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Mã ưu đãi giúp bạn thu hút khách hàng mới và tri ân khách quen. Bạn có thể chủ động ngừng mã bất cứ lúc nào.',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: Color(0xFF166534),
                              height: 1.35,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Danh sách voucher
                  ...state.vouchers.map((voucher) {
                    final isOngoing = voucher.isOngoing;
                    final isDisabled = voucher.isDisabled;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isOngoing
                              ? const Color(0xFF99F6E4)
                              : const Color(0xFFE2E8F0),
                          width: isOngoing ? 1.4 : 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F172A)
                                .withValues(alpha: 0.03),
                            blurRadius: 10,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEFF6F5),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: const Color(0xFF99F6E4),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Text(
                                            voucher.code,
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w800,
                                              color: Color(0xFF0F766E),
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          InkWell(
                                            onTap: () {
                                              Clipboard.setData(
                                                ClipboardData(
                                                  text: voucher.code,
                                                ),
                                              );
                                              AppDialog.success(
                                                context,
                                                message:
                                                    'Đã sao chép mã ${voucher.code}',
                                              );
                                            },
                                            child: const Icon(
                                              Icons.copy_rounded,
                                              size: 14,
                                              color: Color(0xFF0F766E),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                _buildStatusBadge(voucher),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              voucher.discountDescription,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.shopping_bag_outlined,
                                  size: 14,
                                  color: Color(0xFF64748B),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Đơn tối thiểu: ${currency.format(voucher.minOrderAmount)}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                const Text(
                                  ' • ',
                                  style: TextStyle(color: Color(0xFFCBD5E1)),
                                ),
                                Text(
                                  'Tối đa: ${voucher.usageLimit} lượt',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.access_time_rounded,
                                  size: 14,
                                  color: Color(0xFF64748B),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Hiệu lực: ${dateFormat.format(voucher.startsAt)} - ${dateFormat.format(voucher.endsAt)}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                            if (isOngoing && !isDisabled) ...[
                              const SizedBox(height: 12),
                              const Divider(
                                height: 1,
                                color: Color(0xFFE2E8F0),
                              ),
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton.icon(
                                  onPressed: () =>
                                      _confirmDisable(context, ref, voucher),
                                  icon: const Icon(
                                    Icons.pause_circle_outline_rounded,
                                    size: 16,
                                  ),
                                  label: const Text(
                                    'Ngừng áp dụng',
                                    style: TextStyle(fontSize: 12.5),
                                  ),
                                  style: TextButton.styleFrom(
                                    foregroundColor: const Color(0xFFDC2626),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 80),
                ],
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => CreateProviderVoucherBottomSheet.show(context),
        backgroundColor: const Color(0xFF0F766E),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text(
          'Tạo mã mới',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(ProviderVoucherEntity voucher) {
    if (voucher.isDisabled) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Text(
          'Đã ngừng',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: Color(0xFF64748B),
          ),
        ),
      );
    }
    if (voucher.isExpired) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Text(
          'Hết hạn',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: Color(0xFFDC2626),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: const Text(
        'Đang chạy',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: Color(0xFF15803D),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6F5),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.confirmation_num_outlined,
                color: Color(0xFF0F766E),
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Chưa có mã ưu đãi nào',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Bạn có thể tạo mã giảm giá (tối đa 30%) để thu hút khách hàng mới đặt lịch dịch vụ của bạn.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => CreateProviderVoucherBottomSheet.show(context),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Tạo mã ưu đãi đầu tiên'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
