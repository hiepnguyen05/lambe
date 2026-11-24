import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/infrastructure/persistence/postgres/prisma.service';

export async function memberTestUser(prisma: PrismaService, jwt: JwtService) {
  const user = await prisma.user.create({
    data: {
      phone: `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`,
      fullName: `Member test ${randomUUID()}`,
      roles: { create: { role: 'CUSTOMER' } },
    },
  });
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return {
    ...user,
    token: jwt.sign({
      sub: user.id,
      phone: user.phone,
      sessionId: session.id,
      purpose: 'access',
    }),
  };
}

export async function memberTestOrganization(
  prisma: PrismaService,
  jwt: JwtService,
  individual = false,
) {
  const owner = await memberTestUser(prisma, jwt);
  const application = await prisma.providerApplication.create({
    data: {
      userId: owner.id,
      providerType: individual ? 'INDIVIDUAL' : 'ORGANIZATION',
      status: 'APPROVED',
    },
  });
  const provider = await prisma.providerProfile.create({
    data: {
      userId: owner.id,
      sourceApplicationId: application.id,
      providerType: application.providerType,
      displayName: 'Test organization',
      status: 'ACTIVE',
      wallet: { create: {} },
      members: {
        create: {
          userId: owner.id,
          role: 'OWNER',
          status: 'ACTIVE',
          canProvideServices: individual,
        },
      },
    },
  });
  return { owner, provider };
}
