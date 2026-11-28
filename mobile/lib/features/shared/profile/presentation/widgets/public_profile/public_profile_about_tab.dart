import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/lambe_icon_widget.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

class PublicProfileAboutTab extends StatefulWidget {
  final PartnerPublicProfileEntity profile;
  final ValueChanged<PublicServiceItemEntity>? onSelectService;
  final VoidCallback? onViewAllPortfolio;
  final VoidCallback? onViewAllReviews;

  const PublicProfileAboutTab({
    super.key,
    required this.profile,
    this.onSelectService,
    this.onViewAllPortfolio,
    this.onViewAllReviews,
  });

  @override
  State<PublicProfileAboutTab> createState() => _PublicProfileAboutTabState();
}

class _PublicProfileAboutTabState extends State<PublicProfileAboutTab> {
  String _selectedCategory = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final profile = widget.profile;
    final categories = ['Tất cả', ...profile.categories];
    final services = _selectedCategory == 'Tất cả'
        ? profile.services
        : profile.services
              .where((service) => service.categoryName == _selectedCategory)
              .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AboutCard(profile: profile),
        const SizedBox(height: 20),
        _SectionHeader(
          icon: Icons.design_services_rounded,
          title: 'Dịch vụ cung cấp',
          trailing: '${profile.services.length}',
        ),
        if (categories.length > 1) ...[
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: categories
                  .map(
                    (category) {
                      final isSelected = category == _selectedCategory;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(
                            category,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: isSelected
                                  ? Colors.white
                                  : AppColors.onSurface,
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: AppColors.primary,
                          backgroundColor: AppColors.surfaceContainerLowest,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(100),
                          ),
                          side: BorderSide(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.outlineVariant.withValues(
                                    alpha: 0.35,
                                  ),
                          ),
                          showCheckmark: false,
                          onSelected: (_) =>
                              setState(() => _selectedCategory = category),
                        ),
                      );
                    },
                  )
                  .toList(),
            ),
          ),
        ],
        const SizedBox(height: 12),
        if (services.isEmpty)
          const _EmptyCard('Chuyên viên chưa có dịch vụ trong danh mục này.')
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: services.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, index) => _ServiceCard(
              service: services[index],
              onTap: widget.onSelectService,
            ),
          ),
        const SizedBox(height: 20),
        _PortfolioSection(
          profile: profile,
          onViewAll: widget.onViewAllPortfolio,
        ),
        const SizedBox(height: 20),
        _ReviewSection(profile: profile, onViewAll: widget.onViewAllReviews),
      ],
    );
  }
}

class _AboutCard extends StatelessWidget {
  final PartnerPublicProfileEntity profile;

  const _AboutCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final biography = profile.biography.isNotEmpty
        ? profile.biography
        : 'Hơn ${profile.experienceYears} năm kinh nghiệm phục vụ chăm sóc '
              'sắc đẹp tại khu vực ${profile.serviceAreaName}.';
    final certificates = profile.categories.isNotEmpty
        ? profile.categories
        : const ['Chứng chỉ Chuyên Môn', 'Quy trình vô trùng'];

    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.badge_rounded,
            title: 'Về chuyên viên ${profile.displayName}',
          ),
          const SizedBox(height: 10),
          Text(
            biography,
            style: const TextStyle(
              fontSize: 13,
              height: 1.5,
              color: AppColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: certificates.map(_CertificateChip.new).toList(),
          ),
        ],
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  static final _currency = NumberFormat.decimalPattern('vi_VN');

  final PublicServiceItemEntity service;
  final ValueChanged<PublicServiceItemEntity>? onTap;

  const _ServiceCard({required this.service, this.onTap});

  @override
  Widget build(BuildContext context) {
    final description = service.description?.trim();
    final showDescription =
        description != null &&
        description.isNotEmpty &&
        !description.toLowerCase().contains('cung cấp bởi đối tác lambe');

    return _SurfaceCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.primaryContainer.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: LambeIconWidget(
              iconStr: _serviceIcon(service),
              size: 22,
              imageSize: 44,
              imageFit: BoxFit.cover,
              color: AppColors.primary,
              fallbackIcon: Icons.auto_awesome_rounded,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        service.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.onSurface,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${_currency.format(service.priceAmount)}đ',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${service.durationMinutes} phút • ${service.categoryName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                if (showDescription) ...[
                  const SizedBox(height: 3),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: SizedBox(
                    height: 32,
                    child: FilledButton(
                      onPressed: onTap == null ? null : () => onTap!(service),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.onPrimary,
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100),
                        ),
                      ),
                      child: const Text(
                        'Đặt lịch',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
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
  }
}

class _PortfolioSection extends StatelessWidget {
  final PartnerPublicProfileEntity profile;
  final VoidCallback? onViewAll;

  const _PortfolioSection({required this.profile, this.onViewAll});

  @override
  Widget build(BuildContext context) {
    final items = profile.portfolio.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          icon: Icons.photo_library_rounded,
          title: 'Tác phẩm thực tế của thợ',
          actionText: 'Xem tất cả (${profile.portfolio.length})',
          onAction: onViewAll,
        ),
        const SizedBox(height: 10),
        if (items.isEmpty)
          const _EmptyCard('Chuyên viên đang cập nhật hình ảnh tác phẩm.')
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              childAspectRatio: 4 / 5,
            ),
            itemBuilder: (_, index) => _PortfolioCard(item: items[index]),
          ),
      ],
    );
  }
}

class _PortfolioCard extends StatelessWidget {
  final PublicPortfolioItemEntity item;

  const _PortfolioCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (item.imageUrl.isNotEmpty)
            Image.network(
              item.imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const _ImageFallback(),
            )
          else
            const _ImageFallback(),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(6),
              color: Colors.black.withValues(alpha: 0.55),
              child: Text(
                item.title.isEmpty ? 'Tác phẩm' : item.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewSection extends StatelessWidget {
  final PartnerPublicProfileEntity profile;
  final VoidCallback? onViewAll;

  const _ReviewSection({required this.profile, this.onViewAll});

  @override
  Widget build(BuildContext context) {
    final review = profile.reviews.isEmpty ? null : profile.reviews.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          icon: Icons.rate_review_rounded,
          title: 'Đánh giá thực tế nổi bật',
          actionText:
              profile.reviewCount > 0 ? 'Xem ${profile.reviewCount} bài' : null,
          onAction: profile.reviewCount > 0 ? onViewAll : null,
        ),
        const SizedBox(height: 10),
        if (review == null)
          const _EmptyCard('Chưa có bài đánh giá nổi bật từ khách hàng.')
        else
          _SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    child: Text(
                      review.customerName.isEmpty
                          ? 'K'
                          : review.customerName[0].toUpperCase(),
                    ),
                  ),
                  title: Text(review.customerName),
                  subtitle: Text(_relativeDate(review.createdAt)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(
                      5,
                      (index) => Icon(
                        index < review.rating
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        size: 14,
                        color: AppColors.secondary,
                      ),
                    ),
                  ),
                ),
                if (review.comment.isNotEmpty)
                  Text(
                    '“${review.comment}”',
                    style: const TextStyle(fontSize: 12.5, height: 1.45),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? trailing;
  final String? actionText;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.icon,
    required this.title,
    this.trailing,
    this.actionText,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
        ),
        if (trailing != null) Chip(label: Text(trailing!)),
        if (actionText != null)
          TextButton(onPressed: onAction, child: Text(actionText!)),
      ],
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const _SurfaceCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.2),
        ),
      ),
      child: child,
    );
  }
}

class _EmptyCard extends StatelessWidget {
  final String message;

  const _EmptyCard(this.message);

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant),
      ),
    );
  }
}

class _CertificateChip extends StatelessWidget {
  final String label;

  const _CertificateChip(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primaryContainer.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: AppColors.primaryContainer.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.verified_rounded,
            size: 13,
            color: AppColors.primary,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: AppColors.surfaceContainer,
    child: Icon(Icons.image_outlined, color: AppColors.outline),
  );
}

String _relativeDate(DateTime date) {
  final days = DateTime.now().difference(date).inDays;
  if (days <= 0) return 'Hôm nay';
  if (days < 7) return '$days ngày trước';
  return DateFormat('dd/MM/yyyy').format(date);
}

String _serviceIcon(PublicServiceItemEntity service) {
  final value = service.iconUrl?.trim();
  if (value != null && value.isNotEmpty) return value;

  final text = '${service.name} ${service.categoryName}'.toLowerCase();
  if (text.contains('tóc') || text.contains('cắt')) return 'scissors';
  if (text.contains('nhuộm') || text.contains('màu')) return 'palette';
  if (text.contains('móng') || text.contains('nail')) return 'brush';
  if (text.contains('mi') || text.contains('mắt')) return 'eye';
  if (text.contains('massage') || text.contains('spa')) return 'flower-2';
  if (text.contains('gội') || text.contains('tắm')) return 'droplets';
  return 'sparkles';
}
