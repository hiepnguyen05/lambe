import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderInvitationResponseService } from '../application/invitations/provider-invitation-response.service';
import {
  ProviderMembersQueryDto,
  RespondProviderMemberInvitationDto,
} from '../dto/provider-members.dto';
import { invitationExample, memberExample } from './provider-members.examples';

@ApiTags('My Provider Invitations')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiNotFoundError('Lời mời')
@ApiConflictResponse({
  description:
    'Lời mời đã xử lý, hết hạn hoặc tài khoản có membership/hồ sơ khác.',
})
@Controller('me/provider-invitations')
export class ProviderInvitationResponseController {
  constructor(private readonly responses: ProviderInvitationResponseService) {}

  @Get()
  @ApiOperation({ summary: 'Xem lời mời gửi tới SĐT tài khoản của mình' })
  @ApiStandardOk({
    description: 'Danh sách theo page/limit, không chứa secret.',
    data: [
      {
        id: invitationExample.id,
        status: 'PENDING',
        expiresAt: invitationExample.expiresAt,
        createdAt: invitationExample.createdAt,
        provider: {
          id: invitationExample.providerId,
          displayName: 'Lambe Beauty Team',
          avatarUrl: null,
          status: 'ACTIVE',
        },
      },
    ],
  })
  inbox(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProviderMembersQueryDto,
  ) {
    return this.responses.inbox(user.userId, query);
  }

  @Post(':id/accept')
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Chấp nhận lời mời và tạo worker chờ xác minh',
    description:
      'Token đúng chưa đủ: SĐT đã xác minh của tài khoản phải trùng lời mời. Chưa được online/nhận đơn sau khi chấp nhận. Không tạo ví worker.',
  })
  @ApiStandardOk({
    description: 'Membership được tạo ở PENDING_VERIFICATION.',
    data: {
      invitationId: invitationExample.id,
      status: 'ACCEPTED',
      member: memberExample,
    },
  })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondProviderMemberInvitationDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.responses.respond(user.userId, id, dto.token, true, metadata);
  }

  @Post(':id/decline')
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Từ chối lời mời của chính mình' })
  @ApiStandardOk({
    description: 'Đã từ chối, không tạo membership.',
    data: {
      invitationId: invitationExample.id,
      status: 'DECLINED',
      member: null,
    },
  })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondProviderMemberInvitationDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.responses.respond(user.userId, id, dto.token, false, metadata);
  }
}
