interface TransformInput {
  value: unknown;
}

export function trimString({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizeServiceCode({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export function normalizeServiceSlug({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
