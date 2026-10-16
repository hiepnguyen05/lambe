export interface WalletBalance {
  balanceAmount: number;
  heldAmount: number;
}

export function availableWalletBalance(wallet: WalletBalance | null): number {
  return wallet ? wallet.balanceAmount - wallet.heldAmount : 0;
}

export function requiredReceivingBalance(
  commissionAmount: number,
  minimumBalance: number,
): number {
  return Math.max(commissionAmount, minimumBalance);
}

export function hasReceivingBalance(
  wallet: WalletBalance | null,
  commissionAmount: number,
  minimumBalance: number,
): boolean {
  return (
    availableWalletBalance(wallet) >=
    requiredReceivingBalance(commissionAmount, minimumBalance)
  );
}
