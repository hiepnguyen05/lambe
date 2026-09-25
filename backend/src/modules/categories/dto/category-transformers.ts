interface TransformInput {
  value: unknown;
}

export function trimString({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizeCategoryCode({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export function normalizeCategorySlug({ value }: TransformInput): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
