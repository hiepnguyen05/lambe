import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../../domain/entities/customer_order_entity.dart';
import '../../providers/customer_orders_providers.dart';

class CustomerOrderEvidenceCard extends ConsumerStatefulWidget {
  final CustomerOrderEntity order;

  const CustomerOrderEvidenceCard({super.key, required this.order});

  @override
  ConsumerState<CustomerOrderEvidenceCard> createState() =>
      _CustomerOrderEvidenceCardState();
}

class _CustomerOrderEvidenceCardState
    extends ConsumerState<CustomerOrderEvidenceCard> {
  final Map<String, String> _urls = {};
  final Set<String> _loading = {};

  @override
  void initState() {
    super.initState();
    _loadMissing();
  }

  @override
  void didUpdateWidget(covariant CustomerOrderEvidenceCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.order.evidence != widget.order.evidence) {
      _loadMissing();
    }
  }

  Future<void> _loadMissing() async {
    final repo = ref.read(customerOrdersRepositoryProvider);
    final items = widget.order.evidence.where(
      (e) =>
          (e.type == 'BEFORE_WORK' || e.type == 'AFTER_WORK') &&
          !_urls.containsKey(e.id) &&
          !_loading.contains(e.id),
    );
    for (final item in items.toList()) {
      _loading.add(item.id);
      try {
        final url = await repo.getEvidenceSignedUrl(widget.order.id, item.id);
        if (mounted && url != null && url.isNotEmpty) {
          setState(() => _urls[item.id] = url);
        }
      } catch (_) {
        // Retry automatically on next order refresh.
      } finally {
        _loading.remove(item.id);
      }
    }
  }

  void _openPreview(BuildContext context, String url, String title) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 14),
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  icon: const Icon(Icons.close, color: Colors.white),
                ),
              ],
            ),
            Flexible(
              child: Image.network(
                url,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Không tải được ảnh',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final beforeList = widget.order.evidence
        .where((e) => e.type == 'BEFORE_WORK')
        .toList();
    final afterList = widget.order.evidence
        .where((e) => e.type == 'AFTER_WORK')
        .toList();
    if (beforeList.isEmpty && afterList.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.photo_library_outlined,
                size: 18,
                color: AppColors.primary,
              ),
              SizedBox(width: 8),
              Text(
                'Hình ảnh thực hiện',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
            ],
          ),
          if (beforeList.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Trước khi làm (${beforeList.length})',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 84,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: beforeList.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final url = _urls[beforeList[index].id];
                  return _EvidenceThumbTile(
                    url: url,
                    onTap: url != null
                        ? () => _openPreview(
                            context,
                            url,
                            'Trước khi làm (${index + 1})',
                          )
                        : null,
                  );
                },
              ),
            ),
          ],
          if (afterList.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Kết quả sau khi làm (${afterList.length})',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 84,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: afterList.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final url = _urls[afterList[index].id];
                  return _EvidenceThumbTile(
                    url: url,
                    onTap: url != null
                        ? () => _openPreview(
                            context,
                            url,
                            'Kết quả sau khi làm (${index + 1})',
                          )
                        : null,
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EvidenceThumbTile extends StatelessWidget {
  final String? url;
  final VoidCallback? onTap;

  const _EvidenceThumbTile({required this.url, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: url == null
            ? Container(
                width: 84,
                height: 84,
                color: const Color(0xFFF1F5F9),
                alignment: Alignment.center,
                child: const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : Image.network(
                url!,
                width: 84,
                height: 84,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 84,
                  height: 84,
                  color: const Color(0xFFF1F5F9),
                  child: const Icon(Icons.broken_image_outlined),
                ),
              ),
      ),
    );
  }
}
