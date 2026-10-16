import { registerAs } from '@nestjs/config';

export const DEFAULT_PROVIDER_MIN_RECEIVING_BALANCE = 50_000;

export default registerAs('provider', () => ({
  minReceivingBalanceAmount: Number(
    process.env.PROVIDER_MIN_RECEIVING_BALANCE ??
      DEFAULT_PROVIDER_MIN_RECEIVING_BALANCE,
  ),
}));
