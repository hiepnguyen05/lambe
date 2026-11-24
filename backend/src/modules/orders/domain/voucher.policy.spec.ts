import { calculateVoucherDiscount } from './voucher.policy';

describe('voucher discounts', () => {
  const voucher = {
    issuer: 'PLATFORM' as const,
    discountType: 'PERCENTAGE' as const,
    value: 20,
    maxDiscountAmount: 30000,
  };

  it('caps percentage discounts and excludes the travel fee', () => {
    expect(calculateVoucherDiscount(voucher, 200000, 100000)).toEqual({
      discountAmount: 30000,
      platformFundedAmount: 30000,
      providerFundedAmount: 0,
      commissionBaseAmount: 200000,
    });
  });

  it('rejects provider discounts below the catalog floor', () => {
    expect(() =>
      calculateVoucherDiscount(
        {
          issuer: 'PROVIDER',
          discountType: 'FIXED_AMOUNT',
          value: 50000,
          maxDiscountAmount: null,
        },
        150000,
        120000,
      ),
    ).toThrow();
  });

  it('rejects provider discounts over 30 percent even above the floor', () => {
    expect(() =>
      calculateVoucherDiscount(
        {
          issuer: 'PROVIDER',
          discountType: 'FIXED_AMOUNT',
          value: 40000,
          maxDiscountAmount: null,
        },
        100000,
        50000,
      ),
    ).toThrow();
  });
});
