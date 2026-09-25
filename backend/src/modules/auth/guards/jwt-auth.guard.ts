import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';

interface AccessTokenPayload {
  sub: string;
  phone: string;
  purpose: 'access';
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Access token không hợp lệ.');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (payload.purpose !== 'access' || !payload.sub || !payload.phone) {
        throw new UnauthorizedException('Access token không hợp lệ.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { phone: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE' || user.phone !== payload.phone) {
        throw new UnauthorizedException('Tài khoản hiện không hoạt động.');
      }

      request.user = { userId: payload.sub, phone: payload.phone };
      return true;
    } catch {
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn.',
      );
    }
  }
}
