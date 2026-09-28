import { ProviderApplicationNotificationService } from '../notifications/provider-application-notification.service';

const recipient = {
  applicationId: '3b3397ea-aef4-4b75-87ef-4188add96e43',
  email: 'provider@example.com',
  displayName: 'Nguyen Van A',
  revisionNumber: 1,
};

describe('ProviderApplicationNotificationService', () => {
  it('sends an approval email to the application email address', async () => {
    const mail = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
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
    );

    await expect(
      notifications.notifySubmitted(recipient, {} as never),
    ).rejects.toThrow('DB down');
  });

  it('skips delivery when a legacy application has no email', async () => {
    const mail = { enqueue: jest.fn() };
    const notifications = new ProviderApplicationNotificationService(
      mail as never,
    );

    await notifications.notifyApproved(
      { ...recipient, email: null },
      {} as never,
    );

    expect(mail.enqueue).not.toHaveBeenCalled();
  });
});
