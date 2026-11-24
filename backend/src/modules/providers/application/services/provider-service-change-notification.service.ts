import { Injectable } from '@nestjs/common';
import { Prisma, ProviderServiceChangeStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { MailOutboxService } from '../../../../infrastructure/mail/mail-outbox.service';
import { PushOutboxService } from '../../../push/application/push-outbox.service';

interface ServiceChangeRecipient {
  requestId: string;
  userId: string;
  email: string | null;
}

const messages: Partial<
  Record<ProviderServiceChangeStatus, { subject: string; text: string }>
> = {
  PENDING_REVIEW: {
    subject: 'Lambe đã tiếp nhận đề xuất dịch vụ',
    text: 'Lambe đã tiếp nhận đề xuất thay đổi dịch vụ của bạn. Hãy theo dõi trạng thái trong ứng dụng.',
  },
  NEEDS_CHANGES: {
    subject: 'Đề xuất dịch vụ cần bổ sung',
    text: 'Đề xuất dịch vụ của bạn cần bổ sung thông tin. Vui lòng xem lý do trong ứng dụng Lambe.',
  },
  APPROVED: {
    subject: 'Đề xuất dịch vụ đã được duyệt',
    text: 'Đề xuất dịch vụ của bạn đã được duyệt. Dịch vụ mới cần được bật để nhận đơn.',
  },
  REJECTED: {
    subject: 'Kết quả xét duyệt đề xuất dịch vụ',
    text: 'Đề xuất dịch vụ chưa được chấp thuận. Vui lòng xem lý do trong ứng dụng Lambe.',
  },
};

@Injectable()
export class ProviderServiceChangeNotificationService {
  constructor(
    private readonly outbox: MailOutboxService,
    private readonly push: PushOutboxService,
  ) {}

  async enqueue(
    recipient: ServiceChangeRecipient,
    status: ProviderServiceChangeStatus,
    tx: Prisma.TransactionClient,
  ) {
    const content = messages[status];
    if (!content) return;
    await this.push.enqueue(tx, {
      userId: recipient.userId,
      sourceId: randomUUID(),
      event: `SERVICE_CHANGE_${status}`,
      entityType: 'SERVICE_CHANGE',
      entityId: recipient.requestId,
      recipientRole: 'PROVIDER',
    });
    if (!recipient.email) return;
    await this.outbox.enqueue(
      {
        to: recipient.email,
        subject: content.subject,
        text: content.text,
        html: `<p>${content.text}</p>`,
      },
      `provider-service-change:${randomUUID()}`,
      tx,
    );
  }

  async enqueueSuspension(
    email: string | null,
    restored: boolean,
    tx: Prisma.TransactionClient,
  ) {
    if (!email) return;
    const subject = restored
      ? 'Dịch vụ đối tác đã được khôi phục'
      : 'Dịch vụ đối tác đã tạm đình chỉ';
    const text = restored
      ? 'Dịch vụ đã được khôi phục về trạng thái tạm ngừng. Bạn có thể bật lại sau khi kiểm tra thông tin trong ứng dụng Lambe.'
      : 'Một dịch vụ của bạn đã bị tạm đình chỉ. Vui lòng xem lý do trong ứng dụng Lambe.';
    await this.outbox.enqueue(
      { to: email, subject, text, html: `<p>${text}</p>` },
      `provider-service-status:${randomUUID()}`,
      tx,
    );
  }
}
