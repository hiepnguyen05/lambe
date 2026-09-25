import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { ARGON2_OPTIONS } from '../constants/password.constants';
import type { InternalLoginDto } from '../dto/internal-login.dto';
import {
  activeInternalAccountInclude,
  type InternalAccountWithAuth,
  toPublicInternalAccount,
} from './internal-account.model';
import { InternalTokenService } from './internal-token.service';

const INVALID_CREDENTIALS_MESSAGE =
  'Tên đăng nhập hoặc mật khẩu không chính xác.';

@Injectable()
export class InternalAuthenticationService {
  private readonly dummyPasswordHash = argon2.hash(
    randomBytes(32).toString('hex'),
    ARGON2_OPTIONS,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly tokenService: InternalTokenService,
  ) {}

  async login(dto: InternalLoginDto, request: RequestMetadata) {
    const normalizedUsername = dto.username.trim().toLowerCase();
    let account = await this.prisma.internalAccount.findUnique({
      where: { normalizedUsername },
      include: activeInternalAccountInclude,
    });

    const passwordHash =
      account?.credential?.passwordHash ?? (await this.dummyPasswordHash);
    const isPasswordValid = await argon2
      .verify(passwordHash, dto.password)
      .catch(() => false);

    if (!account) {
      await this.auditService.record(
        {
          action: 'INTERNAL_LOGIN',
          resourceType: 'InternalAccount',
          result: 'INVALID_CREDENTIALS',
          metadata: { normalizedUsername },
        },
        request,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    account = await this.unlockExpiredAccount(account);

    if (account.status !== 'ACTIVE' || !account.credential) {
      await this.auditLogin(account.id, 'ACCOUNT_UNAVAILABLE', request);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!isPasswordValid) {
      await this.registerFailedLogin(account, request);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (account.roles.length === 0) {
      await this.auditLogin(account.id, 'NO_ACTIVE_ROLE', request);
      throw new UnauthorizedException('Tài khoản nội bộ chưa được cấp quyền.');
    }

    const refreshToken = this.tokenService.createRefreshToken();
    const sessionId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.internalSession.create({
        data: {
          id: sessionId,
          accountId: account.id,
          refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          expiresAt: this.tokenService.getRefreshExpiry(),
        },
      });
      await transaction.internalAccount.update({
        where: { id: account.id },
        data: {
          status: 'ACTIVE',
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });
      await this.auditService.record(
        {
          actorInternalAccountId: account.id,
          action: 'INTERNAL_LOGIN',
          resourceType: 'InternalAccount',
          resourceId: account.id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
    });

    account.lastLoginAt = now;

    return {
      refreshToken,
      response: {
        success: true,
        message: 'Đăng nhập hệ thống quản trị thành công.',
        data: {
          accessToken: this.tokenService.generateAccessToken(
            account,
            sessionId,
          ),
          account: toPublicInternalAccount(account),
        },
      },
    };
  }

  async getCurrentAccount(accountId: string) {
    const account = await this.prisma.internalAccount.findUnique({
      where: { id: accountId },
      include: activeInternalAccountInclude,
    });

    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản nội bộ không hoạt động.');
    }

    return {
      success: true,
      data: { account: toPublicInternalAccount(account) },
    };
  }

  private async unlockExpiredAccount(
    account: InternalAccountWithAuth,
  ): Promise<InternalAccountWithAuth> {
    if (
      account.status !== 'LOCKED' ||
      !account.lockedUntil ||
      account.lockedUntil > new Date()
    ) {
      return account;
    }

    return this.prisma.internalAccount.update({
      where: { id: account.id },
      data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
      include: activeInternalAccountInclude,
    });
  }

  private async registerFailedLogin(
    account: InternalAccountWithAuth,
    request: RequestMetadata,
  ): Promise<void> {
    const maxFailedAttempts = this.configService.get<number>(
      'internalAuth.maxFailedAttempts',
      5,
    );
    const lockDurationMinutes = this.configService.get<number>(
      'internalAuth.lockDurationMinutes',
      15,
    );
    const failedLoginCount = account.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= maxFailedAttempts;

    await this.prisma.internalAccount.update({
      where: { id: account.id },
      data: {
        failedLoginCount,
        status: shouldLock ? 'LOCKED' : account.status,
        lockedUntil: shouldLock
          ? new Date(Date.now() + lockDurationMinutes * 60 * 1000)
          : account.lockedUntil,
      },
    });

    await this.auditLogin(
      account.id,
      shouldLock ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
      request,
    );
  }

  private async auditLogin(
    accountId: string,
    result: string,
    request: RequestMetadata,
  ): Promise<void> {
    await this.auditService.record(
      {
        actorInternalAccountId: accountId,
        action: 'INTERNAL_LOGIN',
        resourceType: 'InternalAccount',
        resourceId: accountId,
        result,
      },
      request,
    );
  }
}
