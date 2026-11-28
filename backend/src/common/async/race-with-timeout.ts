export async function raceWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            resolve(onTimeout());
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
