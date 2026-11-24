import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import type { ProviderMembersQueryDto } from '../dto/provider-members.dto';
import { ProviderMemberAccessService } from './provider-member-access.service';
import { providerMemberSelect } from './provider-members.select';
import { assertNoMemberExitObligations } from './member-exit-obligations';

@Injectable()
export class ProviderMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, query: ProviderMembersQueryDto) {
    const owner = await this.access.requireOrganizationOwner(userId);
    const data = await this.prisma.providerMember.findMany({
      where: { providerId: owner.providerId },
      select: {
        ...providerMemberSelect,
        verifications: {
          take: 1,
          orderBy: { membershipVersion: 'desc' },
          select: { membershipVersion: true, status: true },
        },
      },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      success: true,
      data: data.map(({ verifications, ...member }) => ({
        ...member,
        verificationStatus:
          verifications[0]?.membershipVersion === member.membershipVersion
            ? verifications[0].status
            : null,
      })),
    };
  }

  async findMine(userId: string) {
    const data = await this.prisma.providerMember.findMany({
      where: { userId, status: { not: 'LEFT' } },
      select: {
        ...providerMemberSelect,
        provider: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            providerType: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: 50,
    });
    return { success: true, data };
  }

  async leave(userId: string, memberId: string, request: RequestMetadata) {
    const data = await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.providerMember.findFirst({
        where: { id: memberId, userId },
        select: { providerId: true },
      });
      if (!candidate) throw new NotFoundException('Không tìm thấy membership.');
      await this.access.lockProvider(tx, candidate.providerId);
      await this.access.lockUser(tx, userId);
      const member = await tx.providerMember.findUniqueOrThrow({
        where: { id: memberId },
        select: providerMemberSelect,
      });
      if (member.role === 'OWNER') {
        throw new ForbiddenException(
          'Owner phải hoàn tất chuyển giao quyền sở hữu trước khi rời tổ chức.',
        );
      }
      if (member.status === 'LEFT') return member;
      if (member.status === 'SUSPENDED') {
        throw new ConflictException(
          'Liên hệ hỗ trợ để kiểm tra đơn và nghĩa vụ còn lại trước khi rời tổ chức.',
        );
      }
      if (member.status === 'ACTIVE') {
        const profile = await tx.providerMemberVerification.findFirst({
          where: {
            memberId,
            membershipVersion: member.membershipVersion,
            status: 'APPROVED',
          },
          select: { id: true },
        });
        if (!profile)
          throw new ConflictException(
            'Cần hỗ trợ xác minh trạng thái KYC trước khi rời.',
          );
        await assertNoMemberExitObligations(tx, member.providerId, member.id);
      }
      const result = await tx.providerMember.update({
        where: { id: memberId },
        data: { status: 'LEFT', leftAt: new Date() },
        select: providerMemberSelect,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_LEFT',
          resourceType: 'ProviderMember',
          resourceId: memberId,
          result: 'SUCCESS',
          metadata: { providerId: member.providerId },
        },
        request,
        tx,
      );
      return result;
    });
    return { success: true, data };
  }
}
