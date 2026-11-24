interface TransformInput {
  value: unknown;
}

export function trimString({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimOptionalString({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim() || null : value;
}

export function normalizeCode({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export function normalizeSlug({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
