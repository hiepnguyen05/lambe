import { Injectable } from '@nestjs/common';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { OrganizationMemberReceivingDto } from '../../dto/member-capabilities.dto';
import { ProviderMemberAccessService } from '../provider-member-access.service';

@Injectable()
export class MemberOrganizationReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async status(userId: string) {
    const owner = await this.access.requireOrganizationOwner(userId);
    const provider = await this.prisma.providerProfile.findUniqueOrThrow({
      where: { id: owner.providerId },
      select: { id: true, acceptingMemberOrders: true, status: true },
    });
    return {
      success: true,
      data: {
        providerId: provider.id,
        enabled: provider.acceptingMemberOrders,
        providerStatus: provider.status,
      },
    };
  }

  async configure(
    userId: string,
    dto: OrganizationMemberReceivingDto,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const owner = await this.access.requireOrganizationOwner(userId, tx);
      await tx.providerProfile.update({
        where: { id: owner.providerId },
        data: { acceptingMemberOrders: dto.enabled },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'ORGANIZATION_MEMBER_RECEIVING_CHANGED',
          resourceType: 'ProviderProfile',
          resourceId: owner.providerId,
          result: 'SUCCESS',
          metadata: { enabled: dto.enabled, reason: dto.reason },
        },
        request,
        tx,
      );
    });
    return this.status(userId);
  }
}
