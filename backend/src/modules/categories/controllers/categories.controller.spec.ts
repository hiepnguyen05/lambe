import 'reflect-metadata';
import 'multer';
import { InternalRole, ServiceCategoryStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { INTERNAL_ROLES_KEY } from '../../internal-auth/decorators/internal-roles.decorator';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { AdminCategoriesController } from './admin-categories.controller';
import { PublicCategoriesController } from './public-categories.controller';

describe('Categories controllers', () => {
  const account: AuthenticatedInternalAccount = {
    accountId: 'account-id',
    username: 'admin',
    roles: [InternalRole.ADMIN],
    sessionId: 'session-id',
  };
  const requestMetadata: RequestMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest-agent',
  };

  const createControllers = () => {
    const queryService = {
      findAllForAdmin: jest.fn().mockResolvedValue({ success: true }),
      findOneForAdmin: jest.fn().mockResolvedValue({ success: true }),
      findActive: jest.fn().mockResolvedValue({ success: true }),
      findActiveBySlug: jest.fn().mockResolvedValue({ success: true }),
    };
    const commandService = {
      create: jest.fn().mockResolvedValue({ success: true }),
      update: jest.fn().mockResolvedValue({ success: true }),
      updateStatus: jest.fn().mockResolvedValue({ success: true }),
      reorder: jest.fn().mockResolvedValue({ success: true }),
    };
    const imageService = {
      uploadCover: jest.fn().mockResolvedValue({ success: true }),
      removeCover: jest.fn().mockResolvedValue({ success: true }),
    };
    const service = { ...queryService, ...commandService, ...imageService };

    return {
      service,
      adminController: new AdminCategoriesController(
        queryService as never,
        commandService as never,
        imageService as never,
      ),
      publicController: new PublicCategoriesController(queryService as never),
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('requires the ADMIN role for the whole admin controller', () => {
    expect(
      Reflect.getMetadata(INTERNAL_ROLES_KEY, AdminCategoriesController),
    ).toEqual([InternalRole.ADMIN]);
  });

  it('delegates cover upload and removal with actor metadata', async () => {
    const { adminController, service } = createControllers();
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;

    await adminController.uploadCoverImage(
      'category-id',
      file,
      account,
      requestMetadata,
    );
    await adminController.removeCoverImage(
      'category-id',
      account,
      requestMetadata,
    );

    expect(service.uploadCover).toHaveBeenCalledWith(
      'category-id',
      file.buffer,
      account.accountId,
      requestMetadata,
    );
    expect(service.removeCover).toHaveBeenCalledWith(
      'category-id',
      account.accountId,
      requestMetadata,
    );
  });

  it('delegates admin reads to the service', async () => {
    const { adminController, service } = createControllers();
    const query = { page: 1, limit: 20 };

    await adminController.findAll(query);
    await adminController.findOne('category-id');

    expect(service.findAllForAdmin).toHaveBeenCalledWith(query);
    expect(service.findOneForAdmin).toHaveBeenCalledWith('category-id');
  });

  it('passes actor and request metadata when creating a category', async () => {
    const { adminController, service } = createControllers();
    const dto = { code: 'HAIR', name: 'Tóc', slug: 'toc' };

    await adminController.create(dto, account, requestMetadata);

    expect(service.create).toHaveBeenCalledWith(dto, account.accountId, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('delegates reorder, status and content updates', async () => {
    const { adminController, service } = createControllers();
    const reorderDto = {
      items: [{ id: '6f0fb120-f590-4b63-8782-15ae57eeaba0', sortOrder: 1 }],
    };
    const statusDto = { status: ServiceCategoryStatus.ACTIVE };
    const updateDto = { name: 'Chăm sóc tóc' };

    await adminController.reorder(reorderDto, account, requestMetadata);
    await adminController.updateStatus(
      'category-id',
      statusDto,
      account,
      requestMetadata,
    );
    await adminController.update(
      'category-id',
      updateDto,
      account,
      requestMetadata,
    );

    expect(service.reorder).toHaveBeenCalledWith(
      reorderDto,
      account.accountId,
      expect.any(Object),
    );
    expect(service.updateStatus).toHaveBeenCalledWith(
      'category-id',
      statusDto,
      account.accountId,
      expect.any(Object),
    );
    expect(service.update).toHaveBeenCalledWith(
      'category-id',
      updateDto,
      account.accountId,
      expect.any(Object),
    );
  });

  it('exposes only active categories through the public controller', async () => {
    const { publicController, service } = createControllers();

    await publicController.findActive();

    expect(service.findActive).toHaveBeenCalledTimes(1);
  });

  it('delegates public category detail lookup by slug', async () => {
    const { publicController, service } = createControllers();

    await publicController.findActiveBySlug({ slug: 'toc' });

    expect(service.findActiveBySlug).toHaveBeenCalledWith('toc');
  });
});
