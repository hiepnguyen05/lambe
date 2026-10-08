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
  ReviewStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { CURRENT_PROVIDER_TERMS_VERSION } from '../../constants/provider-terms.constants';
import type { AcceptProviderTermsDto } from '../../dto/accept-provider-terms.dto';
import type { CreateProviderApplicationDto } from '../../dto/create-provider-application.dto';
import type { UpdateProviderApplicationDto } from '../../dto/update-provider-application.dto';
import {
  assertApplicationEditable,
  REQUIRED_REVIEW_SECTIONS,
  assertProviderSectionsEditable,
} from '../../domain/provider-application.policy';
import { applicantProviderApplicationSelect } from '../persistence/provider-application.select';
import { ProviderApplicationNotificationService } from '../notifications/provider-application-notification.service';
import { KycCryptoService } from '../kyc/kyc-crypto.service';
import {
  lockProviderApplication,
  lockProviderCatalog,
} from '../persistence/provider-application-lock';
import { claimProviderIdentity } from '../persistence/provider-identity-claim';
import { parseProviderBirthDate } from '../../domain/provider-birth-date.policy';
import { buildProviderSnapshot } from '../../domain/provider-snapshot';
import { assertProviderSubmissionComplete } from '../../domain/provider-submission.policy';

@Injectable()
export class ProviderApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kycCrypto: KycCryptoService,
    private readonly notifications: ProviderApplicationNotificationService,
  ) {}

  async create(userId: string, dto: CreateProviderApplicationDto) {
    try {
      const application = await this.prisma.$transaction(
        async (transaction) => {
          // Serialize against profile creation as well as concurrent application creation.
          const users = await transaction.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
          );
          if (!users.length)
            throw new NotFoundException('Không tìm thấy tài khoản.');
          const profile = await transaction.providerProfile.findUnique({
            where: { userId },
            select: { id: true },
          });
          if (profile)
            throw new ConflictException('Tài khoản đã là nhà cung cấp.');
          const existing = await transaction.providerApplication.findFirst({
            where: {
              userId,
              status: {
                in: [
                  ProviderApplicationStatus.DRAFT,
                  ProviderApplicationStatus.PENDING_REVIEW,
                  ProviderApplicationStatus.NEEDS_CHANGES,
                ],
              },
            },
            select: { id: true },
          });
          if (existing)
            throw new ConflictException(
              'Bạn đang có một hồ sơ đăng ký chưa kết thúc.',
            );
          return transaction.providerApplication.create({
            data: {
              userId,
              providerType: dto.providerType,
              checks: {
                create: REQUIRED_REVIEW_SECTIONS.map((section) => ({
                  section,
                })),
              },
            },
            select: applicantProviderApplicationSelect,
          });
        },
      );
      return {
        success: true,
        message: 'Đã tạo bản nháp đăng ký nhà cung cấp.',
        data: application,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bạn đang có một hồ sơ đăng ký chưa kết thúc.',
        );
      }
      throw error;
    }
  }

  async update(id: string, userId: string, dto: UpdateProviderApplicationDto) {
    const application = await this.findOwned(id, userId);
    assertApplicationEditable(application.status);
    const sections = this.profileSectionsFor(dto);
    if (!sections.length) {
      throw new BadRequestException('Không có dữ liệu hồ sơ cần cập nhật.');
    }
    assertProviderSectionsEditable(application, sections);
    const { birthDate, nationalIdNumber, ...fields } = dto;
    const parsedBirthDate = birthDate
      ? parseProviderBirthDate(birthDate)
      : null;
    const protectedNationalId = nationalIdNumber
      ? this.kycCrypto.protectNationalId(nationalIdNumber)
      : null;
    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        await lockProviderApplication(transaction, id, userId);
        const current = await this.findOwned(id, userId, transaction);
        assertApplicationEditable(current.status);
        assertProviderSectionsEditable(current, sections);
        if (protectedNationalId)
          await claimProviderIdentity(
            transaction,
            protectedNationalId.hash,
            userId,
          );
        const email = dto.email?.trim().toLowerCase() ?? null;
        await transaction.providerApplicationCheck.updateMany({
          where: { applicationId: id, section: { in: sections } },
          data: {
            status: ReviewStatus.PENDING,
            reviewNote: null,
            reviewedAt: null,
            reviewedById: null,
          },
        });
        const result = await transaction.providerApplication.update({
          where: { id },
          data: {
            ...fields,
            ...(dto.email !== undefined && { email }),
            ...(birthDate !== undefined && {
              birthDate: parsedBirthDate,
            }),
            ...(nationalIdNumber !== undefined && {
              nationalIdNumber: null,
              nationalIdEncrypted: protectedNationalId?.encrypted ?? null,
              nationalIdHash: protectedNationalId?.hash ?? null,
              nationalIdLast4: protectedNationalId?.last4 ?? null,
            }),
          },
          select: applicantProviderApplicationSelect,
        });
        return result;
      });
      return {
        success: true,
        message: 'Đã lưu thông tin hồ sơ.',
        data: updated,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Số CCCD này đã được sử dụng trong một hồ sơ khác.',
        );
      }
      throw error;
    }
  }

  async acceptTerms(
    id: string,
    userId: string,
    _dto: AcceptProviderTermsDto,
    request: { ipAddress?: string; userAgent?: string },
  ) {
    const application = await this.findOwned(id, userId);
    assertApplicationEditable(application.status);
    assertProviderSectionsEditable(application, [
      ProviderApplicationSection.TERMS,
    ]);
    const acceptance = await this.prisma.$transaction(async (transaction) => {
      await lockProviderApplication(transaction, id, userId);
      const current = await this.findOwned(id, userId, transaction);
      assertApplicationEditable(current.status);
      assertProviderSectionsEditable(current, [
        ProviderApplicationSection.TERMS,
      ]);
      return transaction.providerApplicationTermsAcceptance.upsert({
        where: {
          applicationId_termsVersion: {
            applicationId: id,
            termsVersion: CURRENT_PROVIDER_TERMS_VERSION,
          },
        },
        create: {
          applicationId: id,
          termsVersion: CURRENT_PROVIDER_TERMS_VERSION,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
        update: {
          acceptedAt: new Date(),
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
      });
    });
    return {
      success: true,
      message: 'Đã ghi nhận chấp thuận điều khoản.',
      data: acceptance,
    };
  }

  async submit(id: string, userId: string) {
    const nextRevision = await this.prisma.$transaction(async (transaction) => {
      await lockProviderApplication(transaction, id, userId);
      await lockProviderCatalog(transaction, id);
      const application = await transaction.providerApplication.findFirst({
        where: { id, userId },
        include: {
          documents: true,
          services: { include: { service: { include: { category: true } } } },
          serviceSuggestions: true,
          termsAcceptances: true,
          checks: true,
        },
      });
      if (!application) {
        throw new NotFoundException(
          'Không tìm thấy hồ sơ đăng ký nhà cung cấp.',
        );
      }
      assertApplicationEditable(application.status);
      assertProviderSubmissionComplete(application);
      if (application.nationalIdHash)
        await claimProviderIdentity(
          transaction,
          application.nationalIdHash,
          userId,
        );

      const nextRevision = application.revisionNumber + 1;
      const snapshot = buildProviderSnapshot(application);
      const result = await transaction.providerApplication.updateMany({
        where: { id, userId, status: application.status },
        data: {
          status: ProviderApplicationStatus.PENDING_REVIEW,
          revisionNumber: nextRevision,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          decisionReason: null,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Hồ sơ vừa được cập nhật. Vui lòng tải lại và thử lại.',
        );
      }
      await transaction.providerApplicationRevision.create({
        data: { applicationId: id, revisionNumber: nextRevision, snapshot },
      });
      await transaction.providerApplicationCheck.updateMany({
        where: { applicationId: id, status: ReviewStatus.NEEDS_CHANGES },
        data: {
          status: ReviewStatus.PENDING,
          reviewNote: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      await transaction.providerApplicationDocument.updateMany({
        where: { applicationId: id, status: ReviewStatus.NEEDS_CHANGES },
        data: {
          status: ReviewStatus.PENDING,
          reviewNote: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      await transaction.providerApplicationService.updateMany({
        where: { applicationId: id, status: ReviewStatus.NEEDS_CHANGES },
        data: {
          status: ReviewStatus.PENDING,
          reviewNote: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      await this.notifications.notifySubmitted(
        {
          applicationId: id,
          email: application.email,
          displayName:
            application.providerType === 'INDIVIDUAL'
              ? application.legalFullName
              : application.organizationName,
          revisionNumber: nextRevision,
        },
        transaction,
      );
      return nextRevision;
    });
    await this.notifications.flushPending('provider-application-submit');
    return {
      success: true,
      message: 'Hồ sơ đã được gửi để xét duyệt.',
      data: {
        id,
        status: ProviderApplicationStatus.PENDING_REVIEW,
        nextRevision,
      },
    };
  }

  async withdraw(id: string, userId: string) {
    const application = await this.findOwned(id, userId);
    if (
      application.status !== ProviderApplicationStatus.DRAFT &&
      application.status !== ProviderApplicationStatus.NEEDS_CHANGES
    ) {
      throw new ConflictException(
        'Chỉ có thể rút hồ sơ nháp hoặc hồ sơ đang chờ bổ sung.',
      );
    }
    const changed = await this.prisma.providerApplication.updateMany({
      where: { id, userId, status: application.status },
      data: {
        status: ProviderApplicationStatus.WITHDRAWN,
        withdrawnAt: new Date(),
      },
    });
    if (changed.count !== 1)
      throw new ConflictException('Hồ sơ vừa được xử lý. Vui lòng tải lại.');
    return { success: true, message: 'Đã rút hồ sơ đăng ký.' };
  }

  private async findOwned(
    id: string,
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const application = await client.providerApplication.findFirst({
      where: { id, userId },
      include: { checks: true },
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    }
    return application;
  }

  private profileSectionsFor(
    dto: UpdateProviderApplicationDto,
  ): ProviderApplicationSection[] {
    const identityFields: (keyof UpdateProviderApplicationDto)[] = [
      'legalFullName',
      'birthDate',
      'gender',
      'email',
      'nationalIdNumber',
      'organizationName',
      'taxCode',
      'businessRegistrationNumber',
      'registeredAddress',
      'representativeName',
    ];
    const expertiseFields: (keyof UpdateProviderApplicationDto)[] = [
      'biography',
      'experienceYears',
    ];
    const sections: ProviderApplicationSection[] = [];
    if (identityFields.some((field) => dto[field] !== undefined)) {
      sections.push(ProviderApplicationSection.IDENTITY);
    }
    if (expertiseFields.some((field) => dto[field] !== undefined)) {
      sections.push(ProviderApplicationSection.EXPERTISE);
    }
    return sections;
  }
}
