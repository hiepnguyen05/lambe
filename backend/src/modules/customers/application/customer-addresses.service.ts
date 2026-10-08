import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from '../dto/customer-address.dto';

const MAX_ADDRESSES_PER_CUSTOMER = 10;

const customerAddressSelect = {
  id: true,
  type: true,
  label: true,
  addressLine: true,
  provinceName: true,
  districtName: true,
  wardName: true,
  streetLine: true,
  latitude: true,
  longitude: true,
  isMapConfirmed: true,
  contactName: true,
  contactPhone: true,
  note: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerAddressSelect;

@Injectable()
export class CustomerAddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findMine(userId: string) {
    const addresses = await this.prisma.customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: customerAddressSelect,
    });
    return { success: true, data: addresses };
  }

  async create(
    userId: string,
    dto: CreateCustomerAddressDto,
    request: RequestMetadata,
  ) {
    const address = await this.prisma.$transaction(async (transaction) => {
      await this.lockUser(transaction, userId);
      const count = await transaction.customerAddress.count({
        where: { userId },
      });
      if (count >= MAX_ADDRESSES_PER_CUSTOMER) {
        throw new BadRequestException(
          `Mỗi tài khoản chỉ được lưu tối đa ${MAX_ADDRESSES_PER_CUSTOMER} địa chỉ.`,
        );
      }

      const isDefault = dto.isDefault ?? count === 0;
      if (isDefault) await this.clearDefault(transaction, userId);

      const created = await transaction.customerAddress.create({
        data: { userId, ...dto, isDefault },
        select: customerAddressSelect,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'CUSTOMER_ADDRESS_CREATED',
          resourceType: 'CustomerAddress',
          resourceId: created.id,
          result: 'SUCCESS',
          metadata: { isDefault },
        },
        request,
        transaction,
      );
      return created;
    });
    return { success: true, message: 'Đã thêm địa chỉ.', data: address };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCustomerAddressDto,
    request: RequestMetadata,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'Cần cung cấp thông tin địa chỉ để cập nhật.',
      );
    }
    this.assertCoordinatePair(dto);

    const address = await this.prisma.$transaction(async (transaction) => {
      await this.lockUser(transaction, userId);
      const current = await this.findOwned(transaction, userId, id);
      if (dto.isDefault === false && current.isDefault) {
        throw new BadRequestException(
          'Không thể bỏ địa chỉ mặc định. Hãy chọn một địa chỉ mặc định khác.',
        );
      }
      if (dto.isDefault === true) await this.clearDefault(transaction, userId);

      const coordinatesChanged =
        dto.latitude !== undefined && dto.longitude !== undefined;
      const updated = await transaction.customerAddress.update({
        where: { id },
        data: {
          ...dto,
          ...(coordinatesChanged && dto.isMapConfirmed === undefined
            ? { isMapConfirmed: false }
            : {}),
        },
        select: customerAddressSelect,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'CUSTOMER_ADDRESS_UPDATED',
          resourceType: 'CustomerAddress',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { fields: Object.keys(dto) },
        },
        request,
        transaction,
      );
      return updated;
    });
    return { success: true, message: 'Đã cập nhật địa chỉ.', data: address };
  }

  async setDefault(userId: string, id: string, request: RequestMetadata) {
    const address = await this.prisma.$transaction(async (transaction) => {
      await this.lockUser(transaction, userId);
      await this.findOwned(transaction, userId, id);
      await this.clearDefault(transaction, userId);
      const updated = await transaction.customerAddress.update({
        where: { id },
        data: { isDefault: true },
        select: customerAddressSelect,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'CUSTOMER_ADDRESS_DEFAULT_CHANGED',
          resourceType: 'CustomerAddress',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return updated;
    });
    return {
      success: true,
      message: 'Đã đặt làm địa chỉ mặc định.',
      data: address,
    };
  }

  async remove(userId: string, id: string, request: RequestMetadata) {
    await this.prisma.$transaction(async (transaction) => {
      await this.lockUser(transaction, userId);
      const current = await this.findOwned(transaction, userId, id);
      await transaction.customerAddress.delete({ where: { id } });

      if (current.isDefault) {
        const replacement = await transaction.customerAddress.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });
        if (replacement) {
          await transaction.customerAddress.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }

      await this.audit.record(
        {
          actorUserId: userId,
          action: 'CUSTOMER_ADDRESS_DELETED',
          resourceType: 'CustomerAddress',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { wasDefault: current.isDefault },
        },
        request,
        transaction,
      );
    });
    return { success: true, message: 'Đã xóa địa chỉ.' };
  }

  private async findOwned(
    transaction: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    const address = await transaction.customerAddress.findFirst({
      where: { id, userId },
      select: { id: true, isDefault: true },
    });
    if (!address) throw new NotFoundException('Không tìm thấy địa chỉ.');
    return address;
  }

  private clearDefault(transaction: Prisma.TransactionClient, userId: string) {
    return transaction.customerAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private assertCoordinatePair(dto: UpdateCustomerAddressDto): void {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Cần cung cấp đồng thời latitude và longitude khi cập nhật vị trí.',
      );
    }
  }

  private async lockUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
    );
    if (!rows.length) throw new NotFoundException('Không tìm thấy tài khoản.');
  }
}
