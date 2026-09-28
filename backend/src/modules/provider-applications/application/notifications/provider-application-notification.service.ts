import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MailOutboxService } from '../../../../infrastructure/mail/mail-outbox.service';

interface ApplicationEmailRecipient {
  applicationId: string;
  email: string | null;
  displayName: string | null;
  revisionNumber: number;
}

@Injectable()
export class ProviderApplicationNotificationService {
  private readonly logger = new Logger(
    ProviderApplicationNotificationService.name,
  );

  constructor(private readonly outbox: MailOutboxService) {}

  notifySubmitted(
    recipient: ApplicationEmailRecipient,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    return this.sendSafely(
      recipient,
      {
        event: 'submitted',
        subject: 'Lambe đã tiếp nhận hồ sơ đăng ký đối tác',
        headline: 'Hồ sơ của bạn đã được gửi thành công',
        message:
          'Lambe đã tiếp nhận hồ sơ đăng ký đối tác và sẽ tiến hành kiểm duyệt. Chúng tôi sẽ gửi email khi có kết quả hoặc khi hồ sơ cần bổ sung.',
      },
      transaction,
    );
  }

  notifyApproved(
    recipient: ApplicationEmailRecipient,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    return this.sendSafely(
      recipient,
      {
        event: 'approved',
        subject: 'Hồ sơ đối tác Lambe đã được duyệt',
        headline: 'Chúc mừng, hồ sơ của bạn đã được duyệt',
        message:
          'Tài khoản của bạn đã được cấp quyền nhà cung cấp dịch vụ. Bạn có thể tiếp tục thiết lập khu vực phục vụ và trạng thái hoạt động trên ứng dụng Lambe.',
      },
      transaction,
    );
  }

  notifyChangesRequested(
    recipient: ApplicationEmailRecipient,
    reason: string,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    return this.sendSafely(
      recipient,
      {
        event: 'changes-requested',
        subject: 'Hồ sơ đối tác Lambe cần bổ sung thông tin',
        headline: 'Hồ sơ của bạn cần được bổ sung',
        message:
          'Bộ phận kiểm duyệt đã yêu cầu cập nhật một số nội dung. Vui lòng mở ứng dụng Lambe, xem chi tiết từng hạng mục và gửi lại hồ sơ.',
        reason,
      },
      transaction,
    );
  }

  notifyRejected(
    recipient: ApplicationEmailRecipient,
    reason: string,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    return this.sendSafely(
      recipient,
      {
        event: 'rejected',
        subject: 'Kết quả hồ sơ đăng ký đối tác Lambe',
        headline: 'Hồ sơ của bạn chưa được chấp thuận',
        message:
          'Rất tiếc, hồ sơ đăng ký đối tác hiện chưa đáp ứng yêu cầu của Lambe. Bạn có thể xem lý do bên dưới để biết thêm chi tiết.',
        reason,
      },
      transaction,
    );
  }

  private async sendSafely(
    recipient: ApplicationEmailRecipient,
    content: {
      event: string;
      subject: string;
      headline: string;
      message: string;
      reason?: string;
    },
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    if (!recipient.email) {
      this.logger.warn(
        `Skipped ${content.event} email for application ${recipient.applicationId}: no recipient email`,
      );
      return;
    }

    const name = recipient.displayName?.trim() || 'bạn';
    const text = this.buildText(name, content.message, content.reason);
    const html = this.buildHtml(
      name,
      content.headline,
      content.message,
      content.reason,
    );

    await this.outbox.enqueue(
      {
        to: recipient.email,
        subject: content.subject,
        text,
        html,
      },
      `provider:${recipient.applicationId}:${recipient.revisionNumber}:${content.event}`,
      transaction,
    );
  }

  private buildText(name: string, message: string, reason?: string): string {
    return [
      `Xin chào ${name},`,
      '',
      message,
      ...(reason ? ['', `Lý do/Ghi chú: ${reason}`] : []),
      '',
      'Trân trọng,',
      'Lambe Home Beauty',
    ].join('\n');
  }

  private buildHtml(
    name: string,
    headline: string,
    message: string,
    reason?: string,
  ): string {
    const safeName = this.escapeHtml(name);
    const safeHeadline = this.escapeHtml(headline);
    const safeMessage = this.escapeHtml(message);
    const reasonBlock = reason
      ? `<div style="margin:20px 0;padding:14px 16px;background:#f7f9fb;border-left:4px solid #0f766e"><strong>Lý do/Ghi chú:</strong><br>${this.escapeHtml(reason)}</div>`
      : '';

    return `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f7f9fb;font-family:Arial,sans-serif;color:#1f2937">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #e5e7eb;padding:28px">
        <div style="font-size:22px;font-weight:700;color:#0f766e;margin-bottom:24px">LAMBE</div>
        <p>Xin chào ${safeName},</p>
        <h1 style="font-size:22px;line-height:1.35;margin:16px 0;color:#111827">${safeHeadline}</h1>
        <p style="line-height:1.65">${safeMessage}</p>
        ${reasonBlock}
        <p style="margin-top:28px;line-height:1.6">Trân trọng,<br><strong>Lambe Home Beauty</strong></p>
      </div>
    </div>
  </body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return entities[character];
    });
  }
}
