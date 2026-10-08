import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  CustomerActivityQueryDto,
  CustomerQueryDto,
} from '../../dto/customer-management.dto';
import {
  adminCustomerDetailSelect,
  adminCustomerListSelect,
  customerProviderApplicationSelect,
  mapAdminCustomer,
} from './customer.select';

@Injectable()
export class CustomerManagementQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: CustomerQueryDto) {
    const where = this.buildWhere(query);
    const [customers, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: adminCustomerListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: customers.map(mapAdminCustomer),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(customerId: string, actorId: string, request: RequestMetadata) {
    const customer = await this.prisma.user.findFirst({
      where: this.customerWhere(customerId),
      select: adminCustomerDetailSelect,
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng.');

    await this.audit.record(
      {
        actorInternalAccountId: actorId,
        action: 'CUSTOMER_PROFILE_ACCESSED',
        resourceType: 'User',
        resourceId: customerId,
        result: 'SUCCESS',
      },
      request,
    );

    return { success: true, data: mapAdminCustomer(customer) };
  }

  async findActivity(customerId: string, query: CustomerActivityQueryDto) {
    await this.assertCustomerExists(customerId);
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { actorUserId: customerId },
        { resourceType: 'User', resourceId: customerId },
      ],
    };
    const [activity, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          actorUserId: true,
          actorInternalAccountId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          result: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: activity,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findProviderApplications(
    customerId: string,
    actorId: string,
    request: RequestMetadata,
  ) {
    await this.assertCustomerExists(customerId);
    const applications = await this.prisma.providerApplication.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      select: customerProviderApplicationSelect,
    });

    await this.audit.record(
      {
        actorInternalAccountId: actorId,
        action: 'CUSTOMER_PROVIDER_APPLICATIONS_ACCESSED',
        resourceType: 'User',
        resourceId: customerId,
        result: 'SUCCESS',
      },
      request,
    );

    return { success: true, data: applications };
  }

  private buildWhere(query: CustomerQueryDto): Prisma.UserWhereInput {
    if (
      query.createdFrom &&
      query.createdTo &&
      new Date(query.createdFrom) > new Date(query.createdTo)
    ) {
      throw new BadRequestException(
        'Thời điểm bắt đầu không được lớn hơn thời điểm kết thúc.',
      );
    }

    const where: Prisma.UserWhereInput = {
      roles: { some: { role: UserRole.CUSTOMER } },
    };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.gender || query.onboardingStatus) {
      where.customerProfile = {
        is: {
          ...(query.gender ? { gender: query.gender } : {}),
          ...(query.onboardingStatus
            ? { onboardingStatus: query.onboardingStatus }
            : {}),
        },
      };
    }
    if (query.providerStatus) {
      where.providerProfile = { is: { status: query.providerStatus } };
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }
    return where;
  }

  private customerWhere(customerId: string): Prisma.UserWhereInput {
    return {
      id: customerId,
      roles: { some: { role: UserRole.CUSTOMER } },
    };
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const customer = await this.prisma.user.findFirst({
      where: this.customerWhere(customerId),
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng.');
  }
}
