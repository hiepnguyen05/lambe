import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class FeedComposerConsentCard extends StatelessWidget {
  final bool includesCustomer;
  final bool hasConsent;
  final bool disabled;
  final ValueChanged<bool> onIncludesChanged;
  final ValueChanged<bool> onConsentChanged;

  const FeedComposerConsentCard({
    super.key,
    required this.includesCustomer,
    required this.hasConsent,
    required this.disabled,
    required this.onIncludesChanged,
    required this.onConsentChanged,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: includesCustomer && !hasConsent
              ? AppColors.primary.withValues(alpha: 0.35)
              : AppColors.surfaceContainerHigh.withValues(alpha: 0.6),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.person_pin_circle_outlined,
                  size: 18,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Có xuất hiện khách hàng',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Hình ảnh khuôn mặt, vóc dáng của khách hàng',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 11.5,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: includesCustomer,
                activeTrackColor: AppColors.primary,
                onChanged: disabled ? null : onIncludesChanged,
              ),
            ],
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            child: includesCustomer
                ? Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.only(top: 8),
                    decoration: const BoxDecoration(
                      border: Border(
                        top: BorderSide(
                          color: AppColors.surfaceContainerHigh,
                          width: 0.8,
                        ),
                      ),
                    ),
                    child: CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                      activeColor: AppColors.primary,
                      value: hasConsent,
                      onChanged: disabled
                          ? null
                          : (value) => onConsentChanged(value ?? false),
                      title: const Text(
                        'Tôi xác nhận khách hàng đã đồng ý sử dụng hình ảnh',
                        style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.onSurface,
                        ),
                      ),
                      subtitle: const Text(
                        'Tuân thủ chính sách quyền riêng tư và quy định bảo vệ dữ liệu khách hàng.',
                        style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

