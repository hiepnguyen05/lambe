import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface FinanceScope {
  providerId: string;
  memberId?: string;
  servingUserId?: string;
}
export interface FinanceRange {
  from: Date;
  to: Date;
}

export function financeCohort(
  scope: FinanceScope,
  range: FinanceRange,
  page?: { limit: number; cursor?: { completedAt: Date; id: string } },
) {
  return Prisma.sql`WITH completed AS (
    SELECT o."id", o."providerId", o."assignedMemberId", o."assignedMemberVersion",
      o."assignedMemberName", o."assignedMemberAvatarUrl", o."assignedMemberUserId",
      o."serviceName", o."completedAt", o."cashCollectedAt", o."cashCollectedByUserId", o."cashCollectedAmount",
      o."servicePriceAmount", o."travelFeeAmount", o."subtotalAmount", o."discountAmount",
      o."platformFundedAmount", o."providerFundedAmount", o."totalAmount", o."commissionAmount", o."currencyCode"
    FROM "service_orders" o
    WHERE o."providerId"=${scope.providerId} AND o."status"='COMPLETED'
      AND o."completedAt">=${range.from} AND o."completedAt"<${range.to}
      ${scope.memberId ? Prisma.sql`AND o."assignedMemberId"=${scope.memberId}` : Prisma.empty}
      ${scope.servingUserId ? Prisma.sql`AND o."assignedMemberUserId"=${scope.servingUserId}` : Prisma.empty}
      ${page?.cursor ? Prisma.sql`AND (o."completedAt",o."id")<(${page.cursor.completedAt},${page.cursor.id})` : Prisma.empty}
      ${page ? Prisma.sql`ORDER BY o."completedAt" DESC,o."id" DESC LIMIT ${page.limit}` : Prisma.empty}
  ), ledger AS (
    SELECT t."orderId",
      SUM(CASE WHEN t."type"='COMMISSION' THEN t."amount" ELSE 0 END)::bigint AS commission,
      SUM(CASE WHEN t."type"='VOUCHER_REIMBURSEMENT' THEN t."amount" ELSE 0 END)::bigint AS reimbursement
    FROM "wallet_transactions" t JOIN completed c ON c."id"=t."orderId"
      JOIN "provider_wallets" w ON w."id"=t."walletId" AND w."providerId"=${scope.providerId}
    WHERE t."type" IN ('COMMISSION','VOUCHER_REIMBURSEMENT') GROUP BY t."orderId"
  ), amounts AS (
    SELECT c.*, COALESCE(l.commission,0)::bigint AS "commissionChargedAmount",
      COALESCE(l.reimbursement,0)::bigint AS "platformReimbursedAmount",
      COALESCE(c."assignedMemberId" || ':' || c."assignedMemberVersion"::text, 'LEGACY') AS "groupKey"
    FROM completed c LEFT JOIN ledger l ON l."orderId"=c."id"
  )`;
}

export const financeTotalsSql = Prisma.sql`
  COUNT(*)::text AS "completedOrderCount",
  COUNT(*) FILTER (WHERE "currencyCode"<>'VND')::text AS "nonVndOrderCount",
  COALESCE(SUM("servicePriceAmount"),0)::text AS "servicePriceAmount",
  COALESCE(SUM("totalAmount"::bigint + "discountAmount" - "travelFeeAmount"),0)::text AS "serviceTotalAmount",
  COALESCE(SUM("totalAmount"::bigint + "discountAmount" - "travelFeeAmount" - "servicePriceAmount"),0)::text AS "addOnPriceAmount",
  COALESCE(SUM("travelFeeAmount"),0)::text AS "travelFeeAmount",
  COALESCE(SUM("discountAmount"),0)::text AS "discountAmount",
  COALESCE(SUM("platformFundedAmount"),0)::text AS "platformFundedAmount",
  COALESCE(SUM("providerFundedAmount"),0)::text AS "providerFundedAmount",
  COALESCE(SUM("totalAmount"),0)::text AS "customerPayableAmount",
  COALESCE(SUM("cashCollectedAmount"),0)::text AS "cashRecordedAmount",
  COUNT(*) FILTER (WHERE "cashCollectedAmount" IS NOT NULL)::text AS "cashRecordedOrderCount",
  COUNT(*) FILTER (WHERE "cashCollectedAmount" IS NULL)::text AS "cashUnverifiedOrderCount",
  COALESCE(SUM(CASE WHEN "cashCollectedAmount" IS NULL THEN "totalAmount" ELSE 0 END),0)::text AS "cashUnverifiedPayableAmount",
  COALESCE(SUM("commissionAmount"),0)::text AS "expectedCommissionAmount",
  COALESCE(SUM("commissionChargedAmount"),0)::text AS "commissionChargedAmount",
  COALESCE(SUM("platformReimbursedAmount"),0)::text AS "platformReimbursedAmount"`;

export type FinanceTotalsRow = Record<
  | 'completedOrderCount'
  | 'nonVndOrderCount'
  | 'servicePriceAmount'
  | 'serviceTotalAmount'
  | 'addOnPriceAmount'
  | 'travelFeeAmount'
  | 'discountAmount'
  | 'platformFundedAmount'
  | 'providerFundedAmount'
  | 'customerPayableAmount'
  | 'cashRecordedAmount'
  | 'cashRecordedOrderCount'
  | 'cashUnverifiedOrderCount'
  | 'cashUnverifiedPayableAmount'
  | 'expectedCommissionAmount'
  | 'commissionChargedAmount'
  | 'platformReimbursedAmount',
  string
>;

export function financeNumber(value: string | bigint | number) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount))
    throw new ConflictException(
      'Tổng báo cáo vượt phạm vi số nguyên an toàn. Hãy chọn khoảng thời gian ngắn hơn.',
    );
  return amount;
}

export function netOrderProceeds(
  payable: number,
  reimbursement: number | bigint,
  commission: number | bigint,
) {
  return financeNumber(
    BigInt(payable) + BigInt(reimbursement) - BigInt(commission),
  );
}

export function presentFinanceTotals(row: FinanceTotalsRow) {
  const { nonVndOrderCount, ...totals } = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, financeNumber(value)]),
  ) as { [K in keyof FinanceTotalsRow]: number };
  if (nonVndOrderCount)
    throw new ConflictException(
      'Báo cáo VND có đơn khác tiền tệ; cần hỗ trợ đối soát.',
    );
  return {
    ...totals,
    commissionDifferenceAmount: financeNumber(
      totals.expectedCommissionAmount - totals.commissionChargedAmount,
    ),
    netOrderProceedsAmount: netOrderProceeds(
      totals.customerPayableAmount,
      totals.platformReimbursedAmount,
      totals.commissionChargedAmount,
    ),
  };
}
