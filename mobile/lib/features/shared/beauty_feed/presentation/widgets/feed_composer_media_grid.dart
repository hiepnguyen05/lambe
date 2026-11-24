import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/theme/app_colors.dart';

class FeedComposerMediaGrid extends StatelessWidget {
  final List<XFile> files;
  final bool disabled;
  final Future<void> Function(bool video) pick;
  final void Function(int index) onRemove;
  final VoidCallback onClear;

  const FeedComposerMediaGrid({
    super.key,
    required this.files,
    required this.disabled,
    required this.pick,
    required this.onRemove,
    required this.onClear,
  });

  bool get _isVideo =>
      files.length == 1 && files.first.name.toLowerCase().endsWith('.mp4');

  Widget _buildFileImage(XFile file, {BoxFit fit = BoxFit.cover}) {
    if (kIsWeb) {
      return Image.network(
        file.path,
        fit: fit,
        errorBuilder: (_, __, ___) => _errorPlaceholder(),
      );
    }
    return Image.file(
      File(file.path),
      fit: fit,
      errorBuilder: (_, __, ___) => _errorPlaceholder(),
    );
  }

  Widget _errorPlaceholder() => Container(
        color: AppColors.surfaceContainerHigh,
        alignment: Alignment.center,
        child: const Icon(
          Icons.image_outlined,
          color: AppColors.textMuted,
          size: 32,
        ),
      );

  Widget _buildRemoveButton(int index) => Positioned(
        top: 10,
        right: 10,
        child: InkWell(
          onTap: disabled ? null : () => onRemove(index),
          borderRadius: BorderRadius.circular(100),
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.65),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.close_rounded,
              size: 15,
              color: Colors.white,
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    if (files.isEmpty) {
      return _buildEmptyPicker(context);
    }

    if (_isVideo) {
      return _buildVideoPreview(context);
    }

    return _buildImagesPreview(context);
  }

  Widget _buildEmptyPicker(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.surfaceContainerHigh.withValues(alpha: 0.7),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.photo_library_outlined,
              size: 28,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Thêm hình ảnh hoặc video tác phẩm',
            style: TextStyle(
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Chia sẻ vẻ đẹp thực tế của tác phẩm để thu hút khách hàng',
            style: TextStyle(
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 12.5,
              color: AppColors.textMuted,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 10,
            children: [
              FilledButton.tonalIcon(
                onPressed: disabled ? null : () => pick(false),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  foregroundColor: AppColors.primary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 10,
                  ),
                ),
                icon: const Icon(Icons.photo_library_rounded, size: 18),
                label: const Text(
                  'Chọn ảnh',
                  style: TextStyle(
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: disabled ? null : () => pick(true),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.secondary.withValues(alpha: 0.12),
                  foregroundColor: AppColors.secondary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 10,
                  ),
                ),
                icon: const Icon(Icons.videocam_rounded, size: 18),
                label: const Text(
                  'Chọn Video',
                  style: TextStyle(
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Tối đa 6 ảnh hoặc 1 video clip ngắn (dưới 60 giây)',
            style: TextStyle(
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 11,
              color: AppColors.outlineVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoPreview(BuildContext context) {
    final file = files.first;
    return Container(
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            height: 220,
            width: double.infinity,
            color: const Color(0xFF1E293B),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 36,
                  ),
                ),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    file.name,
                    style: const TextStyle(
                      fontFamily: 'Plus Jakarta Sans',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.timer_outlined,
                        size: 13,
                        color: AppColors.primaryFixed,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Video MP4 (Tối đa 60s)',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryFixed,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _buildRemoveButton(0),
        ],
      ),
    );
  }

  Widget _buildImagesPreview(BuildContext context) {
    if (files.length == 1) {
      return Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxHeight: 520),
              color: AppColors.surfaceContainerLowest,
              alignment: Alignment.center,
              child: _buildFileImage(files[0], fit: BoxFit.scaleDown),
            ),
          ),
          _buildRemoveButton(0),
          Positioned(
            bottom: 12,
            left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                borderRadius: BorderRadius.circular(100),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.photo_outlined,
                    size: 13,
                    color: Colors.white,
                  ),
                  SizedBox(width: 4),
                  Text(
                    '1 ảnh',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    if (files.length == 2) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: AspectRatio(
                        aspectRatio: 1,
                        child: _buildFileImage(files[0]),
                      ),
                    ),
                    _buildRemoveButton(0),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: AspectRatio(
                        aspectRatio: 1,
                        child: _buildFileImage(files[1]),
                      ),
                    ),
                    _buildRemoveButton(1),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: disabled ? null : () => pick(false),
              icon: const Icon(Icons.add_photo_alternate_outlined, size: 16),
              label: const Text(
                'Thêm ảnh (tối đa 6)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
        ],
      );
    }

    // 3 - 6 images
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1,
          ),
          itemCount: files.length < 6 ? files.length + 1 : files.length,
          itemBuilder: (context, index) {
            if (index == files.length && files.length < 6) {
              return InkWell(
                onTap: disabled ? null : () => pick(false),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.surfaceContainerHighest,
                      width: 1.5,
                    ),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.add_photo_alternate_outlined,
                        color: AppColors.primary,
                        size: 24,
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Thêm ảnh',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }

            return Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: _buildFileImage(files[index]),
                ),
                _buildRemoveButton(index),
              ],
            );
          },
        ),
      ],
    );
  }
}

