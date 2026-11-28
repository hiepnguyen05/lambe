import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../../di/provider_workspace_providers.dart';

/// Displays before/after work evidence photos for a provider order, fetching
/// short-lived signed URLs lazily when needed.
class ProviderOrderEvidenceCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> order;

  const ProviderOrderEvidenceCard({super.key, required this.order});

  @override
  ConsumerState<ProviderOrderEvidenceCard> createState() =>
      _ProviderOrderEvidenceCardState();
}

class _ProviderOrderEvidenceCardState
    extends ConsumerState<ProviderOrderEvidenceCard> {
  final Map<String, String> _urls = {};
  final Set<String> _loading = {};

  @override
  void initState() {
    super.initState();
    _loadMissing();
  }

  @override
  void didUpdateWidget(covariant ProviderOrderEvidenceCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.order['evidence'] != widget.order['evidence']) {
      _loadMissing();
    }
  }

  Future<void> _loadMissing() async {
    final orderId = widget.order['id']?.toString() ?? '';
    if (orderId.isEmpty) return;

    final items = ((widget.order['evidence'] as List?) ?? [])
        .whereType<Map>()
        .where((e) {
          final type = e['type']?.toString();
          final id = e['id']?.toString() ?? '';
          return id.isNotEmpty &&
              (type == 'BEFORE_WORK' || type == 'AFTER_WORK') &&
              !_urls.containsKey(id) &&
              !_loading.contains(id);
        })
        .toList();

    if (items.isEmpty) return;
    final repo = ref.read(providerOrdersRemoteDataSourceProvider);

    for (final item in items) {
      final evidenceId = item['id']!.toString();
      final rawPath = item['filePath']?.toString();
      _loading.add(evidenceId);
      try {
        final signedUrl = await repo.getEvidenceSignedUrl(orderId, evidenceId);
        final resolved = (signedUrl != null && signedUrl.isNotEmpty)
            ? signedUrl
            : (rawPath != null && rawPath.startsWith('http') ? rawPath : null);
        if (mounted && resolved != null && resolved.isNotEmpty) {
          setState(() => _urls[evidenceId] = resolved);
        }
      } catch (_) {
        if (mounted && rawPath != null && rawPath.startsWith('http')) {
          setState(() => _urls[evidenceId] = rawPath);
        }
      } finally {
        if (mounted) {
          setState(() => _loading.remove(evidenceId));
        } else {
          _loading.remove(evidenceId);
        }
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
    final evidenceList = ((widget.order['evidence'] as List?) ?? [])
        .whereType<Map>()
        .toList();
    final beforeList = evidenceList
        .where((e) => e['type'] == 'BEFORE_WORK')
        .toList();
    final afterList = evidenceList
        .where((e) => e['type'] == 'AFTER_WORK')
        .toList();
    if (beforeList.isEmpty && afterList.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.photo_library_outlined,
                size: 17,
                color: AppColors.primary,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hình ảnh thực hiện',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          if (beforeList.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Trước khi làm (${beforeList.length})',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 8),
            _buildThumbStrip(context, beforeList, 'Trước khi làm'),
          ],
          if (afterList.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Kết quả sau khi làm (${afterList.length})',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 8),
            _buildThumbStrip(context, afterList, 'Kết quả sau khi làm'),
          ],
        ],
      ),
    );
  }

  Widget _buildThumbStrip(
    BuildContext context,
    List<Map> items,
    String titlePrefix,
  ) {
    return SizedBox(
      height: 80,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final id = items[index]['id']?.toString() ?? '';
          final rawPath = items[index]['filePath']?.toString();
          final url =
              _urls[id] ??
              (rawPath != null && rawPath.startsWith('http') ? rawPath : null);
          return GestureDetector(
            onTap: url != null
                ? () =>
                      _openPreview(context, url, '$titlePrefix (${index + 1})')
                : null,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: url == null
                  ? Container(
                      width: 80,
                      height: 80,
                      color: const Color(0xFFF1F5F9),
                      alignment: Alignment.center,
                      child: _loading.contains(id)
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(
                              Icons.image_not_supported_outlined,
                              color: Color(0xFF94A3B8),
                            ),
                    )
                  : Image.network(
                      url,
                      width: 80,
                      height: 80,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 80,
                        height: 80,
                        color: const Color(0xFFF1F5F9),
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
            ),
          );
        },
      ),
    );
  }
}
