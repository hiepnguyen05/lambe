import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class FeedComposerBottomToolbar extends StatelessWidget {
  final bool disabled;
  final bool isEditing;
  final int charCount;
  final int maxChars;
  final VoidCallback onPickPhoto;
  final VoidCallback onPickVideo;
  final VoidCallback onAddService;
  final ValueChanged<String> onAddHashtag;

  const FeedComposerBottomToolbar({
    super.key,
    required this.disabled,
    required this.isEditing,
    required this.charCount,
    this.maxChars = 2000,
    required this.onPickPhoto,
    required this.onPickVideo,
    required this.onAddService,
    required this.onAddHashtag,
  });

  static const List<String> _quickHashtags = [
    '#cắttóc',
    '#nhuộmtóc',
    '#nailart',
    '#gộithưgiãn',
    '#chămsócda',
    '#balayage',
    '#nốimi',
    '#uốntóc',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        border: const Border(
          top: BorderSide(color: AppColors.surfaceContainerHigh, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Quick Hashtag Chips (Horizontal scroll)
            SizedBox(
              height: 38,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                scrollDirection: Axis.horizontal,
                itemCount: _quickHashtags.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final tag = _quickHashtags[index];
                  return ActionChip(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    visualDensity: VisualDensity.compact,
                    backgroundColor: AppColors.surfaceContainerLow,
                    side: BorderSide(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      width: 0.8,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                    label: Text(
                      tag,
                      style: const TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                    onPressed: disabled ? null : () => onAddHashtag(tag),
                  );
                },
              ),
            ),

            // Action Icons Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Row(
                children: [
                  if (!isEditing) ...[
                    IconButton(
                      icon: const Icon(Icons.photo_library_outlined),
                      tooltip: 'Thêm ảnh',
                      color: AppColors.primary,
                      onPressed: disabled ? null : onPickPhoto,
                    ),
                    IconButton(
                      icon: const Icon(Icons.videocam_outlined),
                      tooltip: 'Thêm video',
                      color: AppColors.secondary,
                      onPressed: disabled ? null : onPickVideo,
                    ),
                  ],
                  IconButton(
                    icon: const Icon(Icons.local_offer_outlined),
                    tooltip: 'Gắn thẻ dịch vụ',
                    color: AppColors.primary,
                    onPressed: disabled ? null : onAddService,
                  ),
                  const Spacer(),

                  // Character Counter
                  Text(
                    '$charCount / $maxChars',
                    style: TextStyle(
                      fontFamily: 'Plus Jakarta Sans',
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: charCount > maxChars
                          ? AppColors.error
                          : AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

