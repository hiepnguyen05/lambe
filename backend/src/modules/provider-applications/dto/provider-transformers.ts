import type { TransformFnParams } from 'class-transformer';

export const trimOptionalString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() || null : value;
