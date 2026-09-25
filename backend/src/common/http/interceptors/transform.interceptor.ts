import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

export interface StandardApiResponse<T> {
  statusCode: number;
  success: boolean;
  message?: string;
  data: T;
  meta?: unknown;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  StandardApiResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardApiResponse<T> | T> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((res: unknown): StandardApiResponse<T> | T => {
        if (res === null || res === undefined) {
          return {
            statusCode: response.statusCode,
            success: true,
            data: null as unknown as T,
            timestamp: new Date().toISOString(),
          };
        }

        if (typeof res === 'object' && res !== null && 'success' in res) {
          const customRes = res as Record<string, unknown>;
          const { success, message, data, meta } = customRes;
          const remainingData = { ...customRes };
          delete remainingData.success;
          delete remainingData.message;
          delete remainingData.data;
          delete remainingData.meta;
          delete remainingData.statusCode;
          delete remainingData.timestamp;
          const hasRemainingData = Object.keys(remainingData).length > 0;

          return {
            statusCode: response.statusCode,
            timestamp: new Date().toISOString(),
            success: Boolean(success),
            message: typeof message === 'string' ? message : undefined,
            data: (hasRemainingData
              ? data && typeof data === 'object' && !Array.isArray(data)
                ? { ...(data as Record<string, unknown>), ...remainingData }
                : remainingData
              : (data ?? null)) as T,
            meta,
          };
        }

        return {
          statusCode: response.statusCode,
          success: true,
          data: res as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
