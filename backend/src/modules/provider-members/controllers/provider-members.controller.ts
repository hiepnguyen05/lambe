import {
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
} from '@nestjs/swagger';
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
import { ProviderMembersService } from '../application/provider-members.service';
import { ProviderMembersQueryDto } from '../dto/provider-members.dto';
import { memberExample } from './provider-members.examples';

@ApiTags('Provider Members')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiForbiddenResponse({
  description: 'Không có quyền owner hoặc membership không đủ điều kiện.',
})
@Controller('me/provider')
export class ProviderMembersController {
  constructor(private readonly members: ProviderMembersService) {}

  @Get('members')
  @ApiOperation({
    summary: 'Owner xem danh sách thành viên tổ chức, gồm cả lịch sử đã rời',
  })
  @ApiStandardOk({
    description: 'Danh sách phân trang theo page/limit.',
    data: [{ ...memberExample, verificationStatus: 'PENDING_REVIEW' }],
  })
  @ApiValidationError()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProviderMembersQueryDto,
  ) {
    return this.members.list(user.userId, query);
  }

  @Get('memberships')
  @ApiOperation({
    summary: 'Xem membership và tổ chức của chính tài khoản đăng nhập',
  })
  @ApiStandardOk({
    description: 'Membership chưa rời của chính mình, không chứa ví hoặc KYC.',
    data: [
      {
        ...memberExample,
        provider: {
          id: memberExample.providerId,
          displayName: 'Lambe Beauty Team',
          avatarUrl: null,
          providerType: 'ORGANIZATION',
          status: 'ACTIVE',
        },
      },
    ],
  })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.members.findMine(user.userId);
  }

  @Post('memberships/:id/leave')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Worker rời tổ chức sau khi kiểm tra trạng thái và nghĩa vụ',
    description:
      'Pending được rời; ACTIVE cần KYC hiện hành được duyệt và không còn nghĩa vụ. Trong P5A, kiểm tra nghĩa vụ ở cấp tổ chức. SUSPENDED cần hỗ trợ; owner phải chuyển giao trước.',
  })
  @ApiStandardOk({
    description: 'Lưu lịch sử rời tổ chức, không xóa membership.',
    data: {
      ...memberExample,
      status: 'LEFT',
      leftAt: '2026-10-27T10:00:00.000Z',
    },
  })
  @ApiNotFoundError('Membership')
  @ApiConflictResponse({
    description: 'Cần hỗ trợ kiểm tra nghĩa vụ trước khi rời.',
  })
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.members.leave(user.userId, id, metadata);
  }
}
