export const ARGON2_OPTIONS = {
  type: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_INTERNAL_PASSWORD_LENGTH = 15;
export const MAX_INTERNAL_PASSWORD_LENGTH = 128;
