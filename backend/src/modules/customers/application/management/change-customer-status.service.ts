import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InternalRole, Prisma, UserRole, UserStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { UpdateCustomerStatusDto } from '../../dto/customer-management.dto';
import { assertCustomerStatusChangeAllowed } from '../../domain/customer-status.policy';
import {
  customerStatusResultSelect,
  mapAdminCustomer,
} from './customer.select';

@Injectable()
export class ChangeCustomerStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
  ) {}

  async execute(
    customerId: string,
    dto: UpdateCustomerStatusDto,
    actorId: string,
    actorRoles: InternalRole[],
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      await this.lockCustomer(transaction, customerId);
      const customer = await transaction.user.findFirst({
        where: {
          id: customerId,
          roles: { some: { role: UserRole.CUSTOMER } },
        },
        select: {
          status: true,
          providerProfile: { select: { id: true } },
        },
      });
      if (!customer) throw new NotFoundException('Không tìm thấy khách hàng.');

      assertCustomerStatusChangeAllowed(
        customer.status,
        dto.status,
        actorRoles,
      );

      const updated = await transaction.user.update({
        where: { id: customerId },
        data: { status: dto.status },
        select: customerStatusResultSelect,
      });

      let closedSessionCount = 0;
      if (customer.providerProfile && dto.status !== UserStatus.ACTIVE) {
        const sessions =
          await transaction.providerAvailabilitySession.updateMany({
            where: {
              providerId: customer.providerProfile.id,
              endedAt: null,
            },
            data: {
              endedAt: new Date(),
              endReason: 'USER_ACCOUNT_DISABLED',
            },
          });
        closedSessionCount = sessions.count;
      }

      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action: 'CUSTOMER_STATUS_CHANGED',
          resourceType: 'User',
          resourceId: customerId,
          result: 'SUCCESS',
          metadata: {
            from: customer.status,
            to: dto.status,
            reason: dto.reason.trim(),
            closedProviderSessionCount: closedSessionCount,
          },
        },
        request,
        transaction,
      );

      return {
        customer: mapAdminCustomer(updated),
        providerId: customer.providerProfile?.id,
      };
    });

    if (result.providerId && dto.status !== UserStatus.ACTIVE) {
      await this.locations.remove(result.providerId).catch(() => undefined);
    }

    return {
      success: true,
      message: 'Cập nhật trạng thái khách hàng thành công.',
      data: result.customer,
    };
  }

  private async lockCustomer(
    transaction: Prisma.TransactionClient,
    customerId: string,
  ): Promise<void> {
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${customerId} FOR UPDATE`,
    );
  }
}
