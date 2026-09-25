import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

type InternalRequest = Request & {
  internalAccount?: AuthenticatedInternalAccount;
};

export const CurrentInternalAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedInternalAccount => {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    return request.internalAccount as AuthenticatedInternalAccount;
  },
);
