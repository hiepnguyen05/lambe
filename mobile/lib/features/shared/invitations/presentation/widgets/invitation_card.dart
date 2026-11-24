import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/received_invitation_entity.dart';

class InvitationCard extends StatelessWidget {
  final ReceivedInvitationEntity invitation;
  final VoidCallback? onTap;

  const InvitationCard({super.key, required this.invitation, this.onTap});

  @override
  Widget build(BuildContext context) {
    Color statusBg;
    Color statusFg;
    String statusText;

    if (invitation.isPending) {
      statusBg = const Color(0xFFFEF3C7);
      statusFg = const Color(0xFFD97706);
      statusText = 'Chờ bạn phản hồi';
    } else if (invitation.isAccepted) {
      statusBg = const Color(0xFFE0F2FE);
      statusFg = const Color(0xFF0F766E);
      statusText = 'Đã tham gia';
    } else {
      statusBg = const Color(0xFFF3F4F6);
      statusFg = const Color(0xFF6B7280);
      statusText = 'Đã kết thúc';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Salon Avatar
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: AppColors.surfaceContainerHigh,
                    image:
                        invitation.providerAvatarUrl != null &&
                            invitation.providerAvatarUrl!.isNotEmpty
                        ? DecorationImage(
                            image: NetworkImage(invitation.providerAvatarUrl!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child:
                      invitation.providerAvatarUrl == null ||
                          invitation.providerAvatarUrl!.isEmpty
                      ? const Icon(
                          Icons.storefront_rounded,
                          size: 28,
                          color: AppColors.primary,
                        )
                      : null,
                ),
                const SizedBox(width: 14),
                // Salon Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        invitation.providerDisplayName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        invitation.providerServiceAreaName != null &&
                                invitation.providerServiceAreaName!.isNotEmpty
                            ? invitation.providerServiceAreaName!
                            : 'Cơ sở đối tác Lambe',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6B7280),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            'Hết hạn: ${DateFormat('dd/MM/yyyy').format(invitation.expiresAt)}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: statusBg,
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: Text(
                              statusText,
                              style: TextStyle(
                                color: statusFg,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFF9CA3AF),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
