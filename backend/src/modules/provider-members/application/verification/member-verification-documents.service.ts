import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
import type { AuthenticatedInternalAccount } from '../../../internal-auth/types/authenticated-internal-account.type';
import type { ProviderMemberDocumentQueryDto } from '../../dto/provider-member-verification.dto';
import { MEMBER_IDENTITY_DOCUMENTS } from '../../domain/member-verification.policy';
import { assertMemberKycReviewer } from '../../domain/member-review-access.policy';
import {
  assertMemberCanVerify,
  assertVerificationEditable,
  currentVerification,
  lockVerificationMember,
  safeMemberDocumentSelect,
} from './member-verification.persistence';

@Injectable()
export class MemberVerificationDocumentsService {
  private readonly logger = new Logger(MemberVerificationDocumentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly media: MediaStorage,
  ) {}

  async upload(
    userId: string,
    memberId: string,
    query: ProviderMemberDocumentQueryDto,
    buffer: Buffer,
    request: RequestMetadata,
  ) {
    const prepared = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId, userId);
      assertMemberCanVerify(member);
      const profile = await currentVerification(tx, member);
      await this.assertUploadAllowed(tx, profile, query);
      return {
        profileId: profile.id,
        membershipVersion: member.membershipVersion,
      };
    });
    const uploaded = await this.media.uploadPrivateImage(
      buffer,
      `lambe/provider-members/${memberId}/verifications/${prepared.profileId}`,
    );
    try {
      if (
        uploaded.deliveryType !== 'authenticated' ||
        !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uploaded.format)
      )
        throw new ConflictException(
          'Giấy tờ phải là ảnh raster được lưu trữ riêng tư.',
        );
      const data = await this.prisma.$transaction(async (tx) => {
        const member = await lockVerificationMember(tx, memberId, userId);
        assertMemberCanVerify(member);
        if (member.membershipVersion !== prepared.membershipVersion)
          throw new ConflictException(
            'Lần gia nhập tổ chức đã thay đổi trong lúc tải ảnh.',
          );
        const profile = await currentVerification(tx, member);
        const previous = await this.assertUploadAllowed(tx, profile, query);
        if (previous)
          await tx.providerMemberDocument.update({
            where: { id: previous.id },
            data: { supersededAt: new Date() },
          });
        const document = await tx.providerMemberDocument.create({
          data: {
            verificationId: profile.id,
            type: query.type,
            providerServiceId: query.providerServiceId,
            publicId: uploaded.publicId,
            fileFormat: uploaded.format,
            deliveryType: 'authenticated',
            expiresAt: query.expiresAt ? new Date(query.expiresAt) : null,
          },
          select: safeMemberDocumentSelect,
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'PROVIDER_MEMBER_DOCUMENT_UPLOADED',
            resourceType: 'ProviderMemberDocument',
            resourceId: document.id,
            result: 'SUCCESS',
            metadata: {
              memberId,
              verificationId: profile.id,
              type: query.type,
            },
          },
          request,
          tx,
        );
        return document;
      });
      return { success: true, data };
    } catch (error) {
      try {
        await this.media.deleteImage(uploaded.publicId, uploaded.deliveryType);
      } catch {
        this.logger.warn(
          'Could not clean up an uncommitted member verification upload.',
        );
      }
      throw error;
    }
  }

  async remove(
    userId: string,
    memberId: string,
    documentId: string,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId, userId);
      assertMemberCanVerify(member);
      const profile = await currentVerification(tx, member);
      assertVerificationEditable(profile);
      const document = profile.documents.find((d) => d.id === documentId);
      if (!document)
        throw new NotFoundException('Không tìm thấy tài liệu hiện hành.');
      if (profile.status === 'NEEDS_CHANGES' && document.status === 'VERIFIED')
        throw new ConflictException(
          'Tài liệu đã xác minh không nằm trong yêu cầu bổ sung.',
        );
      await tx.providerMemberDocument.update({
        where: { id: documentId },
        data: { supersededAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_DOCUMENT_REMOVED',
          resourceType: 'ProviderMemberDocument',
          resourceId: documentId,
          result: 'SUCCESS',
          metadata: { memberId },
        },
        request,
        tx,
      );
    });
    return { success: true, data: null };
  }

  async access(
    memberId: string,
    documentId: string,
    actor: { userId: string } | { internal: AuthenticatedInternalAccount },
    request: RequestMetadata,
  ) {
    if ('internal' in actor) assertMemberKycReviewer(actor.internal.roles);
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(
        tx,
        memberId,
        'userId' in actor ? actor.userId : undefined,
      );
      const profile = await currentVerification(tx, member);
      const document = profile.documents.find((d) => d.id === documentId);
      if (!document)
        throw new NotFoundException('Không tìm thấy tài liệu hiện hành.');
      if (document.deliveryType !== 'authenticated')
        throw new ConflictException(
          'Tài liệu không đáp ứng chế độ lưu trữ riêng tư.',
        );
      await this.audit.record(
        {
          ...('userId' in actor
            ? { actorUserId: actor.userId }
            : { actorInternalAccountId: actor.internal.accountId }),
          action: 'PROVIDER_MEMBER_KYC_DOCUMENT_ACCESSED',
          resourceType: 'ProviderMemberDocument',
          resourceId: documentId,
          result: 'SUCCESS',
          metadata: { memberId },
        },
        request,
        tx,
      );
      return {
        url: this.media.createPrivateDownloadUrl(
          document.publicId,
          document.fileFormat,
        ),
        fileFormat: document.fileFormat,
      };
    });
    return { success: true, data };
  }

  private async assertUploadAllowed(
    tx: Prisma.TransactionClient,
    profile: Awaited<ReturnType<typeof currentVerification>>,
    query: ProviderMemberDocumentQueryDto,
  ) {
    assertVerificationEditable(profile);
    const isEvidence = ['PROFESSIONAL_CERTIFICATE', 'PORTFOLIO'].includes(
      query.type,
    );
    if (
      (query.type === 'PROFESSIONAL_CERTIFICATE' && !query.providerServiceId) ||
      (!isEvidence && query.providerServiceId) ||
      (query.expiresAt && query.type !== 'PROFESSIONAL_CERTIFICATE')
    )
      throw new BadRequestException(
        'Loại tài liệu không phù hợp với dịch vụ hoặc thời hạn đã gửi.',
      );
    if (
      query.providerServiceId &&
      !profile.requestedProviderServiceIds.includes(query.providerServiceId)
    )
      throw new BadRequestException(
        'Tài liệu phải gắn dịch vụ đã chọn trong hồ sơ.',
      );
    if (query.expiresAt && new Date(query.expiresAt) <= new Date())
      throw new BadRequestException('Chứng chỉ đã hết hạn.');
    const previous = query.replacesDocumentId
      ? profile.documents.find((d) => d.id === query.replacesDocumentId)
      : MEMBER_IDENTITY_DOCUMENTS.includes(query.type)
        ? profile.documents.find((d) => d.type === query.type)
        : undefined;
    if (query.replacesDocumentId && !previous)
      throw new NotFoundException('Không tìm thấy tài liệu cần thay thế.');
    if (
      previous &&
      (previous.type !== query.type ||
        previous.providerServiceId !== (query.providerServiceId ?? null))
    )
      throw new BadRequestException(
        'Tài liệu thay thế phải cùng loại và dịch vụ.',
      );
    if (
      previous &&
      profile.status === 'NEEDS_CHANGES' &&
      previous.status === 'VERIFIED'
    )
      throw new ConflictException(
        'Tài liệu đã xác minh không nằm trong yêu cầu bổ sung.',
      );
    if (!previous && profile.documents.length >= 40)
      throw new BadRequestException('Hồ sơ tối đa 40 ảnh hiện hành.');
    const total = await tx.providerMemberDocument.count({
      where: { verificationId: profile.id },
    });
    if (total >= 120)
      throw new BadRequestException(
        'Vượt số lần tải tài liệu; vui lòng liên hệ hỗ trợ.',
      );
    return previous;
  }
}
