import {
  availableWalletBalance,
  hasReceivingBalance,
  requiredReceivingBalance,
} from './provider-receiving.policy';

describe('provider receiving policy', () => {
  it('uses spendable balance after active holds', () => {
    expect(
      availableWalletBalance({ balanceAmount: 80_000, heldAmount: 30_000 }),
    ).toBe(50_000);
  });

  it('requires at least the configured 50,000 VND floor', () => {
    expect(requiredReceivingBalance(15_000, 50_000)).toBe(50_000);
    expect(
      hasReceivingBalance(
        { balanceAmount: 49_999, heldAmount: 0 },
        15_000,
        50_000,
      ),
    ).toBe(false);
  });

  it('requires the commission amount when it exceeds the balance floor', () => {
    expect(requiredReceivingBalance(60_000, 50_000)).toBe(60_000);
    expect(
      hasReceivingBalance(
        { balanceAmount: 55_000, heldAmount: 0 },
        60_000,
        50_000,
      ),
    ).toBe(false);
  });
});
