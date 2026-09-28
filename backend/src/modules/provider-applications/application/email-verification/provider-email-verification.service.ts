import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { MailService } from '../../../../infrastructure/mail/mail.service';
import { MailOutboxService } from '../../../../infrastructure/mail/mail-outbox.service';
import { KycCryptoService } from '../kyc/kyc-crypto.service';
import { lockProviderApplication } from '../persistence/provider-application-lock';
import { assertProviderEmailVerifiable } from '../../domain/provider-email.policy';

@Injectable()
export class ProviderEmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: KycCryptoService,
    private readonly outbox: MailOutboxService,
    private readonly mail: MailService,
  ) {}

  async requestCode(applicationId: string, userId: string) {
    if (!this.mail.isEnabled())
      throw new ServiceUnavailableException('Dịch vụ gửi email chưa sẵn sàng.');
    await this.prisma.$transaction(async (transaction) => {
      await lockProviderApplication(transaction, applicationId, userId);
      const application = await transaction.providerApplication.findFirst({
        where: { id: applicationId, userId },
      });
      if (!application) throw new NotFoundException('Không tìm thấy hồ sơ.');
      assertProviderEmailVerifiable(application.status);
      if (!application.email)
        throw new BadRequestException('Hãy cung cấp email trước.');
      if (application.emailVerifiedAt)
        throw new ConflictException('Email đã được xác minh.');
      const previous =
        await transaction.providerApplicationEmailVerification.findUnique({
          where: { applicationId },
        });
      if (previous && Date.now() - previous.requestedAt.getTime() < 60_000)
        throw new ConflictException(
          'Vui lòng đợi 60 giây trước khi yêu cầu mã mới.',
        );
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const nonce = randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const data = {
        email: application.email,
        nonce,
        codeHash: this.crypto.hashEmailVerification(
          applicationId,
          application.email,
          nonce,
          code,
        ),
        attempts: 0,
        expiresAt,
        requestedAt: new Date(),
      };
      await transaction.providerApplicationEmailVerification.upsert({
        where: { applicationId },
        create: { applicationId, ...data },
        update: data,
      });
      await transaction.mailOutbox.updateMany({
        where: {
          deduplicationKey: { startsWith: `provider-email:${applicationId}:` },
          sentAt: null,
        },
        data: { failedAt: new Date(), text: '', html: '' },
      });
      await this.outbox.enqueue(
        {
          to: application.email,
          subject: 'Xác minh email đăng ký đối tác Lambe',
          text: `Mã xác minh email của bạn là ${code}. Mã có hiệu lực 10 phút. Không chia sẻ mã này.`,
          html: `<p>Mã xác minh email: <strong>${code}</strong></p><p>Mã có hiệu lực 10 phút. Không chia sẻ mã này.</p>`,
        },
        `provider-email:${applicationId}:${nonce}`,
        transaction,
        expiresAt,
      );
    });
    return {
      success: true,
      message: 'Đã tiếp nhận yêu cầu gửi mã xác minh email.',
    };
  }

  async confirmCode(applicationId: string, userId: string, code: string) {
    const valid = await this.prisma.$transaction(async (transaction) => {
      await lockProviderApplication(transaction, applicationId, userId);
      const application = await transaction.providerApplication.findFirst({
        where: { id: applicationId, userId },
      });
      if (!application) throw new NotFoundException('Không tìm thấy hồ sơ.');
      assertProviderEmailVerifiable(application.status);
      const verification =
        await transaction.providerApplicationEmailVerification.findUnique({
          where: { applicationId },
        });
      if (
        !verification ||
        verification.email !== application.email ||
        verification.expiresAt <= new Date() ||
        verification.attempts >= 5
      )
        return false;
      const actual = Buffer.from(
        this.crypto.hashEmailVerification(
          applicationId,
          verification.email,
          verification.nonce,
          code,
        ),
        'hex',
      );
      const expected = Buffer.from(verification.codeHash, 'hex');
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(actual, expected)
      ) {
        // Commit failed attempts before returning an error; throwing here would roll them back.
        await transaction.providerApplicationEmailVerification.update({
          where: { applicationId },
          data: { attempts: { increment: 1 } },
        });
        return false;
      }
      await transaction.providerApplication.update({
        where: { id: applicationId },
        data: { emailVerifiedAt: new Date() },
      });
      await transaction.providerApplicationEmailVerification.delete({
        where: { applicationId },
      });
      return true;
    });
    if (!valid)
      throw new BadRequestException(
        'Mã xác minh không hợp lệ hoặc đã hết hạn.',
      );
    return { success: true, message: 'Email đã được xác minh.' };
  }
}
