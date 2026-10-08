import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerAddressesService } from './customer-addresses.service';

function context() {
  const address = {
    id: 'address-id',
    userId: 'user-id',
    type: 'HOME',
    label: 'Nhà',
    addressLine: '12 Nguyễn Huệ',
    provinceName: 'Thành phố Hồ Chí Minh',
    districtName: 'Quận 1',
    wardName: 'Phường Bến Nghé',
    streetLine: '12 Nguyễn Huệ',
    latitude: 10.7731,
    longitude: 106.703,
    isMapConfirmed: true,
    isDefault: true,
  };
  const customerAddress = {
    findMany: jest.fn().mockResolvedValue([address]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(address),
    findFirst: jest.fn().mockResolvedValue(address),
    update: jest.fn().mockResolvedValue(address),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue(address),
  };
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-id' }]),
    customerAddress,
  };
  const prisma = {
    customerAddress,
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const audit = { record: jest.fn() };
  return {
    service: new CustomerAddressesService(prisma as never, audit as never),
    customerAddress,
    transaction,
    address,
    audit,
  };
}

describe('CustomerAddressesService', () => {
  it('makes the first address default and records an audit without PII', async () => {
    const { service, customerAddress, audit } = context();
    await service.create(
      'user-id',
      {
        label: 'Nhà',
        addressLine: '12 Nguyễn Huệ',
        latitude: 10.7731,
        longitude: 106.703,
      },
      {},
    );

    expect(customerAddress.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        label: 'Nhà',
        addressLine: '12 Nguyễn Huệ',
        latitude: 10.7731,
        longitude: 106.703,
        isDefault: true,
      },
      select: {
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
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CUSTOMER_ADDRESS_CREATED',
        metadata: { isDefault: true },
      }),
      {},
      expect.anything(),
    );
  });

  it('enforces the maximum number of saved addresses', async () => {
    const { service, customerAddress } = context();
    customerAddress.count.mockResolvedValue(10);
    await expect(
      service.create(
        'user-id',
        {
          label: 'Nhà',
          addressLine: '12 Nguyễn Huệ',
          latitude: 10.7731,
          longitude: 106.703,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow access to an address owned by another user', async () => {
    const { service, customerAddress } = context();
    customerAddress.findFirst.mockResolvedValue(null);
    await expect(
      service.setDefault('user-id', 'foreign-address', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires latitude and longitude to be updated together', async () => {
    const { service } = context();

    await expect(
      service.update('user-id', 'address-id', { latitude: 10.8 }, {}),
    ).rejects.toThrow(
      'Cần cung cấp đồng thời latitude và longitude khi cập nhật vị trí.',
    );
  });

  it('marks a changed map position as unconfirmed by default', async () => {
    const { service, customerAddress } = context();

    await service.update(
      'user-id',
      'address-id',
      { latitude: 10.8, longitude: 106.7 },
      {},
    );

    expect(customerAddress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'address-id' },
        data: {
          latitude: 10.8,
          longitude: 106.7,
          isMapConfirmed: false,
        },
      }),
    );
  });

  it('promotes another address after deleting the default one', async () => {
    const { service, customerAddress } = context();
    customerAddress.findFirst
      .mockResolvedValueOnce({ id: 'address-id', isDefault: true })
      .mockResolvedValueOnce({ id: 'replacement-id' });

    await service.remove('user-id', 'address-id', {});

    expect(customerAddress.update).toHaveBeenCalledWith({
      where: { id: 'replacement-id' },
      data: { isDefault: true },
    });
  });
});
