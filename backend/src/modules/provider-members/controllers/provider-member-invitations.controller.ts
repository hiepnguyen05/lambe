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
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderMemberInvitationsService } from '../application/invitations/provider-member-invitations.service';
import {
  CreateProviderMemberInvitationDto,
  ProviderMembersQueryDto,
} from '../dto/provider-members.dto';
import { invitationExample } from './provider-members.examples';

@ApiTags('Provider Member Invitations')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiForbiddenResponse({
  description: 'Chỉ owner của tổ chức đang hoạt động được quản lý lời mời.',
})
@ApiValidationError()
@ApiConflictResponse({
  description: 'Lời mời đã xử lý, trùng hoặc vượt giới hạn.',
})
@Controller('me/provider/member-invitations')
export class ProviderMemberInvitationsController {
  constructor(private readonly invitations: ProviderMemberInvitationsService) {}

  @Get()
  @ApiOperation({ summary: 'Owner liệt kê lời mời đã tạo' })
  @ApiStandardOk({
    description:
      'Danh sách theo page/limit; không bao giờ trả token hoặc tokenHash.',
    data: [invitationExample],
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProviderMembersQueryDto,
  ) {
    return this.invitations.list(user.userId, query);
  }

  @Post()
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Owner tạo lời mời worker bằng số điện thoại',
    description:
      'Token chỉ trả một lần để owner chia sẻ riêng. API không tự gửi SMS/email và không tiết lộ SĐT đã có tài khoản chưa. Hạn 7 ngày; tối đa 50 lời mời chờ.',
  })
  @ApiStandardCreated({
    description: 'Đã tạo lời mời, chưa thêm thành viên.',
    data: { ...invitationExample, token: 'a'.repeat(64) },
  })
  @ApiTooManyRequestsResponse({
    description: 'Tối đa 10 request/phút/IP, ngoài giới hạn toàn cục.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProviderMemberInvitationDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.invitations.create(user.userId, dto.phone, metadata);
  }

  @Post(':id/resend')
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Owner cấp lại token lời mời',
    description:
      'Cách nhau ít nhất 60 giây. Token cũ vô hiệu ngay; gia hạn 7 ngày. Owner chia sẻ token mới cho người được mời.',
  })
  @ApiStandardOk({
    description: 'Token mới chỉ hiển thị một lần.',
    data: { ...invitationExample, token: 'b'.repeat(64) },
  })
  @ApiNotFoundError('Lời mời')
  resend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.invitations.resend(user.userId, id, metadata);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Owner thu hồi lời mời chưa được phản hồi' })
  @ApiStandardOk({
    description: 'Đã thu hồi, giữ lịch sử.',
    data: {
      ...invitationExample,
      status: 'REVOKED',
      revokedAt: '2026-10-27T10:00:00.000Z',
    },
  })
  @ApiNotFoundError('Lời mời')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.invitations.revoke(user.userId, id, metadata);
  }
}
