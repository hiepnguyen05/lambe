import 'reflect-metadata';
import 'multer';
import { InternalRole, ServiceStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { INTERNAL_ROLES_KEY } from '../../internal-auth/decorators/internal-roles.decorator';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { AdminServiceOrderingController } from './admin-service-ordering.controller';
import { AdminServicesController } from './admin-services.controller';
import { PublicServicesController } from './public-services.controller';

describe('Services controllers', () => {
  const account: AuthenticatedInternalAccount = {
    accountId: 'account-id',
    username: 'admin',
    roles: [InternalRole.ADMIN],
    sessionId: 'session-id',
  };
  const metadata: RequestMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function createControllers() {
    const query = {
      findAllForAdmin: jest.fn().mockResolvedValue({ success: true }),
      findOneForAdmin: jest.fn().mockResolvedValue({ success: true }),
      findActive: jest.fn().mockResolvedValue({ success: true }),
      findActiveBySlug: jest.fn().mockResolvedValue({ success: true }),
    };
    const command = {
      create: jest.fn().mockResolvedValue({ success: true }),
      update: jest.fn().mockResolvedValue({ success: true }),
      updateStatus: jest.fn().mockResolvedValue({ success: true }),
      reorder: jest.fn().mockResolvedValue({ success: true }),
    };
    const image = {
      uploadCover: jest.fn().mockResolvedValue({ success: true }),
      removeCover: jest.fn().mockResolvedValue({ success: true }),
    };
    return {
      query,
      command,
      image,
      admin: new AdminServicesController(
        query as never,
        command as never,
        image as never,
      ),
      ordering: new AdminServiceOrderingController(command as never),
      publicController: new PublicServicesController(query as never),
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('requires ADMIN for management controllers', () => {
    expect(
      Reflect.getMetadata(INTERNAL_ROLES_KEY, AdminServicesController),
    ).toEqual([InternalRole.ADMIN]);
    expect(
      Reflect.getMetadata(INTERNAL_ROLES_KEY, AdminServiceOrderingController),
    ).toEqual([InternalRole.ADMIN]);
  });

  it('delegates admin reads and writes with actor metadata', async () => {
    const { admin, query, command } = createControllers();
    const queryDto = { page: 1, limit: 20 };
    const createDto = {
      categoryId: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
      code: 'MEN_HAIRCUT',
      name: 'Cắt tóc nam',
      slug: 'cat-toc-nam',
      minPriceAmount: 50000,
      maxPriceAmount: 300000,
    };

    await admin.findAll(queryDto);
    await admin.findOne('service-id');
    await admin.create(createDto, account, metadata);
    await admin.update('service-id', { name: 'Tên mới' }, account, metadata);
    await admin.updateStatus(
      'service-id',
      { status: ServiceStatus.ACTIVE },
      account,
      metadata,
    );

    expect(query.findAllForAdmin).toHaveBeenCalledWith(queryDto);
    expect(query.findOneForAdmin).toHaveBeenCalledWith('service-id');
    expect(command.create).toHaveBeenCalledWith(
      createDto,
      account.accountId,
      metadata,
    );
    expect(command.update).toHaveBeenCalledWith(
      'service-id',
      { name: 'Tên mới' },
      account.accountId,
      metadata,
    );
    expect(command.updateStatus).toHaveBeenCalledWith(
      'service-id',
      { status: ServiceStatus.ACTIVE },
      account.accountId,
      metadata,
    );
  });

  it('delegates image upload and removal', async () => {
    const { admin, image } = createControllers();
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;
    await admin.uploadCoverImage('service-id', file, account, metadata);
    await admin.removeCoverImage('service-id', account, metadata);
    expect(image.uploadCover).toHaveBeenCalledWith(
      'service-id',
      file.buffer,
      account.accountId,
      metadata,
    );
    expect(image.removeCover).toHaveBeenCalledWith(
      'service-id',
      account.accountId,
      metadata,
    );
  });

  it('delegates category-scoped ordering', async () => {
    const { ordering, command } = createControllers();
    const dto = {
      items: [{ id: '4eb236b4-959d-45b9-a3f0-1f9c8c11f5e7', sortOrder: 1 }],
    };
    await ordering.reorder('category-id', dto, account, metadata);
    expect(command.reorder).toHaveBeenCalledWith(
      'category-id',
      dto,
      account.accountId,
      metadata,
    );
  });

  it('delegates public list and slug detail queries', async () => {
    const { publicController, query } = createControllers();
    await publicController.findActive({ categorySlug: 'toc' });
    await publicController.findActiveBySlug({ slug: 'cat-toc-nam' });
    expect(query.findActive).toHaveBeenCalledWith({ categorySlug: 'toc' });
    expect(query.findActiveBySlug).toHaveBeenCalledWith('cat-toc-nam');
  });
});
