import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderParamDto } from '../../orders/dto/order.dto';
import { MemberFinanceService } from '../application/finance/member-finance.service';
import {
  FinanceRangeDto,
  FinanceOrdersQueryDto,
  FinanceMembersQueryDto,
  OwnerFinanceQueryDto,
  OwnerFinanceOrdersQueryDto,
} from '../dto/member-finance.dto';

const rangeDescription =
  'from inclusive/to exclusive theo completedAt, ISO có timezone, tối đa 93 ngày. Không tính đơn chờ/hủy/tranh chấp thành doanh thu hoàn tất. Các tổng tiền VND là số nguyên. Lambe không tính lương/thưởng hay xác nhận nhân viên đã bàn giao tiền mặt cho tổ chức.';

@ApiTags('Organization Finance')
@Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
@ApiBearerAuth('user-token')
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiConflictError('Dữ liệu tiền tệ hoặc tổng tiền cần đối soát.')
@UseGuards(JwtAuthGuard)
@Controller('me/provider/finance')
export class OrganizationFinanceController {
  constructor(private readonly finance: MemberFinanceService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Owner xem tổng doanh thu đơn, tiền thu hộ và hoa hồng tổ chức',
    description:
      rangeDescription +
      ' Có memberId để lọc cohort; organizationWalletNow luôn là toàn tổ chức, outstandingNow là nghĩa vụ hiện tại của phạm vi, không áp khoảng completedAt. Owner vẫn đọc tài chính khi tổ chức bị tạm khóa, nếu tài khoản và membership owner còn hợp lệ.',
  })
  @ApiStandardOk({
    description:
      'Hoa hồng và bù voucher lấy từ ledger thực ghi của đơn, không cộng HOLD/TOP_UP như doanh thu.',
    data: {
      completedOrderCount: 1,
      customerPayableAmount: 130000,
      cashRecordedAmount: 130000,
      cashRecordedOrderCount: 1,
      cashUnverifiedOrderCount: 0,
      cashUnverifiedPayableAmount: 0,
      servicePriceAmount: 150000,
      serviceTotalAmount: 150000,
      addOnPriceAmount: 0,
      travelFeeAmount: 10000,
      discountAmount: 30000,
      platformFundedAmount: 30000,
      providerFundedAmount: 0,
      expectedCommissionAmount: 15000,
      commissionChargedAmount: 15000,
      commissionDifferenceAmount: 0,
      platformReimbursedAmount: 30000,
      netOrderProceedsAmount: 145000,
      organizationWalletNow: {
        balanceAmount: 215000,
        heldAmount: 0,
        availableAmount: 215000,
        currencyCode: 'VND',
      },
      outstandingNow: {
        activeHoldCount: 0,
        activeCommissionHoldAmount: 0,
        paymentDisputeCount: 0,
        disputedCustomerPayableAmount: 0,
      },
    },
  })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerFinanceQueryDto,
  ) {
    return this.finance.ownerSummary(user.userId, query);
  }

  @Get('members')
  @ApiOperation({
    summary: 'Owner đối soát đơn hoàn tất theo member và membershipVersion',
    description:
      rangeDescription +
      ' Mỗi nhóm dùng snapshot, LEFT không mất lịch sử. Nhóm LEGACY là chưa phân công, không gán vào owner. Dùng data.nextCursor và giữ nguyên khoảng thời gian.',
  })
  @ApiStandardOk({
    description:
      'data.items là nhóm có đơn hoàn tất, không phải danh sách mọi nhân viên.',
    data: { items: [], nextCursor: null },
  })
  members(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceMembersQueryDto,
  ) {
    return this.finance.ownerMembers(user.userId, query);
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Owner xem chi tiết tài chính các đơn hoàn tất',
    description:
      rangeDescription +
      ' memberId tùy chọn. Cursor keyset completedAt/id, tối đa 50 đơn; không trả địa chỉ, điện thoại hoặc giấy tờ.',
  })
  @ApiStandardOk({
    description:
      'data.items chứa orderId, snapshot assignedMember, giá/giảm giá, commission ledger và cashCollection; nextCursor ở data.',
    data: { items: [], nextCursor: null },
  })
  @ApiNotFoundError('Thành viên trong tổ chức')
  orders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerFinanceOrdersQueryDto,
  ) {
    return this.finance.ownerOrders(user.userId, query);
  }
}

@ApiTags('Member Cash Collections')
@Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
@ApiBearerAuth('user-token')
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiNotFoundError('Lịch sử thu hộ của bản thân')
@UseGuards(JwtAuthGuard)
@Controller('me/provider/memberships/:id/collections')
export class MemberCollectionsController {
  constructor(private readonly finance: MemberFinanceService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Worker xem tổng tiền thu hộ của chính mình',
    description:
      rangeDescription +
      ' Kể cả đã rời/bị đình chỉ vẫn đọc lịch sử theo snapshot user; không trả số dư ví, hoa hồng, bù voucher hoặc doanh thu đồng nghiệp.',
  })
  @ApiStandardOk({
    description: 'Tiền thu hộ, không phải thu nhập/số dư có thể rút.',
    data: {
      completedOrderCount: 1,
      customerPayableAmount: 150000,
      cashRecordedAmount: 150000,
      cashRecordedOrderCount: 1,
      cashUnverifiedOrderCount: 0,
      cashUnverifiedPayableAmount: 0,
      collectionPurpose: 'ON_BEHALF_OF_ORGANIZATION',
    },
  })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Query() query: FinanceRangeDto,
  ) {
    return this.finance.workerSummary(user.userId, params.id, query);
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Worker xem các đơn hoàn tất và tiền thu hộ của mình',
    description:
      rangeDescription +
      ' Tối đa 50 đơn/trang, data.nextCursor. Không nhận memberId tùy ý trong query; không cho owner gọi thay worker.',
  })
  @ApiStandardOk({
    description:
      'Đơn có customerPayableAmount và cashCollection RECORDED/UNVERIFIED, snapshot người thực hiện, không có thông tin ví hoặc PII khách.',
    data: { items: [], nextCursor: null },
  })
  orders(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Query() query: FinanceOrdersQueryDto,
  ) {
    return this.finance.workerOrders(user.userId, params.id, query);
  }
}
