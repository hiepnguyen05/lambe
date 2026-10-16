import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { normalizeVietnamesePhone } from '../../../common/utils/phone.util';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { CheckFirebasePhoneLinkDto } from '../dto/check-firebase-phone-link.dto';
import type { ExchangeFirebaseTokenDto } from '../dto/exchange-firebase-token.dto';
import {
  FIREBASE_IDENTITY_VERIFIER,
  type FirebaseIdentityVerifier,
} from './firebase-identity-verifier.port';
import { toPublicUser } from './user.model';
import { UserTokenService } from './user-token.service';
import { UserSessionService } from './user-session.service';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';

@Injectable()
export class FirebaseAuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIREBASE_IDENTITY_VERIFIER)
    private readonly firebaseIdentityVerifier: FirebaseIdentityVerifier,
    private readonly tokenService: UserTokenService,
    private readonly sessions: UserSessionService,
  ) {}

  async exchangeIdToken(
    dto: ExchangeFirebaseTokenDto,
    request: RequestMetadata = {},
  ) {
    const identity = await this.firebaseIdentityVerifier.verifyIdToken(
      dto.idToken,
    );

    if (!identity.phoneNumber) {
      return {
        success: true,
        message:
          'Vui lòng xác minh số điện thoại để liên kết với tài khoản Lambe.',
        data: {
          requiresPhoneVerification: true as const,
          provider: identity.signInProvider,
          email: identity.email ?? null,
          suggestedFullName: identity.displayName ?? null,
        },
      };
    }

    const phone = normalizeVietnamesePhone(identity.phoneNumber);
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      include: { roles: true, customerProfile: true },
    });

    if (existingUser) {
      if (existingUser.status !== 'ACTIVE') {
        throw new ForbiddenException('Tài khoản hiện không hoạt động.');
      }

      const linkedUser = await this.linkFirebaseIdentity(
        existingUser,
        identity.uid,
      );
      const customerProfile = await this.prisma.customerProfile.upsert({
        where: { userId: linkedUser.id },
        update: {},
        create: { userId: linkedUser.id },
        select: { onboardingStatus: true },
      });
      const session = await this.sessions.create(linkedUser.id, phone, request);

      return {
        success: true,
        message: 'Đăng nhập thành công.',
        data: {
          requiresPhoneVerification: false as const,
          isNewUser: false as const,
          ...session,
          user: toPublicUser({ ...linkedUser, customerProfile }),
        },
      };
    }

    return {
      success: true,
      message: 'Xác thực số điện thoại thành công. Vui lòng hoàn tất đăng ký.',
      data: {
        requiresPhoneVerification: false as const,
        isNewUser: true as const,
        phone,
        registrationToken: this.tokenService.generateRegistrationToken(
          phone,
          identity.uid,
        ),
      },
    };
  }

  async checkPhoneLink(dto: CheckFirebasePhoneLinkDto) {
    const identity = await this.firebaseIdentityVerifier.verifyIdToken(
      dto.idToken,
    );

    if (identity.phoneNumber) {
      throw new ForbiddenException(
        'Tài khoản xác thực này đã có số điện thoại liên kết.',
      );
    }

    return {
      success: true,
      message: 'Yêu cầu liên kết số điện thoại đã được tiếp nhận.',
      data: {
        verificationRequired: true,
      },
    };
  }

  private async linkFirebaseIdentity<
    T extends { id: string; firebaseUid?: string | null },
  >(user: T, firebaseUid: string): Promise<T> {
    if (user.firebaseUid === firebaseUid) return user;

    if (user.firebaseUid) {
      throw new UnauthorizedException(
        'Số điện thoại không khớp với danh tính xác thực đã liên kết.',
      );
    }

    const linkResult = await this.prisma.user.updateMany({
      where: { id: user.id, firebaseUid: null },
      data: { firebaseUid },
    });

    if (linkResult.count === 0) {
      throw new UnauthorizedException(
        'Không thể liên kết danh tính xác thực với tài khoản.',
      );
    }

    return { ...user, firebaseUid };
  }
}
