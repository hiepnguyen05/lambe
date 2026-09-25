import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { InternalAccessVerifierService } from '../application/internal-access-verifier.service';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

type InternalRequest = Request & {
  internalAccount?: AuthenticatedInternalAccount;
};

@Injectable()
export class InternalJwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: InternalAccessVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Phiên đăng nhập nội bộ không hợp lệ.');
    }

    request.internalAccount = await this.verifier.verify(token);
    return true;
  }
}
