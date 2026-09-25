import * as argon2 from 'argon2';
import { InternalAuthenticationService } from '../application/internal-authentication.service';
import { InternalSessionService } from '../application/internal-session.service';
import { InternalTokenService } from '../application/internal-token.service';
import { ARGON2_OPTIONS } from '../constants/password.constants';

export const INTERNAL_TEST_PASSWORD = 'A-strong-admin-password-2026';

let passwordHash = '';

export async function initializeInternalAuthFixture(): Promise<void> {
  passwordHash = await argon2.hash(INTERNAL_TEST_PASSWORD, ARGON2_OPTIONS);
}

export function createInternalAccount() {
  if (!passwordHash) {
    throw new Error('Call initializeInternalAuthFixture before creating data.');
  }

  return {
    id: 'account-id',
    username: 'admin',
    normalizedUsername: 'admin',
    fullName: 'System Admin',
    email: 'admin@lambe.test',
    status: 'ACTIVE' as const,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: new Date(),
    tokenVersion: 0,
    createdById: null,
    disabledById: null,
    disabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    credential: {
      id: 'credential-id',
      accountId: 'account-id',
      passwordHash,
      hashAlgorithm: 'argon2id',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    roles: [
      {
        id: 'role-id',
        accountId: 'account-id',
        role: 'ADMIN' as const,
        assignedById: null,
        assignedAt: new Date(),
        revokedById: null,
        revokedAt: null,
        revokeReason: null,
      },
    ],
  };
}

export function createInternalAuthTestContext() {
  const prisma = {
    internalAccount: {
      findUnique: jest.fn((input: unknown): Promise<unknown> => {
        void input;
        return Promise.resolve(null);
      }),
      update: jest.fn((input: unknown): Promise<unknown> => {
        void input;
        return Promise.resolve({});
      }),
    },
    internalSession: {
      create: jest.fn((input: unknown): Promise<unknown> => {
        void input;
        return Promise.resolve({});
      }),
      findUnique: jest.fn((input: unknown): Promise<unknown> => {
        void input;
        return Promise.resolve(null);
      }),
      update: jest.fn((input: unknown): Promise<unknown> => {
        void input;
        return Promise.resolve({});
      }),
      updateMany: jest.fn((input: unknown): Promise<{ count: number }> => {
        void input;
        return Promise.resolve({ count: 1 });
      }),
    },
    auditLog: {
      create: jest.fn((input: unknown): Promise<unknown> => {
        void input;
        return Promise.resolve({});
      }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (
      input: Promise<unknown>[] | ((client: typeof prisma) => Promise<unknown>),
    ) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prisma);
    },
  );
  const jwtService = {
    sign: jest.fn().mockReturnValue('internal-access-token'),
  };
  const config = new Map<string, unknown>([
    ['internalAuth.accessTokenExpiresIn', '15m'],
    ['internalAuth.refreshTokenExpiresDays', 7],
    ['internalAuth.maxFailedAttempts', 5],
    ['internalAuth.lockDurationMinutes', 15],
  ]);
  const configService = {
    get: jest.fn((key: string, defaultValue: unknown) =>
      config.has(key) ? config.get(key) : defaultValue,
    ),
  };
  const auditService = {
    record: jest.fn((event: object, request: object = {}): Promise<void> => {
      void prisma.auditLog.create({ data: { ...event, ...request } });
      return Promise.resolve();
    }),
  };
  const tokenService = new InternalTokenService(
    jwtService as never,
    configService as never,
  );

  return {
    authenticationService: new InternalAuthenticationService(
      prisma as never,
      configService as never,
      auditService as never,
      tokenService,
    ),
    sessionService: new InternalSessionService(
      prisma as never,
      auditService as never,
      tokenService,
    ),
    prisma,
    jwtService,
  };
}
