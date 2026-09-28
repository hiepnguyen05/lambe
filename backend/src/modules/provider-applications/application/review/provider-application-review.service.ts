import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderApplicationSection,
  ProviderApplicationStatus,
  ProviderType,
  ReviewStatus,
  UserRole,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  ProviderApplicationDecisionDto,
  ReviewItemDto,
} from '../../dto/review-provider-application.dto';
import { assertReviewNote } from '../../domain/provider-application.policy';
import { ProviderApplicationNotificationService } from '../notifications/provider-application-notification.service';
import {
  assertPendingApplication,
  lockProviderApplication,
  lockProviderCatalog,
} from '../persistence/provider-application-lock';
import { assertProviderApprovable } from '../../domain/provider-approval.policy';
import { assertProviderServiceEligible } from '../../domain/provider-service-eligibility.policy';

@Injectable()
export class ProviderApplicationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: ProviderApplicationNotificationService,
  ) {}

  async reviewCheck(
    applicationId: string,
    section: ProviderApplicationSection,
    dto: ReviewItemDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    assertReviewNote(dto.status, dto.reviewNote);
    const updated = await this.prisma.$transaction(async (transaction) => {
      await this.assertPending(applicationId, transaction);
      const check = await transaction.providerApplicationCheck.findUnique({
        where: { applicationId_section: { applicationId, section } },
      });
      if (!check)
        throw new NotFoundException('Không tìm thấy hạng mục xét duyệt.');
      const result = await transaction.providerApplicationCheck.update({
        where: { id: check.id },
        data: {
          status: dto.status,
          reviewNote: dto.reviewNote,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      await this.recordReview(
        'PROVIDER_APPLICATION_CHECK_REVIEWED',
        applicationId,
        actorId,
        { section, status: dto.status },
        request,
        transaction,
      );
      return result;
    });
    return {
      success: true,
      message: 'Đã cập nhật hạng mục xét duyệt.',
      data: updated,
    };
  }

  async reviewDocument(
    applicationId: string,
    documentId: string,
    dto: ReviewItemDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    assertReviewNote(dto.status, dto.reviewNote);
    await this.prisma.$transaction(async (transaction) => {
      await this.assertPending(applicationId, transaction);
      const updated = await transaction.providerApplicationDocument.updateMany({
        where: { id: documentId, applicationId },
        data: {
          status: dto.status,
          reviewNote: dto.reviewNote,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      if (!updated.count) {
        throw new NotFoundException('Không tìm thấy tài liệu.');
      }
      await this.recordReview(
        'PROVIDER_APPLICATION_DOCUMENT_REVIEWED',
        applicationId,
        actorId,
        { documentId, status: dto.status },
        request,
        transaction,
      );
    });
    return { success: true, message: 'Đã xét duyệt tài liệu.' };
  }

  async reviewService(
    applicationId: string,
    itemId: string,
    dto: ReviewItemDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    assertReviewNote(dto.status, dto.reviewNote);
    await this.prisma.$transaction(async (transaction) => {
      const current = await this.assertPending(applicationId, transaction);
      const item = current.services.find((item) => item.id === itemId);
      if (!item) throw new NotFoundException('Không tìm thấy dịch vụ đăng ký.');
      if (dto.status === ReviewStatus.VERIFIED)
        assertProviderServiceEligible(
          item,
          current.experienceYears,
          current.documents,
          true,
        );
      const updated = await transaction.providerApplicationService.updateMany({
        where: { id: itemId, applicationId },
        data: {
          status: dto.status,
          reviewNote: dto.reviewNote,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      if (!updated.count) {
        throw new NotFoundException('Không tìm thấy dịch vụ đăng ký.');
      }
      await this.recordReview(
        'PROVIDER_APPLICATION_SERVICE_REVIEWED',
        applicationId,
        actorId,
        { itemId, status: dto.status },
        request,
        transaction,
      );
    });
    return { success: true, message: 'Đã xét duyệt dịch vụ đăng ký.' };
  }

  async requestChanges(
    id: string,
    dto: ProviderApplicationDecisionDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    await this.updateDecision(
      id,
      ProviderApplicationStatus.NEEDS_CHANGES,
      dto.reason,
      actorId,
      'PROVIDER_APPLICATION_CHANGES_REQUESTED',
      request,
    );
    return { success: true, message: 'Đã gửi yêu cầu bổ sung hồ sơ.' };
  }

  async reject(
    id: string,
    dto: ProviderApplicationDecisionDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    await this.updateDecision(
      id,
      ProviderApplicationStatus.REJECTED,
      dto.reason,
      actorId,
      'PROVIDER_APPLICATION_REJECTED',
      request,
    );
    return { success: true, message: 'Đã từ chối hồ sơ đăng ký.' };
  }

  async approve(id: string, actorId: string, request: RequestMetadata) {
    const provider = await this.prisma.$transaction(async (transaction) => {
      const application = await this.assertPending(id, transaction, true);
      assertProviderApprovable(application);
      const verifiedServices = application.services.filter(
        (item) => item.status === ReviewStatus.VERIFIED,
      );
      const displayName =
        application.providerType === ProviderType.INDIVIDUAL
          ? application.legalFullName
          : application.organizationName;
      if (!displayName) {
        throw new BadRequestException('Hồ sơ thiếu tên hiển thị nhà cung cấp.');
      }

      const changed = await transaction.providerApplication.updateMany({
        where: { id, status: ProviderApplicationStatus.PENDING_REVIEW },
        data: {
          status: ProviderApplicationStatus.APPROVED,
          reviewedById: actorId,
          reviewedAt: new Date(),
          decisionReason: null,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Hồ sơ vừa được xử lý bởi một kiểm duyệt viên khác.',
        );
      }
      await transaction.userRoleAssignment.upsert({
        where: {
          userId_role: { userId: application.userId, role: UserRole.PROVIDER },
        },
        create: {
          userId: application.userId,
          role: UserRole.PROVIDER,
          sourceApplicationId: id,
        },
        update: { sourceApplicationId: id },
      });
      const created = await transaction.providerProfile.create({
        data: {
          userId: application.userId,
          sourceApplicationId: id,
          providerType: application.providerType,
          displayName,
          // KYC assets remain private. Publishing a portrait requires a separate,
          // explicitly moderated copy into the public media namespace.
          avatarUrl: null,
          biography: application.biography,
          experienceYears: application.experienceYears,
          wallet: { create: {} },
          services: {
            create: verifiedServices.map((item) => ({
              serviceId: item.serviceId,
              sourceApplicationId: id,
              priceAmount: item.proposedPriceAmount,
              durationMinutes: item.durationMinutes,
              description: item.description,
            })),
          },
        },
        include: { wallet: true, services: true },
      });
      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action: 'PROVIDER_APPLICATION_APPROVED',
          resourceType: 'ProviderApplication',
          resourceId: id,
          result: 'SUCCESS',
          metadata: {
            userId: application.userId,
            providerProfileId: created.id,
            approvedServiceCount: verifiedServices.length,
          },
        },
        request,
        transaction,
      );
      await this.notifications.notifyApproved(
        this.toEmailRecipient(application),
        transaction,
      );
      return created;
    });
    return {
      success: true,
      message: 'Đã duyệt hồ sơ và tạo tài khoản nhà cung cấp.',
      data: provider,
    };
  }

  private async assertPending(
    id: string,
    client: Prisma.TransactionClient,
    lockCatalog = false,
  ) {
    if (client !== this.prisma) await lockProviderApplication(client, id);
    if (lockCatalog) await lockProviderCatalog(client, id);
    const application = await client.providerApplication.findUnique({
      where: { id },
      include: {
        checks: true,
        documents: true,
        services: { include: { service: { include: { category: true } } } },
        termsAcceptances: true,
      },
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    }
    assertPendingApplication(application.status);
    return application;
  }

  private async updateDecision(
    id: string,
    status: ProviderApplicationStatus,
    reason: string,
    actorId: string,
    action: string,
    request: RequestMetadata,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const application = await this.assertPending(id, transaction);
      if (
        status === ProviderApplicationStatus.NEEDS_CHANGES &&
        ![
          ...application.checks,
          ...application.documents,
          ...application.services,
        ].some((item) => item.status === ReviewStatus.NEEDS_CHANGES)
      ) {
        throw new BadRequestException(
          'Phải đánh dấu ít nhất một hạng mục cần bổ sung trước.',
        );
      }
      const changed = await transaction.providerApplication.updateMany({
        where: { id, status: ProviderApplicationStatus.PENDING_REVIEW },
        data: {
          status,
          decisionReason: reason,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Hồ sơ vừa được xử lý bởi một kiểm duyệt viên khác.',
        );
      }
      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action,
          resourceType: 'ProviderApplication',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { status, reason },
        },
        request,
        transaction,
      );
      if (status === ProviderApplicationStatus.REJECTED)
        await this.notifications.notifyRejected(
          this.toEmailRecipient(application),
          reason,
          transaction,
        );
      else if (status === ProviderApplicationStatus.NEEDS_CHANGES)
        await this.notifications.notifyChangesRequested(
          this.toEmailRecipient(application),
          reason,
          transaction,
        );
    });
  }

  private async recordReview(
    action: string,
    applicationId: string,
    actorId: string,
    metadata: Record<string, string>,
    request: RequestMetadata,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.audit.record(
      {
        actorInternalAccountId: actorId,
        action,
        resourceType: 'ProviderApplication',
        resourceId: applicationId,
        result: 'SUCCESS',
        metadata,
      },
      request,
      transaction,
    );
  }

  private toEmailRecipient(application: {
    id: string;
    email: string | null;
    legalFullName: string | null;
    organizationName: string | null;
    providerType: ProviderType;
    revisionNumber: number;
  }) {
    return {
      applicationId: application.id,
      email: application.email,
      displayName:
        application.providerType === ProviderType.INDIVIDUAL
          ? application.legalFullName
          : application.organizationName,
      revisionNumber: application.revisionNumber,
    };
  }
}
