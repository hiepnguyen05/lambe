import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const context = new AsyncLocalStorage<
  Readonly<{ requestId: string; feedReadFallback: boolean }>
>();
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function boundedRequestId(value: unknown): string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value)
    ? value
    : randomUUID();
}

export function currentRequestId(): string | undefined {
  return context.getStore()?.requestId;
}
export function allowsFeedReadFallback(): boolean {
  return context.getStore()?.feedReadFallback === true;
}

// Workers can establish a run context; no request, user or token is retained.
export function runWithRequestId<T>(
  value: unknown,
  work: () => T,
  feedReadFallback = false,
): T {
  return context.run(
    Object.freeze({ requestId: boundedRequestId(value), feedReadFallback }),
    work,
  );
}
