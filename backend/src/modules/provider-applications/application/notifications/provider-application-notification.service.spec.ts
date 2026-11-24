import { ProviderApplicationNotificationService } from '../notifications/provider-application-notification.service';

const recipient = {
  applicationId: '3b3397ea-aef4-4b75-87ef-4188add96e43',
  userId: 'owner-id',
  email: 'provider@example.com',
  displayName: 'Nguyen Van A',
  revisionNumber: 1,
};

describe('ProviderApplicationNotificationService', () => {
  it('sends an approval email to the application email address', async () => {
    const mail = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
      { enqueue: jest.fn() } as never,
    );

    await notifications.notifyApproved(recipient, {} as never);

    expect(mail.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipient.email,
        subject: 'Hồ sơ đối tác Lambe đã được duyệt',
      }),
      expect.stringContaining(':approved'),
      expect.any(Object),
    );
  });

  it('escapes reviewer content before rendering HTML', async () => {
    const mail = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
      { enqueue: jest.fn() } as never,
    );

    await notifications.notifyRejected(
      recipient,
      '<script>alert(1)</script>',
      {} as never,
    );

    expect(mail.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          '&lt;script&gt;alert(1)&lt;/script&gt;',
        ) as unknown,
      }),
      expect.any(String),
      expect.any(Object),
    );
    expect(mail.enqueue).not.toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('<script>') as unknown,
      }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('fails the transaction if the outbox cannot persist the notification', async () => {
    const mail = { enqueue: jest.fn().mockRejectedValue(new Error('DB down')) };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
      { enqueue: jest.fn() } as never,
    );

    await expect(
      notifications.notifySubmitted(recipient, {} as never),
    ).rejects.toThrow('DB down');
  });

  it('skips delivery when a legacy application has no email', async () => {
    const mail = { enqueue: jest.fn() };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
      { enqueue: jest.fn() } as never,
    );

    await notifications.notifyApproved(
      { ...recipient, email: null },
      {} as never,
    );

    expect(mail.enqueue).not.toHaveBeenCalled();
  });

  it('queues push for the owner even when a legacy application has no email', async () => {
    const mail = { enqueue: jest.fn() };
    const push = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
      push as never,
    );
    const tx = {} as never;
    await notifications.notifyApproved(
      { ...recipient, userId: 'owner-id', email: null },
      tx,
    );
    expect(push.enqueue).toHaveBeenCalledWith(tx, {
      userId: 'owner-id',
      sourceId: `${recipient.applicationId}:1:approved`,
      event: 'APPLICATION_APPROVED',
      entityType: 'APPLICATION',
      entityId: recipient.applicationId,
      recipientRole: 'CUSTOMER',
    });
    expect(mail.enqueue).not.toHaveBeenCalled();
  });

  it('uses the changes-requested event expected by the push copy', async () => {
    const push = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const notifications = new ProviderApplicationNotificationService(
      { enqueue: jest.fn() } as never,
      push as never,
    );
    const tx = {} as never;
    await notifications.notifyChangesRequested(
      { ...recipient, email: null },
      'Ảnh bị mờ',
      tx,
    );
    expect(push.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ event: 'APPLICATION_CHANGES_REQUESTED' }),
    );
  });
});
