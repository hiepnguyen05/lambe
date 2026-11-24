import { BadRequestException } from '@nestjs/common';
import { VoucherDiscountType, VoucherIssuer } from '@prisma/client';

export function calculateVoucherDiscount(
  voucher: {
    issuer: VoucherIssuer;
    discountType: VoucherDiscountType;
    value: number;
    maxDiscountAmount: number | null;
  },
  servicePriceAmount: number,
  serviceFloorAmount: number,
) {
  const raw =
    voucher.discountType === VoucherDiscountType.FIXED_AMOUNT
      ? voucher.value
      : Math.floor((servicePriceAmount * voucher.value) / 100);
  const discountAmount = Math.min(
    servicePriceAmount,
    raw,
    voucher.maxDiscountAmount ?? Number.MAX_SAFE_INTEGER,
  );
  if (
    voucher.issuer === VoucherIssuer.PROVIDER &&
    (discountAmount * 100 > servicePriceAmount * 30 ||
      servicePriceAmount - discountAmount < serviceFloorAmount)
  ) {
    throw new BadRequestException(
      'Voucher của thợ vượt 30% hoặc làm giá dịch vụ thấp hơn giá sàn.',
    );
  }
  return {
    discountAmount,
    platformFundedAmount:
      voucher.issuer === VoucherIssuer.PLATFORM ? discountAmount : 0,
    providerFundedAmount:
      voucher.issuer === VoucherIssuer.PROVIDER ? discountAmount : 0,
    commissionBaseAmount:
      servicePriceAmount -
      (voucher.issuer === VoucherIssuer.PROVIDER ? discountAmount : 0),
  };
}
