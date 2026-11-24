import { ProviderServiceChangeStatus } from '@prisma/client';
import { ProviderServiceChangeNotificationService } from './provider-service-change-notification.service';

describe('ProviderServiceChangeNotificationService', () => {
  it('queues a review result push for the owner even without email', async () => {
    const mail = { enqueue: jest.fn() };
    const push = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new ProviderServiceChangeNotificationService(
      mail as never,
      push as never,
    );
    const transaction = {} as never;
    await service.enqueue(
      { requestId: 'request-id', userId: 'owner-id', email: null },
      ProviderServiceChangeStatus.NEEDS_CHANGES,
      transaction,
    );
    expect(push.enqueue).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        userId: 'owner-id',
        event: 'SERVICE_CHANGE_NEEDS_CHANGES',
        entityType: 'SERVICE_CHANGE',
        entityId: 'request-id',
        recipientRole: 'PROVIDER',
      }),
    );
    expect(mail.enqueue).not.toHaveBeenCalled();
  });
});
