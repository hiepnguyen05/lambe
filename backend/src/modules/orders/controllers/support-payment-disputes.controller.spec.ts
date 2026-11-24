import { BadRequestException } from '@nestjs/common';
import { ServiceOrderStatus } from '@prisma/client';
import { SupportPaymentDisputesController } from './support-payment-disputes.controller';

describe('SupportPaymentDisputesController', () => {
  const list = jest.fn().mockResolvedValue({ success: true, data: [] });
  const controller = new SupportPaymentDisputesController(
    { list } as never,
    {} as never,
  );

  beforeEach(() => list.mockClear());

  it('shows pending disputes by default', async () => {
    await controller.list({ page: 2, limit: 20 });
    expect(list).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      status: ServiceOrderStatus.PAYMENT_DISPUTE,
    });
  });

  it('allows staff to find confirmed unpaid disputes', async () => {
    await controller.list({
      page: 1,
      limit: 20,
      status: ServiceOrderStatus.DISPUTED,
    });
    expect(list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: ServiceOrderStatus.DISPUTED,
    });
  });

  it('rejects unrelated order statuses', () => {
    expect(() =>
      controller.list({
        page: 1,
        limit: 20,
        status: ServiceOrderStatus.COMPLETED,
      }),
    ).toThrow(BadRequestException);
    expect(list).not.toHaveBeenCalled();
  });
});
