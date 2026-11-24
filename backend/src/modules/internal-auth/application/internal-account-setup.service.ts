import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { MailOutboxService } from '../../../infrastructure/mail/mail-outbox.service';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { ARGON2_OPTIONS } from '../constants/password.constants';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class InternalAccountSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly outbox: MailOutboxService,
    private readonly audit: AuditService,
  ) {}

  ensureMailAvailable(): void {
    if (!this.mail.isEnabled()) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình gửi email cho tài khoản nội bộ.',
      );
    }
  }

  async issue(
    account: { id: string; email: string; status: string },
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    this.ensureMailAvailable();
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(
      Date.now() + (account.status === 'INVITED' ? 24 : 1) * 60 * 60 * 1000,
    );
    await transaction.internalSetupToken.updateMany({
      where: { accountId: account.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const record = await transaction.internalSetupToken.create({
      data: { accountId: account.id, tokenHash: hashToken(token), expiresAt },
    });
    const text = `Ma thiet lap mat khau tai khoan noi bo Lambe: ${token}\nSu dung POST /api/admin/auth/activate voi token va mat khau moi. Ma het han luc ${expiresAt.toISOString()}. Neu ban khong yeu cau, hay bo qua email nay.`;
    await this.outbox.enqueue(
      {
        to: account.email,
        subject: 'Thiet lap mat khau tai khoan noi bo Lambe',
        text,
        html: `<p>Ma thiet lap mat khau tai khoan noi bo Lambe:</p><p><code>${token}</code></p><p>Ma het han luc ${expiresAt.toISOString()}. Neu ban khong yeu cau, hay bo qua email nay.</p>`,
      },
      `internal-setup:${record.id}`,
      transaction,
      expiresAt,
    );
  }

  async activate(token: string, password: string, request: RequestMetadata) {
    const tokenHash = hashToken(token);
    const pending = await this.prisma.internalSetupToken.findUnique({
      where: { tokenHash },
      select: {
        consumedAt: true,
        expiresAt: true,
        account: { select: { status: true } },
      },
    });
    if (
      !pending ||
      pending.consumedAt ||
      pending.expiresAt <= new Date() ||
      !['INVITED', 'ACTIVE'].includes(pending.account.status)
    ) {
      throw new UnauthorizedException(
        'Ma thiet lap mat khau khong hop le hoac da het han.',
      );
    }
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    return this.prisma.$transaction(
      async (tx) => {
        const record = await tx.internalSetupToken.findUnique({
          where: { tokenHash },
          include: { account: true },
        });
        if (
          !record ||
          record.consumedAt ||
          record.expiresAt <= new Date() ||
          !['INVITED', 'ACTIVE'].includes(record.account.status)
        ) {
          throw new UnauthorizedException(
            'Ma thiet lap mat khau khong hop le hoac da het han.',
          );
        }
        const consumed = await tx.internalSetupToken.updateMany({
          where: {
            id: record.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        });
        if (consumed.count !== 1)
          throw new ConflictException('Ma da duoc su dung.');
        await tx.internalCredential.upsert({
          where: { accountId: record.accountId },
          create: { accountId: record.accountId, passwordHash },
          update: { passwordHash },
        });
        const activated = await tx.internalAccount.updateMany({
          where: {
            id: record.accountId,
            status: { in: ['INVITED', 'ACTIVE'] },
          },
          data: {
            status: 'ACTIVE',
            mustChangePassword: false,
            passwordChangedAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
            tokenVersion: { increment: 1 },
          },
        });
        if (activated.count !== 1) {
          throw new UnauthorizedException(
            'Tai khoan khong con duoc kich hoat.',
          );
        }
        await tx.internalSession.updateMany({
          where: { accountId: record.accountId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' },
        });
        await this.audit.record(
          {
            actorInternalAccountId: record.accountId,
            action: 'INTERNAL_PASSWORD_SETUP',
            resourceType: 'InternalAccount',
            resourceId: record.accountId,
            result: 'SUCCESS',
          },
          request,
          tx,
        );
        return {
          success: true,
          message: 'Mat khau da duoc thiet lap. Vui long dang nhap.',
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async changePassword(
    actor: AuthenticatedInternalAccount,
    currentPassword: string,
    newPassword: string,
    request: RequestMetadata,
  ) {
    const account = await this.prisma.internalAccount.findUnique({
      where: { id: actor.accountId },
      include: { credential: true },
    });
    if (
      !account?.credential ||
      account.status !== 'ACTIVE' ||
      !(await argon2
        .verify(account.credential.passwordHash, currentPassword)
        .catch(() => false))
    ) {
      throw new UnauthorizedException('Mat khau hien tai khong dung.');
    }
    if (currentPassword === newPassword)
      throw new BadRequestException(
        'Mat khau moi phai khac mat khau hien tai.',
      );
    const currentHash = account.credential.passwordHash;
    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    await this.prisma.$transaction(
      async (tx) => {
        const credential = await tx.internalCredential.updateMany({
          where: { accountId: actor.accountId, passwordHash: currentHash },
          data: { passwordHash },
        });
        if (credential.count !== 1)
          throw new ConflictException('Mat khau da duoc thay doi.');
        const updated = await tx.internalAccount.updateMany({
          where: {
            id: actor.accountId,
            status: 'ACTIVE',
            tokenVersion: account.tokenVersion,
          },
          data: {
            passwordChangedAt: new Date(),
            mustChangePassword: false,
            tokenVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Trang thai tai khoan da thay doi.');
        await tx.internalSession.updateMany({
          where: { accountId: actor.accountId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' },
        });
        await this.audit.record(
          {
            actorInternalAccountId: actor.accountId,
            action: 'INTERNAL_PASSWORD_CHANGED',
            resourceType: 'InternalAccount',
            resourceId: actor.accountId,
            result: 'SUCCESS',
          },
          request,
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      success: true,
      message: 'Mat khau da doi. Vui long dang nhap lai.',
    };
  }
}
