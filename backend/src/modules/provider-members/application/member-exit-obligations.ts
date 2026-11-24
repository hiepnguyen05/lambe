import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Assigned jobs are member-scoped; legacy unassigned commitments still block the whole organization.
export async function assertNoMemberExitObligations(
  tx: Prisma.TransactionClient,
  providerId: string,
  memberId?: string,
) {
  const scope = {
    providerId,
    ...(memberId
      ? { OR: [{ assignedMemberId: memberId }, { assignedMemberId: null }] }
      : {}),
  } satisfies Prisma.ServiceOrderWhereInput;
  const [order, calendar, safety, cancellation, hold] = await Promise.all([
    tx.serviceOrder.findFirst({
      where: {
        ...scope,
        status: {
          in: [
            'PENDING_PROVIDER',
            'ACCEPTED',
            'EN_ROUTE',
            'ARRIVED',
            'IN_PROGRESS',
            'SAFETY_HOLD',
            'PAYMENT_DISPUTE',
            'DISPUTED',
          ],
        },
      },
      select: { id: true },
    }),
    tx.providerCalendarBlock.findFirst({
      where: {
        providerId,
        ...(memberId ? { OR: [{ memberId }, { memberId: null }] } : {}),
        active: true,
        endAt: { gt: new Date() },
      },
      select: { id: true },
    }),
    tx.orderSafetyIncident.findFirst({
      where: { status: 'OPEN', order: scope },
      select: { id: true },
    }),
    tx.orderCancellationRequest.findFirst({
      where: {
        status: { in: ['PENDING_CUSTOMER', 'SUPPORT_REVIEW'] },
        order: scope,
      },
      select: { id: true },
    }),
    tx.walletHold.findFirst({
      where: { status: 'ACTIVE', order: scope },
      select: { id: true },
    }),
  ]);
  if (order || calendar || safety || cancellation || hold)
    throw new ConflictException(
      'Tổ chức còn đơn, lịch, tiền giữ hoặc sự cố chưa kết thúc; cần hỗ trợ kiểm tra trước khi rời.',
    );
}
