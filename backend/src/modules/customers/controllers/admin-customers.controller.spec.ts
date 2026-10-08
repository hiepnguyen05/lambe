import 'reflect-metadata';
import { InternalRole, UserStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { INTERNAL_ROLES_KEY } from '../../internal-auth/decorators/internal-roles.decorator';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { AdminCustomersController } from './admin-customers.controller';

describe('AdminCustomersController', () => {
  const account: AuthenticatedInternalAccount = {
    accountId: 'admin-id',
    username: 'admin',
    roles: [InternalRole.ADMIN],
    sessionId: 'session-id',
  };
  const request: RequestMetadata = { requestId: 'request-id' };

  function context() {
    const queryService = {
      findAll: jest.fn().mockResolvedValue({ success: true }),
      findOne: jest.fn().mockResolvedValue({ success: true }),
      findActivity: jest.fn().mockResolvedValue({ success: true }),
      findProviderApplications: jest.fn().mockResolvedValue({ success: true }),
    };
    const statusService = {
      execute: jest.fn().mockResolvedValue({ success: true }),
    };
    return {
      controller: new AdminCustomersController(
        queryService as never,
        statusService as never,
      ),
      queryService,
      statusService,
    };
  }

  it('allows only admin and support roles at controller level', () => {
    expect(
      Reflect.getMetadata(INTERNAL_ROLES_KEY, AdminCustomersController),
    ).toEqual([InternalRole.ADMIN, InternalRole.SUPPORT]);
  });

  it('delegates all query operations with the required context', async () => {
    const { controller, queryService } = context();
    const listQuery = { page: 1, limit: 20 };
    const activityQuery = { page: 1, limit: 10 };

    await controller.findAll(listQuery);
    await controller.findOne('customer-id', account, request);
    await controller.findActivity('customer-id', activityQuery);
    await controller.findProviderApplications('customer-id', account, request);

    expect(queryService.findAll).toHaveBeenCalledWith(listQuery);
    expect(queryService.findOne).toHaveBeenCalledWith(
      'customer-id',
      account.accountId,
      request,
    );
    expect(queryService.findActivity).toHaveBeenCalledWith(
      'customer-id',
      activityQuery,
    );
    expect(queryService.findProviderApplications).toHaveBeenCalledWith(
      'customer-id',
      account.accountId,
      request,
    );
  });

  it('passes actor roles and request metadata to status changes', async () => {
    const { controller, statusService } = context();
    const dto = {
      status: UserStatus.BLOCKED,
      reason: 'Xác minh phản ánh từ khách hàng.',
    };

    await controller.updateStatus('customer-id', dto, account, request);

    expect(statusService.execute).toHaveBeenCalledWith(
      'customer-id',
      dto,
      account.accountId,
      account.roles,
      request,
    );
  });
});
