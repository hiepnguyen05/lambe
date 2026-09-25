import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { InternalRole } from '@prisma/client';
import { Request } from 'express';
import { INTERNAL_ROLES_KEY } from '../decorators/internal-roles.decorator';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

type InternalRequest = Request & {
  internalAccount?: AuthenticatedInternalAccount;
};

@Injectable()
export class InternalRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<InternalRole[]>(
      INTERNAL_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<InternalRequest>();
    const currentRoles = request.internalAccount?.roles ?? [];
    const isAllowed = requiredRoles.some((role) => currentRoles.includes(role));

    if (!isAllowed) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    }

    return true;
  }
}
