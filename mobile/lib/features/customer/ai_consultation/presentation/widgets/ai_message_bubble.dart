import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/ai_consultation_entities.dart';
import 'ai_provider_suggestions.dart';
import 'ai_post_suggestions.dart';
import 'ai_service_suggestions.dart';

class AiMessageBubble extends StatelessWidget {
  final AiConsultationMessageEntity message;
  final ValueChanged<String> onRetryMessage;
  final VoidCallback onRefreshRecommendations;
  final VoidCallback onLocationRequested;
  final VoidCallback onExploreServices;
  final ValueChanged<AiSuggestedServiceEntity> onServiceSelected;
  final ValueChanged<AiSuggestedPostEntity> onPostSelected;
  final VoidCallback onBookingTimeRequested;
  final VoidCallback onSavedAddressRequested;
  final VoidCallback onFindProviders;
  final ValueChanged<AiSuggestedProviderEntity> onProviderSelected;

  const AiMessageBubble({
    super.key,
    required this.message,
    required this.onRetryMessage,
    required this.onRefreshRecommendations,
    required this.onLocationRequested,
    required this.onExploreServices,
    required this.onServiceSelected,
    required this.onPostSelected,
    required this.onBookingTimeRequested,
    required this.onSavedAddressRequested,
    required this.onFindProviders,
    required this.onProviderSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    final result = message.result;
    return AbsorbPointer(
      absorbing: message.isRefreshingRecommendations,
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * (isUser ? 0.78 : 0.88),
          ),
          margin: EdgeInsets.fromLTRB(isUser ? 58 : 16, 5, isUser ? 16 : 42, 5),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isUser
                ? AppColors.primary
                : AppColors.surfaceContainerLowest,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(17),
              topRight: const Radius.circular(17),
              bottomLeft: Radius.circular(isUser ? 17 : 5),
              bottomRight: Radius.circular(isUser ? 5 : 17),
            ),
            border: isUser
                ? null
                : Border.all(
                    color: AppColors.outlineVariant.withValues(alpha: 0.5),
                  ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                message.text,
                style: TextStyle(
                  color: isUser ? AppColors.onPrimary : AppColors.onSurface,
                  fontSize: 14,
                  height: 1.48,
                ),
              ),
              if (message.isPending) ...[
                const SizedBox(height: 6),
                Text(
                  'Đang gửi',
                  style: TextStyle(
                    color: AppColors.onPrimary.withValues(alpha: 0.72),
                    fontSize: 10.5,
                  ),
                ),
              ],
              if (message.hasError) ...[
                const SizedBox(height: 6),
                TextButton.icon(
                  onPressed: () => onRetryMessage(message.id),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.onPrimary,
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 32),
                  ),
                  icon: const Icon(Icons.refresh_rounded, size: 17),
                  label: const Text('Thử lại'),
                ),
              ],
              if (!isUser && result != null) ...[
                if (message.isRefreshingRecommendations) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerHigh.withValues(
                        alpha: 0.5,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                            strokeWidth: 1.8,
                            color: AppColors.primary,
                          ),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Đang cập nhật gợi ý…',
                          style: TextStyle(
                            fontSize: 11.5,
                            color: AppColors.onSurfaceVariant,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (message.recommendationsRefreshFailed) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.errorContainer.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.error.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(
                              Icons.sync_problem_rounded,
                              size: 16,
                              color: AppColors.error,
                            ),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Chưa thể kiểm tra gợi ý. Bạn hãy thử lại nhé.',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.onErrorContainer,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        TextButton.icon(
                          onPressed: onRefreshRecommendations,
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            minimumSize: const Size(0, 32),
                          ),
                          icon: const Icon(Icons.refresh_rounded, size: 16),
                          label: const Text(
                            'Kiểm tra lại gợi ý',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (result.suggestionsExpired) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.hotBadgeBg.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: AppColors.starAmber.withValues(alpha: 0.4),
                      ),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          size: 15,
                          color: AppColors.hotBadgeText,
                        ),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Một số gợi ý hoặc mức giá đã thay đổi. Bạn xem lại lựa chọn mới nhé.',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppColors.hotBadgeText,
                              height: 1.35,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                AbsorbPointer(
                  absorbing: message.recommendationsRefreshFailed,
                  child: AiServiceSuggestions(
                    services: result.suggestedServices,
                    onExploreServices: onExploreServices,
                    onServiceSelected: onServiceSelected,
                  ),
                ),
                AbsorbPointer(
                  absorbing: message.recommendationsRefreshFailed,
                  child: AiPostSuggestions(
                    posts: result.suggestedPosts,
                    onPostSelected: onPostSelected,
                  ),
                ),
                AbsorbPointer(
                  absorbing: message.recommendationsRefreshFailed,
                  child: AiProviderSuggestions(
                    providers: result.suggestedProviders,
                    onProviderSelected: onProviderSelected,
                  ),
                ),
                if (result.nextAction == 'REQUEST_LOCATION') ...[
                  const SizedBox(height: 10),
                  FilledButton.tonalIcon(
                    onPressed: message.recommendationsRefreshFailed
                        ? null
                        : onLocationRequested,
                    style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.my_location_rounded, size: 18),
                    label: const Text('Dùng vị trí hiện tại'),
                  ),
                  TextButton(
                    onPressed: message.recommendationsRefreshFailed
                        ? null
                        : onSavedAddressRequested,
                    child: const Text('Chọn địa chỉ đã lưu'),
                  ),
                  TextButton(
                    onPressed: message.recommendationsRefreshFailed
                        ? null
                        : onFindProviders,
                    child: const Text('Tôi đã chọn địa chỉ mặc định'),
                  ),
                ],
                if (result.nextAction == 'REQUEST_BOOKING_TIME') ...[
                  const SizedBox(height: 10),
                  FilledButton.tonalIcon(
                    onPressed: message.recommendationsRefreshFailed
                        ? null
                        : onBookingTimeRequested,
                    style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.schedule_outlined, size: 18),
                    label: const Text('Chọn thời gian làm dịch vụ'),
                  ),
                ],
                if (result.followUpQuestion?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.secondaryContainer.withValues(
                        alpha: 0.35,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.15),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.help_outline_rounded,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            result.followUpQuestion!.trim(),
                            style: const TextStyle(
                              color: AppColors.onSurface,
                              fontSize: 13,
                              height: 1.4,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (result.nextAction == 'OFFER_PROVIDER_SEARCH' &&
                    result.conversionPrompt?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 12),
                  Text(
                    result.conversionPrompt!.trim(),
                    style: const TextStyle(
                      color: AppColors.onSurfaceVariant,
                      fontSize: 12.5,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.tonalIcon(
                    onPressed: message.recommendationsRefreshFailed
                        ? null
                        : onFindProviders,
                    style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.person_search_rounded, size: 18),
                    label: const Text('Tìm chuyên viên phù hợp'),
                  ),
                ],
                if (result.citations.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: result.citations
                        .take(3)
                        .map(
                          (citation) => InkWell(
                            onTap: () => _openCitation(citation.url),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceContainerHigh
                                    .withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: AppColors.outlineVariant.withValues(
                                    alpha: 0.4,
                                  ),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.link_rounded,
                                    size: 13,
                                    color: AppColors.primary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    citation.title,
                                    style: const TextStyle(
                                      color: AppColors.primary,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        )
                        .toList(growable: false),
                  ),
                ],
                if (result.degradedMode) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerHigh.withValues(
                        alpha: 0.45,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.auto_awesome_outlined,
                          size: 13,
                          color: AppColors.outline,
                        ),
                        SizedBox(width: 5),
                        Text(
                          'Phản hồi dự phòng · Bạn có thể thử hỏi lại chi tiết hơn.',
                          style: TextStyle(
                            color: AppColors.outline,
                            fontSize: 10.5,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openCitation(String value) async {
    final uri = Uri.tryParse(value);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
