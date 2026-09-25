import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestMetadata } from '../types/request-metadata.type';
import type { RequestWithId } from '../types/request-with-id.type';

export const CurrentRequestMetadata = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestMetadata => {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      requestId: request.requestId,
    };
  },
);
