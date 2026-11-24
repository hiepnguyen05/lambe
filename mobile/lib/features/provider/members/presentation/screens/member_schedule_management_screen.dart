import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../providers/member_schedule_notifier.dart';

class MemberScheduleManagementScreen extends ConsumerStatefulWidget {
  final String memberId;
  final String? memberName;

  const MemberScheduleManagementScreen({
    super.key,
    required this.memberId,
    this.memberName,
  });

  @override
  ConsumerState<MemberScheduleManagementScreen> createState() =>
      _MemberScheduleManagementScreenState();
}

class _MemberScheduleManagementScreenState
    extends ConsumerState<MemberScheduleManagementScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(memberScheduleProvider(widget.memberId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          widget.memberName != null
              ? 'Lịch: ${widget.memberName}'
              : 'Lịch làm việc & Nghỉ phép',
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
                .read(memberScheduleProvider(widget.memberId).notifier)
                .loadSchedule(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: const Color(0xFF6B7280),
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Ca làm việc tuần'),
            Tab(text: 'Lịch nghỉ phép'),
          ],
        ),
      ),
      body: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : TabBarView(
              controller: _tabController,
              children: [
                _buildShiftsTab(state),
                _buildTimeOffsTab(state),
              ],
            ),
      floatingActionButton: _tabController.index == 1
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('Thêm lịch nghỉ'),
              onPressed: () => _showAddTimeOffDialog(context),
            )
          : null,
    );
  }

  Widget _buildShiftsTab(MemberScheduleState state) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Row(
            children: const [
              Icon(Icons.access_time_filled, color: Color(0xFF2563EB), size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Ca làm việc cố định hàng tuần. Hệ thống căn cứ ca này để mở lịch đặt hẹn khả dụng cho khách hàng.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (state.shifts.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Text(
                'Chưa có ca làm việc nào được phân công.',
                style: TextStyle(color: Color(0xFF6B7280)),
              ),
            ),
          )
        else
          ...state.shifts.map(
            (shift) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer.withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            shift.dayOfWeek == 0 ? 'CN' : 'T${shift.dayOfWeek + 1}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        shift.dayName,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      shift.timeRangeString,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF374151),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildTimeOffsTab(MemberScheduleState state) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (state.timeOffs.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Text(
                'Không có lịch nghỉ phép nào sắp tới.',
                style: TextStyle(color: Color(0xFF6B7280)),
              ),
            ),
          )
        else
          ...state.timeOffs.map(
            (item) => Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.event_busy_rounded,
                      color: Color(0xFFDC2626),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.reason != null && item.reason!.isNotEmpty
                              ? item.reason!
                              : 'Nghỉ phép',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0B1C30),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Từ: ${dateFormat.format(item.startAt.toLocal())}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                        Text(
                          'Đến: ${dateFormat.format(item.endAt.toLocal())}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
                    tooltip: 'Hủy lịch nghỉ',
                    onPressed: () => _confirmDeleteTimeOff(context, item.id),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  void _showAddTimeOffDialog(BuildContext context) {
    DateTime start = DateTime.now().add(const Duration(hours: 1));
    DateTime end = start.add(const Duration(hours: 4));
    final reasonCtrl = TextEditingController(text: 'Nghỉ việc riêng');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final dtFormat = DateFormat('dd/MM/yyyy HH:mm');
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Đăng ký lịch nghỉ phép',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    title: const Text('Bắt đầu nghỉ',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                    subtitle: Text(
                      dtFormat.format(start),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    trailing: const Icon(Icons.calendar_today, size: 20),
                    onTap: () async {
                      final pickedDate = await showDatePicker(
                        context: context,
                        initialDate: start,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (pickedDate != null && context.mounted) {
                        final pickedTime = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.fromDateTime(start),
                        );
                        if (pickedTime != null) {
                          setSheetState(() {
                            start = DateTime(
                              pickedDate.year,
                              pickedDate.month,
                              pickedDate.day,
                              pickedTime.hour,
                              pickedTime.minute,
                            );
                            if (end.isBefore(start)) {
                              end = start.add(const Duration(hours: 4));
                            }
                          });
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 10),
                  ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    title: const Text('Kết thúc nghỉ',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                    subtitle: Text(
                      dtFormat.format(end),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    trailing: const Icon(Icons.calendar_today, size: 20),
                    onTap: () async {
                      final pickedDate = await showDatePicker(
                        context: context,
                        initialDate: end,
                        firstDate: start,
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (pickedDate != null && context.mounted) {
                        final pickedTime = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.fromDateTime(end),
                        );
                        if (pickedTime != null) {
                          setSheetState(() {
                            end = DateTime(
                              pickedDate.year,
                              pickedDate.month,
                              pickedDate.day,
                              pickedTime.hour,
                              pickedTime.minute,
                            );
                          });
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonCtrl,
                    decoration: InputDecoration(
                      labelText: 'Lý do nghỉ (*)',
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  ElevatedButton(
                    onPressed: () async {
                      final ok = await ref
                          .read(
                            memberScheduleProvider(widget.memberId).notifier,
                          )
                          .addTimeOff(start, end, reasonCtrl.text);
                      if (ok && context.mounted) {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đã thêm lịch nghỉ phép thành công!'),
                            backgroundColor: Color(0xFF0F766E),
                          ),
                        );
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
                    child: const Text('Xác nhận đăng ký'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _confirmDeleteTimeOff(BuildContext context, String timeOffId) {
    final reasonCtrl = TextEditingController(text: 'Hủy lịch nghỉ cá nhân');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hủy lịch nghỉ'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Bạn có chắc chắn muốn hủy lịch nghỉ này?'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Lý do hủy (*)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Quay lại'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref
                  .read(memberScheduleProvider(widget.memberId).notifier)
                  .deleteTimeOff(timeOffId, reasonCtrl.text);
            },
            child: const Text('Hủy lịch'),
          ),
        ],
      ),
    );
  }
}

