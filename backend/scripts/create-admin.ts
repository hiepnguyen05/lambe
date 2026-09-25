import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ARGON2_OPTIONS,
  MAX_INTERNAL_PASSWORD_LENGTH,
  MIN_INTERNAL_PASSWORD_LENGTH,
} from '../src/modules/internal-auth/constants/password.constants';

const prisma = new PrismaClient();

function getArgument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const username = getArgument('username')?.trim();
  const fullName = getArgument('name')?.trim();
  const email = getArgument('email')?.trim().toLowerCase() || undefined;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    throw new Error(
      'Username phải dài 3-64 ký tự và chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.',
    );
  }

  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    throw new Error('Họ tên admin phải dài từ 2 đến 100 ký tự.');
  }

  if (
    !password ||
    password.length < MIN_INTERNAL_PASSWORD_LENGTH ||
    password.length > MAX_INTERNAL_PASSWORD_LENGTH
  ) {
    throw new Error(
      `ADMIN_PASSWORD phải dài ${MIN_INTERNAL_PASSWORD_LENGTH}-${MAX_INTERNAL_PASSWORD_LENGTH} ký tự.`,
    );
  }

  const normalizedUsername = username.toLowerCase();
  const existingAccount = await prisma.internalAccount.findUnique({
    where: { normalizedUsername },
    select: { id: true },
  });

  if (existingAccount) {
    throw new Error('Username đã tồn tại trong hệ thống nội bộ.');
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  const account = await prisma.internalAccount.create({
    data: {
      username,
      normalizedUsername,
      fullName,
      email,
      status: 'ACTIVE',
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      credential: {
        create: { passwordHash },
      },
      roles: {
        create: { role: 'ADMIN' },
      },
    },
    select: { id: true, username: true },
  });

  await prisma.auditLog.create({
    data: {
      actorInternalAccountId: account.id,
      action: 'BOOTSTRAP_ADMIN_CREATED',
      resourceType: 'InternalAccount',
      resourceId: account.id,
      result: 'SUCCESS',
    },
  });

  console.log(`Đã tạo admin: ${account.username} (${account.id})`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Không thể tạo admin: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
