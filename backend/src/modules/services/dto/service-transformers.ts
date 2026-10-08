interface TransformInput {
  value: unknown;
}

export function trimString({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimOptionalString({ value }: TransformInput): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

export function normalizeServiceCode({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export function normalizeServiceSlug({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
