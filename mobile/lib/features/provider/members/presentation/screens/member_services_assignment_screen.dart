import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../providers/member_services_assignment_notifier.dart';

class MemberServicesAssignmentScreen extends ConsumerStatefulWidget {
  final String memberId;
  final String? memberName;

  const MemberServicesAssignmentScreen({
    super.key,
    required this.memberId,
    this.memberName,
  });

  @override
  ConsumerState<MemberServicesAssignmentScreen> createState() =>
      _MemberServicesAssignmentScreenState();
}

class _MemberServicesAssignmentScreenState
    extends ConsumerState<MemberServicesAssignmentScreen> {
  final _reasonController =
      TextEditingController(text: 'Cập nhật phân công chuyên môn');

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(memberServicesAssignmentProvider(widget.memberId));
    final currencyFormatter =
        NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          widget.memberName != null
              ? 'Phân công: ${widget.memberName}'
              : 'Phân công dịch vụ',
          style: const TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
            fontSize: 17,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF0B1C30)),
            onPressed: () => ref
                .read(memberServicesAssignmentProvider(widget.memberId).notifier)
                .loadServices(),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : Column(
              children: [
                // Info banner
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  color: const Color(0xFFFEF3C7),
                  child: Row(
                    children: const [
                      Icon(Icons.info_outline,
                          color: Color(0xFFD97706), size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Cập nhật dịch vụ sẽ tự động tắt phiên trực tuyến hiện tại của nhân viên để đồng bộ.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF92400E),
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                if (state.errorMessage != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    color: const Color(0xFFFEE2E2),
                    child: Text(
                      state.errorMessage!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ),

                Expanded(
                  child: state.options.isEmpty
                      ? const Center(
                          child: Text(
                            'Chưa có dịch vụ nào trong cơ sở.',
                            style: TextStyle(color: Color(0xFF6B7280)),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: state.options.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final item = state.options[index];
                            final isSelected = state.selectedServiceIds
                                .contains(item.providerServiceId);
                            final isEligible = item.eligible;

                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isSelected
                                      ? AppColors.primary
                                      : const Color(0xFFE5E7EB),
                                  width: isSelected ? 1.5 : 1.0,
                                ),
                              ),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 8,
                                ),
                                title: Text(
                                  item.name,
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    color: isEligible
                                        ? const Color(0xFF0B1C30)
                                        : const Color(0xFF9CA3AF),
                                  ),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Text(
                                      '${currencyFormatter.format(item.priceAmount)} • ${item.durationMinutes} phút',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: isEligible
                                            ? AppColors.primary
                                            : const Color(0xFF9CA3AF),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (!isEligible) ...[
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEE2E2),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          item.blockerLabel,
                                          style: const TextStyle(
                                            color: Color(0xFFDC2626),
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                trailing: Checkbox(
                                  value: isSelected,
                                  activeColor: AppColors.primary,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  onChanged: isEligible
                                      ? (_) {
                                          ref
                                              .read(
                                                memberServicesAssignmentProvider(
                                                        widget.memberId)
                                                    .notifier,
                                              )
                                              .toggleService(
                                                  item.providerServiceId);
                                        }
                                      : null,
                                ),
                                onTap: isEligible
                                    ? () {
                                        ref
                                            .read(
                                              memberServicesAssignmentProvider(
                                                      widget.memberId)
                                                  .notifier,
                                            )
                                            .toggleService(
                                                item.providerServiceId);
                                      }
                                    : null,
                              ),
                            );
                          },
                        ),
                ),

                // Bottom save container
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black12,
                        blurRadius: 10,
                        offset: Offset(0, -3),
                      ),
                    ],
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: _reasonController,
                          decoration: InputDecoration(
                            labelText: 'Lý do phân công / điều chỉnh (*)',
                            hintText: 'Nhập lý do phân công...',
                            labelStyle: const TextStyle(fontSize: 13),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: state.isSaving
                              ? null
                              : () async {
                                  final success = await ref
                                      .read(memberServicesAssignmentProvider(
                                              widget.memberId)
                                          .notifier)
                                      .saveAssignment(
                                          _reasonController.text);
                                  if (!context.mounted) return;
                                  if (success) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                            'Đã lưu phân công dịch vụ thành công!'),
                                        backgroundColor: Color(0xFF0F766E),
                                      ),
                                    );
                                    context.pop();
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            minimumSize: const Size(double.infinity, 48),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: state.isSaving
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(
                                  'Lưu phân công (${state.selectedServiceIds.length} dịch vụ)',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
