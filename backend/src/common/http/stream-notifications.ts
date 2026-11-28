import type { Response } from 'express';

// Subscribe first, then replay from PostgreSQL; Redis is only a wakeup signal.
export async function streamNotifications<T extends { id: string }>(
  response: Response,
  initialAfter: string | undefined,
  read: (after?: string) => Promise<T[]>,
  subscribe: (refresh: () => void) => Promise<() => Promise<void>>,
): Promise<void> {
  let after = initialAfter,
    refreshing = false,
    pending = false,
    ready = false;
  const write = (rows: T[]) => {
    for (const row of rows) {
      after = row.id;
      response.write(
        `id: ${row.id}\nevent: notification\ndata: ${JSON.stringify(row)}\n\n`,
      );
    }
  };
  const refresh = async () => {
    if (response.destroyed || response.writableEnded) return;
    if (!ready || refreshing) {
      pending = true;
      return;
    }
    refreshing = true;
    try {
      do {
        pending = false;
        const rows = await read(after);
        if (response.destroyed || response.writableEnded) return;
        write(rows);
        if (rows.length === 50) pending = true;
      } while (pending);
    } catch {
      response.end();
    } finally {
      refreshing = false;
    }
  };
  let unsubscribe: () => Promise<void> = () => Promise.resolve();
  let closed = response.destroyed || response.writableEnded;
  const timers: {
    poll?: ReturnType<typeof setInterval>;
    keepalive?: ReturnType<typeof setInterval>;
    timeout?: ReturnType<typeof setTimeout>;
  } = {};
  const stopSubscription = async () => {
    const stop = unsubscribe;
    unsubscribe = () => Promise.resolve();
    await stop();
  };
  const cleanup = () => {
    closed = true;
    clearInterval(timers.poll);
    clearInterval(timers.keepalive);
    clearTimeout(timers.timeout);
    void stopSubscription().catch(() => undefined);
  };
  // A client can disconnect while subscription setup or the initial database read is pending.
  response.once('close', cleanup);
  try {
    unsubscribe = await subscribe(() => void refresh());
  } catch {
    /* PostgreSQL polling remains available. */
  }
  if (closed) {
    await stopSubscription();
    response.off('close', cleanup);
    return;
  }
  let initial: T[];
  try {
    initial = await read(after);
  } catch (error) {
    await stopSubscription();
    response.off('close', cleanup);
    throw error;
  }
  if (closed) return;
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();
  ready = true;
  write(initial);
  if (pending || initial.length === 50) void refresh();
  if (closed) return;
  timers.poll = setInterval(() => void refresh(), 10_000);
  timers.keepalive = setInterval(() => {
    if (!response.destroyed && !response.writableEnded) {
      response.write(': ping\n\n');
    }
  }, 25_000);
  timers.timeout = setTimeout(() => response.end(), 120_000);
}
