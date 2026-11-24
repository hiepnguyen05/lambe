import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../di/partner_providers.dart';
import '../../domain/entities/provider_application_entity.dart';
import '../utils/partner_resume_utils.dart';

class PartnerStatusScreen extends ConsumerStatefulWidget {
  const PartnerStatusScreen({super.key});

  @override
  ConsumerState<PartnerStatusScreen> createState() =>
      _PartnerStatusScreenState();
}

class _PartnerStatusScreenState extends ConsumerState<PartnerStatusScreen> {
  @override
  void initState() {
    super.initState();
    if (ref.read(partnerNotifierProvider).valueOrNull == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
    }
  }

  Future<void> _refresh() async {
    await ref.read(partnerNotifierProvider.notifier).loadLatestApplication();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);
    final application = state.valueOrNull;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Trạng thái hồ sơ',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            tooltip: 'Làm mới trạng thái',
            onPressed: state.isLoading ? null : _refresh,
            icon: const Icon(Icons.refresh, color: Color(0xFF0F766E)),
          ),
        ],
      ),
      body: SafeArea(child: _buildBody(state, application)),
    );
  }

  Widget _buildBody(
    AsyncValue<ProviderApplicationEntity?> state,
    ProviderApplicationEntity? application,
  ) {
    if (state.isLoading && application == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null && application == null) {
      return _StatusMessage(
        icon: Icons.error_outline,
        title: 'Không thể tải trạng thái',
        message: state.error.toString(),
        actionLabel: 'Thử lại',
        onAction: _refresh,
      );
    }
    if (application == null) {
      return _StatusMessage(
        icon: Icons.description_outlined,
        title: 'Chưa có hồ sơ',
        message: 'Không tìm thấy hồ sơ đăng ký đối tác đang hoạt động.',
        actionLabel: 'Về trang chủ',
        onAction: () => context.go('/home'),
      );
    }

    final display = _StatusDisplay.fromStatus(application.status);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 12),
          Icon(display.icon, size: 72, color: display.color),
          const SizedBox(height: 20),
          Text(
            display.title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0B1C30),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            display.message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              height: 1.5,
              color: Color(0xFF4B5563),
            ),
          ),
          const SizedBox(height: 32),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                _DetailRow(
                  label: 'Loại hồ sơ',
                  value: application.providerType == 'ORGANIZATION'
                      ? 'Tổ chức / Salon / Studio'
                      : 'Cá nhân',
                ),
                const Divider(height: 28),
                _DetailRow(
                  label: 'Ngày gửi',
                  value: _formatDate(application.submittedAt),
                ),
                if (application.reviewedAt != null) ...[
                  const Divider(height: 28),
                  _DetailRow(
                    label: 'Ngày xử lý',
                    value: _formatDate(application.reviewedAt),
                  ),
                ],
              ],
            ),
          ),
          if (application.decisionReason?.isNotEmpty == true) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Phản hồi từ Lambe',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF9A3412),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    application.decisionReason!,
                    style: const TextStyle(
                      color: Color(0xFF7C2D12),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 28),
          if (application.status == 'NEEDS_CHANGES' ||
              application.status == 'DRAFT')
            ElevatedButton.icon(
              onPressed: () =>
                  context.push(partnerRouteForStep(application.resumeStep)),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Tiếp tục hoàn thiện hồ sơ'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 52),
              ),
            )
          else if (application.status == 'REJECTED' ||
              application.status == 'WITHDRAWN')
            ElevatedButton.icon(
              onPressed: () => context.push('/partner/type'),
              icon: const Icon(Icons.replay),
              label: const Text('Đăng ký lại'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 52),
              ),
            )
          else
            OutlinedButton.icon(
              onPressed: () => context.go('/home'),
              icon: const Icon(Icons.home_outlined),
              label: const Text('Về trang chủ'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0F766E),
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
        ],
      ),
    );
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return 'Chưa cập nhật';
    final date = DateTime.tryParse(raw)?.toLocal();
    return date == null
        ? 'Chưa cập nhật'
        : DateFormat('dd/MM/yyyy, HH:mm').format(date);
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: Color(0xFF0B1C30),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatusMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  const _StatusMessage({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: const Color(0xFF6B7280)),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0B1C30),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF6B7280), height: 1.4),
            ),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}

class _StatusDisplay {
  final String title;
  final String message;
  final IconData icon;
  final Color color;

  const _StatusDisplay({
    required this.title,
    required this.message,
    required this.icon,
    required this.color,
  });

  factory _StatusDisplay.fromStatus(String? status) {
    return switch (status) {
      'PENDING_REVIEW' => const _StatusDisplay(
        title: 'Hồ sơ đang được xét duyệt',
        message: 'Lambe đã tiếp nhận hồ sơ của bạn. Chúng tôi sẽ thông báo ngay khi có kết quả.',
        icon: Icons.hourglass_top_rounded,
        color: Color(0xFFD97706),
      ),
      'APPROVED' => const _StatusDisplay(
        title: 'Hồ sơ đã được phê duyệt',
        message: 'Chúc mừng bạn đã trở thành đối tác của Lambe.',
        icon: Icons.verified_rounded,
        color: Color(0xFF0F766E),
      ),
      'NEEDS_CHANGES' => const _StatusDisplay(
        title: 'Hồ sơ cần bổ sung',
        message: 'Một số thông tin cần được cập nhật trước khi Lambe tiếp tục xét duyệt.',
        icon: Icons.edit_note_rounded,
        color: Color(0xFFEA580C),
      ),
      'REJECTED' => const _StatusDisplay(
        title: 'Hồ sơ chưa được chấp thuận',
        message: 'Vui lòng xem phản hồi từ Lambe để biết thêm chi tiết.',
        icon: Icons.cancel_outlined,
        color: Color(0xFFDC2626),
      ),
      'WITHDRAWN' => const _StatusDisplay(
        title: 'Hồ sơ đã được rút',
        message: 'Bạn có thể bắt đầu một hồ sơ đăng ký mới khi sẵn sàng.',
        icon: Icons.undo_rounded,
        color: Color(0xFF6B7280),
      ),
      _ => const _StatusDisplay(
        title: 'Hồ sơ đang hoàn thiện',
        message: 'Bạn có thể tiếp tục bổ sung thông tin cho hồ sơ này.',
        icon: Icons.description_outlined,
        color: Color(0xFF0F766E),
      ),
    };
  }
}
