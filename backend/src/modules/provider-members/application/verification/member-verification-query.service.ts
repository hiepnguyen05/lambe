import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { AuthenticatedInternalAccount } from '../../../internal-auth/types/authenticated-internal-account.type';
import type { ProviderMemberVerificationQueryDto } from '../../dto/provider-member-verification.dto';
import { assertMemberKycReviewer } from '../../domain/member-review-access.policy';
import {
  currentVerification,
  lockVerificationMember,
  presentVerification,
} from './member-verification.persistence';

@Injectable()
export class MemberVerificationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ProviderMemberVerificationQueryDto,
    actor: AuthenticatedInternalAccount,
  ) {
    assertMemberKycReviewer(actor.roles);
    const ids = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT verification."id" FROM "provider_member_verifications" verification
      JOIN "provider_members" member ON member."id" = verification."memberId"
      WHERE verification."membershipVersion" = member."membershipVersion" AND member."status" <> 'LEFT'
        AND (${query.status ?? null}::text IS NULL OR verification."status"::text = ${query.status ?? null})
        AND (${query.providerId ?? null}::text IS NULL OR member."providerId" = ${query.providerId ?? null})
      ORDER BY verification."submittedAt" DESC NULLS LAST, verification."id" DESC
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
    `);
    const rows = await this.prisma.providerMemberVerification.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      select: {
        id: true,
        memberId: true,
        status: true,
        revisionNumber: true,
        submittedAt: true,
        reviewedAt: true,
        member: {
          select: {
            providerId: true,
            displayName: true,
            status: true,
            membershipVersion: true,
          },
        },
      },
    });
    const map = new Map(rows.map((r) => [r.id, r]));
    return {
      success: true,
      data: ids.map((r) => map.get(r.id)).filter((r) => r !== undefined),
    };
  }

  async findOne(
    memberId: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    assertMemberKycReviewer(actor.roles);
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId);
      const profile = await currentVerification(tx, member);
      await this.audit.record(
        {
          actorInternalAccountId: actor.accountId,
          action: 'PROVIDER_MEMBER_VERIFICATION_ACCESSED',
          resourceType: 'ProviderMemberVerification',
          resourceId: profile.id,
          result: 'SUCCESS',
          metadata: { memberId },
        },
        request,
        tx,
      );
      return presentVerification(profile);
    });
    return { success: true, data };
  }
}
