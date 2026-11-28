import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InternalAccountStatus, InternalRole, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type {
  CreateInternalAccountDto,
  InternalAccountQueryDto,
  UpdateInternalAccountDto,
} from '../dto/internal-account.dto';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';
import { InternalAccountSetupService } from './internal-account-setup.service';

const accountSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { where: { revokedAt: null }, select: { role: true } },
} satisfies Prisma.InternalAccountSelect;

const view = (
  account: Prisma.InternalAccountGetPayload<{ select: typeof accountSelect }>,
) => ({
  ...account,
  roles: account.roles.map((entry) => entry.role),
});

@Injectable()
export class InternalAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly setup: InternalAccountSetupService,
  ) {}

  async list(query: InternalAccountQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.InternalAccountWhereInput = {
      status: query.status,
      OR: search
        ? [
            { username: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.internalAccount.findMany({
        where,
        select: accountSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.internalAccount.count({ where }),
    ]);
    return {
      success: true,
      data: rows.map(view),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(id: string) {
    const account = await this.prisma.internalAccount.findUnique({
      where: { id },
      select: accountSelect,
    });
    if (!account)
      throw new NotFoundException('Khong tim thay tai khoan noi bo.');
    return { success: true, data: view(account) };
  }

  async create(
    dto: CreateInternalAccountDto,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    this.setup.ensureMailAvailable();
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const account = await tx.internalAccount.create({
          data: {
            username: dto.username.trim(),
            normalizedUsername: dto.username.trim().toLowerCase(),
            fullName: dto.fullName.trim(),
            email: dto.email.trim().toLowerCase(),
            status: 'INVITED',
            createdById: actor.accountId,
            roles: {
              create: dto.roles.map((role) => ({
                role,
                assignedById: actor.accountId,
              })),
            },
          },
        });
        await this.setup.issue(
          { id: account.id, email: account.email!, status: account.status },
          tx,
        );
        await this.audit.record(
          {
            actorInternalAccountId: actor.accountId,
            action: 'INTERNAL_ACCOUNT_CREATED',
            resourceType: 'InternalAccount',
            resourceId: account.id,
            result: 'SUCCESS',
            metadata: { roles: dto.roles },
          },
          request,
          tx,
        );
        return account.id;
      });
      return this.get(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ten dang nhap hoac email da ton tai.');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateInternalAccountDto,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    const data: Prisma.InternalAccountUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (Object.keys(data).length === 0)
      throw new BadRequestException('Khong co thong tin can cap nhat.');
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const account = await tx.internalAccount.findUnique({
            where: { id },
          });
          if (!account)
            throw new NotFoundException('Khong tim thay tai khoan noi bo.');
          const updated = await tx.internalAccount.updateMany({
            where: { id },
            data,
          });
          if (!updated.count)
            throw new NotFoundException('Khong tim thay tai khoan noi bo.');
          if (dto.email !== undefined && data.email !== account.email) {
            await tx.internalSetupToken.updateMany({
              where: { accountId: id, consumedAt: null },
              data: { consumedAt: new Date() },
            });
            if (account.status === 'INVITED') {
              await this.setup.issue(
                { id, email: data.email as string, status: account.status },
                tx,
              );
            }
          }
          await this.audit.record(
            {
              actorInternalAccountId: actor.accountId,
              action: 'INTERNAL_ACCOUNT_UPDATED',
              resourceType: 'InternalAccount',
              resourceId: id,
              result: 'SUCCESS',
            },
            request,
            tx,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email da ton tai.');
      }
      throw error;
    }
    return this.get(id);
  }

  async replaceRoles(
    id: string,
    roles: InternalRole[],
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const account = await tx.internalAccount.findUnique({
          where: { id },
          include: { roles: { where: { revokedAt: null } } },
        });
        if (!account)
          throw new NotFoundException('Khong tim thay tai khoan noi bo.');
        const previous = account.roles.map((entry) => entry.role);
        if (
          account.status === 'ACTIVE' &&
          previous.includes(InternalRole.ADMIN) &&
          !roles.includes(InternalRole.ADMIN)
        ) {
          await this.assertAnotherActiveAdmin(tx, id);
        }
        await tx.internalRoleAssignment.updateMany({
          where: { accountId: id, revokedAt: null, role: { notIn: roles } },
          data: {
            revokedAt: new Date(),
            revokedById: actor.accountId,
            revokeReason: 'ROLE_REPLACED',
          },
        });
        for (const role of roles) {
          await tx.internalRoleAssignment.upsert({
            where: { accountId_role: { accountId: id, role } },
            create: { accountId: id, role, assignedById: actor.accountId },
            update: {
              revokedAt: null,
              revokedById: null,
              revokeReason: null,
              assignedById: actor.accountId,
              assignedAt: new Date(),
            },
          });
        }
        if (
          previous.length !== roles.length ||
          previous.some((role) => !roles.includes(role))
        ) {
          await this.revokeAccess(tx, id, 'ROLES_CHANGED');
        }
        await this.audit.record(
          {
            actorInternalAccountId: actor.accountId,
            action: 'INTERNAL_ROLES_REPLACED',
            resourceType: 'InternalAccount',
            resourceId: id,
            result: 'SUCCESS',
            metadata: { previous, next: roles },
          },
          request,
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(id);
  }

  async setDisabled(
    id: string,
    disabled: boolean,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const account = await tx.internalAccount.findUnique({
          where: { id },
          include: { roles: { where: { revokedAt: null } }, credential: true },
        });
        if (!account)
          throw new NotFoundException('Khong tim thay tai khoan noi bo.');
        if (!disabled && account.status === InternalAccountStatus.LOCKED) {
          throw new ConflictException(
            'Tai khoan dang bi khoa do dang nhap sai; khong the bat bang thao tac nay.',
          );
        }
        if (
          disabled &&
          account.status === 'ACTIVE' &&
          account.roles.some((role) => role.role === InternalRole.ADMIN)
        ) {
          await this.assertAnotherActiveAdmin(tx, id);
        }
        const nextStatus = disabled
          ? InternalAccountStatus.DISABLED
          : account.credential
            ? InternalAccountStatus.ACTIVE
            : InternalAccountStatus.INVITED;
        if (account.status === nextStatus) return;
        await tx.internalAccount.update({
          where: { id },
          data: {
            status: nextStatus,
            disabledById: disabled ? actor.accountId : null,
            disabledAt: disabled ? new Date() : null,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });
        await this.revokeAccess(
          tx,
          id,
          disabled ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED',
        );
        if (disabled) {
          await tx.internalSetupToken.updateMany({
            where: { accountId: id, consumedAt: null },
            data: { consumedAt: new Date() },
          });
        } else if (!account.credential && account.email) {
          await this.setup.issue(
            { id, email: account.email, status: 'INVITED' },
            tx,
          );
        }
        await this.audit.record(
          {
            actorInternalAccountId: actor.accountId,
            action: disabled
              ? 'INTERNAL_ACCOUNT_DISABLED'
              : 'INTERNAL_ACCOUNT_ENABLED',
            resourceType: 'InternalAccount',
            resourceId: id,
            result: 'SUCCESS',
          },
          request,
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(id);
  }

  async resetPassword(
    id: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    this.setup.ensureMailAvailable();
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.internalAccount.findUnique({ where: { id } });
      if (
        !account ||
        !['ACTIVE', 'INVITED'].includes(account.status) ||
        !account.email
      ) {
        throw new NotFoundException(
          'Tai khoan khong hoat dong hoac khong co email.',
        );
      }
      await this.setup.issue(
        { id, email: account.email, status: account.status },
        tx,
      );
      await this.audit.record(
        {
          actorInternalAccountId: actor.accountId,
          action: 'INTERNAL_PASSWORD_RESET_REQUESTED',
          resourceType: 'InternalAccount',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        tx,
      );
    });
    return {
      success: true,
      message: 'Da tao yeu cau thiet lap mat khau va xep hang gui email.',
    };
  }

  private async assertAnotherActiveAdmin(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    const count = await tx.internalAccount.count({
      where: {
        id: { not: id },
        status: 'ACTIVE',
        roles: { some: { role: InternalRole.ADMIN, revokedAt: null } },
      },
    });
    if (!count)
      throw new ConflictException('Khong the vo hieu hoa admin cuoi cung.');
  }

  private async revokeAccess(
    tx: Prisma.TransactionClient,
    id: string,
    reason: string,
  ): Promise<void> {
    await tx.internalAccount.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
    await tx.internalSession.updateMany({
      where: { accountId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }
}
