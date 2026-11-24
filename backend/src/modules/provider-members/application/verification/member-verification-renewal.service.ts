import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { ReopenProviderMemberVerificationDto } from '../../dto/provider-member-verification.dto';
import { assertNoMemberExitObligations } from '../member-exit-obligations';
import {
  currentVerification,
  lockVerificationMember,
  memberVerificationInclude,
  presentVerification,
} from './member-verification.persistence';

@Injectable()
export class MemberVerificationRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async reopen(
    userId: string,
    memberId: string,
    dto: ReopenProviderMemberVerificationDto,
    request: RequestMetadata,
  ) {
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId, userId);
      if (
        member.user.status !== 'ACTIVE' ||
        member.provider.status === 'SUSPENDED'
      )
        throw new ForbiddenException('Tài khoản hoặc tổ chức đang bị hạn chế.');
      const profile = await currentVerification(tx, member);
      if (profile.status !== 'APPROVED')
        throw new ConflictException('Chỉ mở lại hồ sơ đã duyệt để cập nhật.');
      if (
        !dto.documentIds.length ||
        dto.documentIds.some(
          (id) => !profile.documents.some((d) => d.id === id),
        )
      )
        throw new BadRequestException(
          'Tài liệu cập nhật không thuộc hồ sơ hiện hành.',
        );
      await assertNoMemberExitObligations(tx, member.providerId, member.id);
      await tx.providerMemberDocument.updateMany({
        where: {
          verificationId: profile.id,
          id: { in: dto.documentIds },
          supersededAt: null,
        },
        data: {
          status: 'NEEDS_CHANGES',
          reviewNote: 'Thành viên đề nghị cập nhật tài liệu.',
          reviewedAt: null,
          reviewedById: null,
        },
      });
      if (member.role === 'WORKER') {
        await tx.providerMember.update({
          where: { id: memberId },
          data:
            member.status === 'SUSPENDED'
              ? { suspendedFromStatus: 'PENDING_VERIFICATION' }
              : { status: 'PENDING_VERIFICATION' },
        });
      } else {
        await tx.providerMember.update({
          where: { id: memberId },
          data: { canProvideServices: false },
        });
      }
      const updated = await tx.providerMemberVerification.update({
        where: { id: profile.id },
        data: { status: 'NEEDS_CHANGES', decisionReason: dto.reason },
        include: memberVerificationInclude,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_VERIFICATION_REOPENED',
          resourceType: 'ProviderMemberVerification',
          resourceId: profile.id,
          result: 'SUCCESS',
          metadata: { memberId, documentIds: dto.documentIds },
        },
        request,
        tx,
      );
      return presentVerification(updated);
    });
    return { success: true, data };
  }
}
