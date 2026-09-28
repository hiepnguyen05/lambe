import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProviderApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import type { ProviderApplicationQueryDto } from '../../dto/provider-application-query.dto';
import {
  applicantProviderApplicationSelect,
  internalProviderApplicationDetailInclude,
  providerApplicationListSelect,
} from '../persistence/provider-application.select';
import { KycCryptoService } from '../kyc/kyc-crypto.service';

@Injectable()
export class ProviderApplicationsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kycCrypto: KycCryptoService,
    private readonly audit: AuditService,
  ) {}

  async findMine(userId: string) {
    const applications = await this.prisma.providerApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: providerApplicationListSelect,
    });
    return { success: true, data: applications };
  }

  async findMineById(id: string, userId: string) {
    const application = await this.prisma.providerApplication.findFirst({
      where: { id, userId },
      select: applicantProviderApplicationSelect,
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    }
    const { nationalIdLast4, ...safeApplication } = application;
    return {
      success: true,
      data: {
        ...safeApplication,
        nationalIdMasked: this.kycCrypto.maskNationalId(nationalIdLast4),
      },
    };
  }

  async findAllForInternal(
    query: ProviderApplicationQueryDto,
    allowIdentitySearch = false,
  ) {
    const where: Prisma.ProviderApplicationWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.providerType) where.providerType = query.providerType;
    if (query.search?.trim()) {
      const search = query.search.trim();
      const conditions: Prisma.ProviderApplicationWhereInput[] = [
        { legalFullName: { contains: search, mode: 'insensitive' } },
        { organizationName: { contains: search, mode: 'insensitive' } },
        { user: { phone: { contains: search } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
      if (
        allowIdentitySearch &&
        /^\d{12}$/.test(search) &&
        this.kycCrypto.isConfigured()
      ) {
        conditions.push({
          OR: [
            { nationalIdHash: this.kycCrypto.hashNationalId(search) },
            { nationalIdNumber: search },
          ],
        });
      }
      where.OR = conditions;
    }

    const [applications, total] = await this.prisma.$transaction([
      this.prisma.providerApplication.findMany({
        where,
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: providerApplicationListSelect,
      }),
      this.prisma.providerApplication.count({ where }),
    ]);
    return {
      success: true,
      data: applications,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOneForInternal(
    id: string,
    actorId: string,
    request: RequestMetadata,
  ) {
    const application = await this.prisma.providerApplication.findUnique({
      where: { id },
      include: internalProviderApplicationDetailInclude,
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    }
    const {
      nationalIdEncrypted,
      nationalIdHash: _nationalIdHash,
      nationalIdLast4,
      nationalIdNumber: legacyNationalId,
      ...safeApplication
    } = application;
    void _nationalIdHash;
    const nationalIdNumber = nationalIdEncrypted
      ? this.kycCrypto.revealNationalId(nationalIdEncrypted)
      : legacyNationalId;
    await this.audit.record(
      {
        actorInternalAccountId: actorId,
        action: 'KYC_APPLICATION_ACCESSED',
        resourceType: 'ProviderApplication',
        resourceId: id,
        result: 'SUCCESS',
      },
      request,
    );
    return {
      success: true,
      data: {
        ...safeApplication,
        nationalIdNumber,
        nationalIdMasked: this.kycCrypto.maskNationalId(nationalIdLast4),
      },
    };
  }

  async findOneForSupport(id: string) {
    const application = await this.prisma.providerApplication.findUnique({
      where: { id },
      select: {
        ...providerApplicationListSelect,
        services: {
          select: {
            id: true,
            serviceId: true,
            proposedPriceAmount: true,
            status: true,
            service: { select: { id: true, name: true, targetAudience: true } },
          },
        },
      },
    });
    if (!application)
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    return { success: true, data: application };
  }

  async countPending() {
    return this.prisma.providerApplication.count({
      where: { status: ProviderApplicationStatus.PENDING_REVIEW },
    });
  }
}
