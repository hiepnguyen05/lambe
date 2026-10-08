import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import { customerAddressExample } from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CustomerAddressesService } from '../application/customer-addresses.service';
import {
  CreateCustomerAddressDto,
  CustomerAddressParamDto,
  UpdateCustomerAddressDto,
} from '../dto/customer-address.dto';

@ApiTags('Customer Addresses')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/addresses')
export class CustomerAddressesController {
  constructor(private readonly addresses: CustomerAddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy các địa chỉ đã lưu của khách hàng' })
  @ApiStandardOk({
    description:
      'Danh sách địa chỉ nhận dịch vụ của khách hàng, địa chỉ mặc định đứng trước.',
    data: [customerAddressExample],
  })
  @ApiAuthenticationErrors()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.findMine(user.userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Thêm địa chỉ nhận dịch vụ',
    description:
      'Frontend có thể gửi tọa độ GPS hiện tại và địa chỉ đã reverse geocode. Backend chỉ lưu vị trí, không tự đọc GPS của thiết bị.',
  })
  @ApiStandardCreated({
    description: 'Tạo địa chỉ nhận dịch vụ thành công.',
    message: 'Đã thêm địa chỉ.',
    data: customerAddressExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerAddressDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.addresses.create(user.userId, dto, request);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật địa chỉ thuộc tài khoản hiện tại',
    description:
      'Khi thay đổi vị trí phải gửi đồng thời latitude và longitude. Nếu không gửi isMapConfirmed, vị trí mới được đánh dấu là chưa xác nhận.',
  })
  @ApiStandardOk({
    description: 'Cập nhật địa chỉ thành công.',
    message: 'Đã cập nhật địa chỉ.',
    data: customerAddressExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Địa chỉ')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CustomerAddressParamDto,
    @Body() dto: UpdateCustomerAddressDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.addresses.update(user.userId, params.id, dto, request);
  }

  @Put(':id/default')
  @ApiOperation({ summary: 'Đặt địa chỉ mặc định' })
  @ApiStandardOk({
    description: 'Đặt địa chỉ mặc định thành công.',
    message: 'Đã đặt làm địa chỉ mặc định.',
    data: customerAddressExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Địa chỉ')
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CustomerAddressParamDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.addresses.setDefault(user.userId, params.id, request);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa địa chỉ thuộc tài khoản hiện tại' })
  @ApiStandardOk({
    description: 'Xóa địa chỉ thành công.',
    message: 'Đã xóa địa chỉ.',
    data: null,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Địa chỉ')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CustomerAddressParamDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.addresses.remove(user.userId, params.id, request);
  }
}
