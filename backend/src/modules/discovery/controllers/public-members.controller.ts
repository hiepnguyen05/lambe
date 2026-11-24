import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiNotFoundError,
  ApiStandardOk,
} from '../../../common/openapi/api-response.decorators';
import { MemberDiscoveryService } from '../application/member-discovery.service';

const memberExample = {
  id: '216a1b81-4061-42be-b08a-3497522fb430',
  displayName: 'Nguyễn Văn An',
  avatarUrl: null,
  experienceYears: 3,
  reviewSummary: { count: 8, averageRating: 4.5 },
  organization: {
    id: 'b476f4b1-1781-4006-a8ca-b5fd06877736',
    displayName: 'Lambe Beauty Partner',
    avatarUrl: null,
  },
  services: [
    {
      providerServiceId: '6b601aac-663b-4ee2-a23c-c087f7d373d0',
      serviceId: '41a85643-b755-442e-b2c1-060889ab381c',
      name: 'Cắt tóc nam',
      priceAmount: 150000,
      durationMinutes: 60,
      status: 'ACTIVE',
      categoryId: '3bea9752-fce9-422b-97c3-b855d09bc83f',
    },
  ],
};

@ApiTags('Public Organization Members')
@Controller('providers/:providerId/members')
export class PublicMembersController {
  constructor(private readonly members: MemberDiscoveryService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách chuyên viên công khai và dịch vụ được cấp của tổ chức',
    description:
      'Tối đa 50 member xét theo ID; chỉ thông tin công khai và dịch vụ đủ chuyên môn hiện tại. reviewSummary là điểm riêng của chuyên viên (averageRating=null khi chưa có). Không GPS, SĐT, CCCD hoặc giấy tờ. Chưa kiểm tra lịch khách muốn đặt.',
  })
  @ApiStandardOk({
    description:
      'Khách chọn chuyên viên trước rồi chọn dịch vụ từ services[].providerServiceId.',
    data: [memberExample],
  })
  list(@Param('providerId', ParseUUIDPipe) providerId: string) {
    return this.members.publicMembers(providerId);
  }

  @Get(':memberId')
  @ApiOperation({
    summary: 'Hồ sơ công khai một chuyên viên của đúng tổ chức',
    description:
      'Chọn dịch vụ rồi gọi tìm kiếm/báo giá với memberId. Giá do tổ chức quản lý; không giữ lịch khi xem hồ sơ.',
  })
  @ApiStandardOk({
    description: 'Chỉ dịch vụ được cấp và còn đủ điều kiện.',
    data: memberExample,
  })
  @ApiNotFoundError('Không tìm thấy chuyên viên đang cung cấp dịch vụ.')
  detail(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.members.publicMembers(providerId, memberId);
  }
}
