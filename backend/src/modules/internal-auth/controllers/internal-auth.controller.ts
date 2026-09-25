import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { parse } from 'cookie';
import type { Request, Response } from 'express';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { InternalAuthenticationService } from '../application/internal-authentication.service';
import { InternalSessionService } from '../application/internal-session.service';
import { CurrentInternalAccount } from '../decorators/current-internal-account.decorator';
import { InternalLoginDto } from '../dto/internal-login.dto';
import { InternalJwtAuthGuard } from '../guards/internal-jwt-auth.guard';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

@ApiTags('Internal Authentication')
@Controller('admin/auth')
export class InternalAuthController {
  constructor(
    private readonly authenticationService: InternalAuthenticationService,
    private readonly sessionService: InternalSessionService,
    private readonly configService: ConfigService,
  ) {}

  private get cookieName(): string {
    return this.configService.get<string>(
      'internalAuth.refreshCookieName',
      'lambe_internal_refresh',
    );
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    const days = this.configService.get<number>(
      'internalAuth.refreshTokenExpiresDays',
      7,
    );
    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';

    response.cookie(this.cookieName, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/admin/auth',
      maxAge: days * 24 * 60 * 60 * 1000,
    });
  }

  private getRefreshToken(request: Request): string | undefined {
    const cookies = parse(request.headers.cookie ?? '');
    return cookies[this.cookieName];
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Sign in an internal account' })
  async login(
    @Body() dto: InternalLoginDto,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authenticationService.login(dto, requestMetadata);
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate an internal refresh session' })
  async refresh(
    @Req() request: Request,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.getRefreshToken(request);

    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy refresh session.');
    }

    const result = await this.sessionService.refresh(
      refreshToken,
      requestMetadata,
    );
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current internal session' })
  async logout(
    @Req() request: Request,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.sessionService.logout(
      this.getRefreshToken(request),
      requestMetadata,
    );
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.configService.get<string>('app.nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth',
    });
    return result;
  }

  @Get('me')
  @UseGuards(InternalJwtAuthGuard)
  @ApiBearerAuth('internal-token')
  @ApiOperation({ summary: 'Get the current internal account' })
  async me(@CurrentInternalAccount() account: AuthenticatedInternalAccount) {
    return this.authenticationService.getCurrentAccount(account.accountId);
  }
}
