import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../domain/feed_post.dart';
import '../../domain/feed_scope.dart';
import '../../domain/feed_draft.dart';
import '../../di/feed_providers.dart';
import '../../application/feed_error.dart';
import '../widgets/feed_feedback.dart';
import '../widgets/feed_uncertain_notice.dart';
import '../widgets/feed_composer_identity_bar.dart';
import '../widgets/feed_composer_media_grid.dart';
import '../widgets/feed_composer_service_sheet.dart';
import '../widgets/feed_composer_consent_card.dart';
import '../widgets/feed_composer_bottom_toolbar.dart';

class FeedComposerScreen extends ConsumerStatefulWidget {
  final String? postId;
  const FeedComposerScreen({super.key, this.postId});

  @override
  ConsumerState<FeedComposerScreen> createState() => _FeedComposerScreenState();
}

class _FeedComposerScreenState extends ConsumerState<FeedComposerScreen> {
  final _caption = TextEditingController();
  final _services = <String>{};
  List<XFile> _files = [];
  FeedPost? _base;
  bool _includes = false, _consent = false, _picking = false;
  String? _localError;

  String get keyId => widget.postId ?? 'new';

  void _resetDraft() {
    _caption.clear();
    _services.clear();
    _files = [];
    _base = null;
    _consent = false;
    _includes = false;
    _localError = null;
  }

  @override
  void initState() {
    super.initState();
    _caption.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(covariant FeedComposerScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.postId != widget.postId) _resetDraft();
  }

  Future<void> _pick(bool video) async {
    if (_picking) return;
    final user = ref.read(authNotifierProvider).valueOrNull?.id;
    final intentId = keyId;
    setState(() => _picking = true);
    try {
      final picker = ImagePicker();
      final List<XFile> selected;
      if (video) {
        final value = await picker.pickVideo(
          source: ImageSource.gallery,
          maxDuration: const Duration(seconds: 60),
        );
        selected = value == null ? [] : [value];
      } else {
        selected = await picker.pickMultiImage(
          maxWidth: 1920,
          maxHeight: 1920,
          imageQuality: 85,
          limit: 6,
        );
      }
      if (!mounted ||
          keyId != intentId ||
          ref.read(authNotifierProvider).valueOrNull?.id != user) {
        return;
      }
      if (selected.isNotEmpty) setState(() => _files = selected);
    } catch (error) {
      if (mounted) setState(() => _localError = feedError(error));
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  void _removeFile(int index) {
    if (_files.isNotEmpty && index >= 0 && index < _files.length) {
      setState(() {
        final updated = List<XFile>.from(_files);
        updated.removeAt(index);
        _files = updated;
      });
    }
  }

  void _addHashtag(String tag) {
    final current = _caption.text;
    if (current.contains(tag)) return;
    final separator =
        current.isEmpty || current.endsWith(' ') || current.endsWith('\n')
        ? ''
        : ' ';
    setState(() {
      _caption.text = '$current$separator$tag ';
      _caption.selection = TextSelection.fromPosition(
        TextPosition(offset: _caption.text.length),
      );
    });
  }

  Future<bool> _onWillPop() async {
    if (_caption.text.trim().isEmpty && _files.isEmpty && _services.isEmpty) {
      return true;
    }
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hủy bài viết?',
          style: TextStyle(
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        content: const Text(
          'Nội dung và hình ảnh bạn đã thêm sẽ không được lưu nếu thoát bây giờ.',
          style: TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text(
              'Tiếp tục sửa',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text(
              'Hủy bỏ',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
    return leave == true;
  }

  Future<void> _submit({
    required String? memberId,
    required List<ProviderOffering> active,
  }) async {
    final draft = FeedDraft(
      caption: _caption.text,
      memberId: memberId,
      serviceIds: _services.toList(),
      includesCustomer: _includes,
      hasConsent: _consent,
    );
    final invalid = draft.validate();
    if (invalid != null ||
        _services.any((id) => !active.any((v) => v.id == id))) {
      setState(
        () => _localError = invalid ?? 'Hãy chọn dịch vụ đang hoạt động.',
      );
      return;
    }
    final saved = await ref
        .read(feedPublisherProvider(keyId).notifier)
        .save(draft, _files, editing: _base);
    if (saved != null && mounted) {
      context.pushReplacement('/feed/posts/${saved.id}?manage=true');
    }
  }

  bool _isPublishReady({required bool disabled}) {
    if (disabled) return false;
    final captionValid =
        _caption.text.trim().isNotEmpty &&
        _caption.text.trim().runes.length <= 2000;
    if (!captionValid) return false;
    if (widget.postId == null && _files.isEmpty) return false;
    if (_services.isEmpty || _services.length > 5) return false;
    if (_includes && !_consent) return false;
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedPublisherProvider(keyId));
    final publishingContext = ref.watch(feedPublishingContextProvider);
    final user = ref.watch(authNotifierProvider).valueOrNull;

    final detailScope = widget.postId == null
        ? null
        : FeedDetailScope(widget.postId!, manage: true);
    final detail = detailScope == null
        ? null
        : ref.watch(feedDetailProvider(detailScope));

    ref.listen(authNotifierProvider.select((v) => v.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != next) {
        setState(() {
          _resetDraft();
        });
      }
    });

    if (_base == null && detail?.post != null) {
      _base = detail!.post;
      _caption.text = _base!.caption;
      _services.addAll(_base!.services.map((v) => v.id));
    }

    final disabled = state.busy || state.uncertain || _picking;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close_rounded, color: AppColors.onSurface),
            tooltip: 'Đóng',
            onPressed: () async {
              final shouldPop = await _onWillPop();
              if (shouldPop && context.mounted) {
                context.pop();
              }
            },
          ),
          title: Text(
            widget.postId == null ? 'Tạo tác phẩm' : 'Chỉnh sửa tác phẩm',
            style: const TextStyle(
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
              letterSpacing: -0.2,
            ),
          ),
          centerTitle: true,
          actions: [
            publishingContext.maybeWhen(
              data: (publishing) {
                final active = publishing.offerings
                    .where((v) => v.active && v.blockerCode == null)
                    .toList(growable: false);
                final canPublish = _isPublishReady(disabled: disabled);

                return Padding(
                  padding: const EdgeInsets.only(right: 14),
                  child: Center(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.primary.withValues(
                          alpha: 0.25,
                        ),
                        disabledForegroundColor: Colors.white.withValues(
                          alpha: 0.6,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 8,
                        ),
                        minimumSize: const Size(68, 36),
                      ),
                      onPressed: canPublish
                          ? () => _submit(
                              memberId: publishing.memberId,
                              active: active,
                            )
                          : null,
                      child: state.busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : Text(
                              widget.postId == null ? 'Đăng' : 'Lưu',
                              style: const TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                    ),
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
          ],
        ),
        body: detailScope != null && _base == null
            ? FeedFeedback(
                detail?.error ?? 'Đang tải bài quản lý…',
                retry: () =>
                    ref.read(feedDetailProvider(detailScope).notifier).load(),
              )
            : publishingContext.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => FeedFeedback(
                  feedError(error),
                  retry: () => ref.invalidate(feedPublishingContextProvider),
                ),
                data: (publishing) {
                  final active = publishing.offerings
                      .where((v) => v.active && v.blockerCode == null)
                      .toList(growable: false);

                  return Column(
                    children: [
                      // Upload Progress Bar
                      if (state.busy)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          color: AppColors.surfaceContainerLowest,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(100),
                                child: LinearProgressIndicator(
                                  value: state.progress == null
                                      ? null
                                      : state.progress! / 100,
                                  backgroundColor:
                                      AppColors.surfaceContainerHigh,
                                  valueColor:
                                      const AlwaysStoppedAnimation<Color>(
                                        AppColors.primary,
                                      ),
                                  minHeight: 5,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                state.progress == null
                                    ? 'Đang lưu tác phẩm…'
                                    : 'Đã tải lên ${state.progress}% · Chờ máy chủ xử lý…',
                                style: const TextStyle(
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),

                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                            if (state.error ?? _localError
                                case final String error)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: FeedFeedback(error),
                              ),
                            if (state.uncertain)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: FeedUncertainNotice(
                                  retryUncertain: () => ref
                                      .read(
                                        feedPublisherProvider(keyId).notifier,
                                      )
                                      .retryUncertain(),
                                ),
                              ),

                            // Partner Identity Header
                            FeedComposerIdentityBar(
                              displayName: user?.fullName ?? 'Đối tác Lambe',
                              avatarUrl: user?.avatarUrl,
                              memberId: publishing.memberId,
                            ),
                            const SizedBox(height: 16),

                            // Caption Input
                            TextField(
                              controller: _caption,
                              enabled: !disabled,
                              minLines: 4,
                              maxLines: 8,
                              maxLength: 2000,
                              buildCounter: (
                                _, {
                                required currentLength,
                                required isFocused,
                                maxLength,
                              }) => null, // Handled in bottom toolbar
                              style: const TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontSize: 15,
                                color: AppColors.onSurface,
                                height: 1.5,
                              ),
                              decoration: InputDecoration(
                                hintText: 'Chia sẻ câu chuyện hoặc kỹ thuật đằng sau tác phẩm này...',
                                hintStyle: TextStyle(
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontSize: 15,
                                  color: AppColors.textMuted.withValues(
                                    alpha: 0.7,
                                  ),
                                ),
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                            const SizedBox(height: 12),

                            // Media Section
                            if (widget.postId == null) ...[
                              FeedComposerMediaGrid(
                                files: _files,
                                disabled: disabled,
                                pick: _pick,
                                onRemove: _removeFile,
                                onClear: () => setState(() => _files = []),
                              ),
                              const SizedBox(height: 16),

                              // Customer Consent Card
                              FeedComposerConsentCard(
                                includesCustomer: _includes,
                                hasConsent: _consent,
                                disabled: disabled,
                                onIncludesChanged: (val) => setState(() {
                                  _includes = val;
                                  _consent = false;
                                }),
                                onConsentChanged: (val) =>
                                    setState(() => _consent = val),
                              ),
                            ] else
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceContainerLow,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: AppColors.surfaceContainerHighest,
                                  ),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(
                                      Icons.info_outline_rounded,
                                      size: 18,
                                      color: AppColors.textMuted,
                                    ),
                                    SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Chỉ sửa nội dung và dịch vụ; không thay media. Bài do nhân viên đăng sẽ chờ tổ chức duyệt lại sau khi sửa.',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            const SizedBox(height: 18),

                            // Service Section (Booking Handshake)
                            FeedComposerServiceSection(
                              items: active,
                              selected: _services,
                              disabled: disabled,
                              change: (id, val) => setState(() {
                                if (val) {
                                  _services.add(id);
                                } else {
                                  _services.remove(id);
                                }
                              }),
                            ),

                            if (_services.any(
                              (id) => !active.any((v) => v.id == id),
                            )) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppColors.errorContainer,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.warning_amber_rounded,
                                      color: AppColors.error,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    const Expanded(
                                      child: Text(
                                        'Có dịch vụ gắn thẻ đã hết hiệu lực.',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: AppColors.error,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: disabled
                                          ? null
                                          : () => setState(
                                              () => _services.removeWhere(
                                                (id) => !active.any(
                                                  (v) => v.id == id,
                                                ),
                                              ),
                                            ),
                                      child: const Text('Bỏ dịch vụ cũ'),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),

                      // Bottom Toolbar
                      FeedComposerBottomToolbar(
                        disabled: disabled,
                        isEditing: widget.postId != null,
                        charCount: _caption.text.length,
                        onPickPhoto: () => _pick(false),
                        onPickVideo: () => _pick(true),
                        onAddService: () => showServicePickerModal(
                          context: context,
                          items: active,
                          selected: _services,
                          disabled: disabled,
                          change: (id, val) => setState(() {
                            if (val) {
                              _services.add(id);
                            } else {
                              _services.remove(id);
                            }
                          }),
                        ),
                        onAddHashtag: _addHashtag,
                      ),
                    ],
                  );
                },
              ),
      ),
    );
  }

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }
}
