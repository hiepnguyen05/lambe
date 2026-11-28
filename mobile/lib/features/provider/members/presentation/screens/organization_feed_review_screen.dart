import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import '../providers/organization_feed_review_notifier.dart';

class OrganizationFeedReviewScreen extends ConsumerWidget {
  const OrganizationFeedReviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(organizationFeedReviewProvider);
    final dtFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Duyệt bài viết của nhân viên',
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
      ),
      body: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : state.pendingPosts.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(
                        Icons.check_circle_outline,
                        size: 64,
                        color: Color(0xFF10B981),
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Không có bài viết nào đang chờ duyệt.',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Tất cả tác phẩm của thợ đã được xử lý.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.pendingPosts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final post = state.pendingPosts[index];
                    return Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Author header
                          Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: AppColors.primaryContainer
                                      .withValues(alpha: 0.3),
                                  backgroundImage: post.authorAvatarUrl != null
                                      ? NetworkImage(post.authorAvatarUrl!)
                                      : null,
                                  child: post.authorAvatarUrl == null
                                      ? const Icon(Icons.person,
                                          size: 18, color: AppColors.primary)
                                      : null,
                                ),
                                const SizedBox(width: 10),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      post.authorName ?? 'Thợ',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        color: Color(0xFF0B1C30),
                                      ),
                                    ),
                                    Text(
                                      dtFormat.format(post.createdAt.toLocal()),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF6B7280),
                                      ),
                                    ),
                                  ],
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Chờ duyệt',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFFD97706),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Post text
                          if (post.content != null && post.content!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 6,
                              ),
                              child: Text(
                                post.content!,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF1F2937),
                                  height: 1.4,
                                ),
                              ),
                            ),

                          // Post media
                          if (post.mediaUrl != null &&
                              post.mediaUrl!.isNotEmpty)
                            ClipRRect(
                              borderRadius: const BorderRadius.vertical(
                                bottom: Radius.circular(0),
                              ),
                              child: Image.network(
                                post.mediaUrl!,
                                width: double.infinity,
                                height: 200,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const SizedBox(
                                  height: 120,
                                  child: Center(
                                    child: Icon(Icons.broken_image,
                                        color: Colors.grey),
                                  ),
                                ),
                              ),
                            ),

                          // Review Actions
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: state.isSubmitting
                                        ? null
                                        : () => _showRejectDialog(context, ref, post),
                                    icon: const Icon(Icons.close_rounded,
                                        size: 18),
                                    label: const Text('Từ chối'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFFDC2626),
                                      side: const BorderSide(
                                          color: Color(0xFFDC2626)),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: state.isSubmitting
                                        ? null
                                        : () async {
                                            final ok = await ref
                                                .read(
                                                  organizationFeedReviewProvider
                                                      .notifier,
                                                )
                                                .reviewPost(
                                                  postId: post.id,
                                                  revisionNumber:
                                                      post.revisionNumber,
                                                  decision: 'APPROVE',
                                                );
                                            if (ok && context.mounted) {
                                              await AppDialog.success(
                                                context,
                                                message:
                                                    'Đã phê duyệt xuất bản bài viết!',
                                              );
                                            }
                                          },
                                    icon: const Icon(Icons.check_rounded,
                                        size: 18),
                                    label: const Text('Phê duyệt'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }

  void _showRejectDialog(
    BuildContext context,
    WidgetRef ref,
    OrganizationFeedItem post,
  ) {
    final noteCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Từ chối duyệt bài'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự) để nhân viên điều chỉnh:',
              style: TextStyle(fontSize: 13, color: Color(0xFF4B5563)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Nhập lý do từ chối...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              final note = noteCtrl.text.trim();
              if (note.length < 5) {
                await AppDialog.warning(
                  ctx,
                  message: 'Lý do phải có ít nhất 5 ký tự.',
                );
                return;
              }
              Navigator.pop(ctx);
              await ref
                  .read(organizationFeedReviewProvider.notifier)
                  .reviewPost(
                    postId: post.id,
                    revisionNumber: post.revisionNumber,
                    decision: 'REJECT',
                    note: note,
                  );
            },
            child: const Text('Xác nhận từ chối'),
          ),
        ],
      ),
    );
  }
}

