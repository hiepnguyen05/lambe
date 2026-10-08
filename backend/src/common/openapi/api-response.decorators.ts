import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

type SchemaObject = Record<string, unknown>;

type ExampleValue =
  | string
  | number
  | boolean
  | null
  | ExampleValue[]
  | { [key: string]: ExampleValue };

interface ApiWrappedResponseOptions {
  description: string;
  data: ExampleValue;
  message?: string;
  meta?: ExampleValue;
}

function schemaFromExample(example: ExampleValue): SchemaObject {
  if (example === null) return { nullable: true };
  if (Array.isArray(example)) {
    return {
      type: 'array',
      items:
        example.length > 0 ? schemaFromExample(example[0]) : { type: 'object' },
    };
  }
  if (typeof example === 'object') {
    const properties = Object.entries(example).reduce<
      Record<string, SchemaObject>
    >((schemas, [key, value]) => {
      schemas[key] = schemaFromExample(value);
      return schemas;
    }, {});

    return { type: 'object', properties };
  }
  if (typeof example === 'number') {
    return Number.isInteger(example) ? { type: 'integer' } : { type: 'number' };
  }
  return { type: typeof example };
}

function wrappedResponseSchema(
  statusCode: HttpStatus,
  data: ExampleValue,
  message?: string,
  meta?: ExampleValue,
): SchemaObject {
  const properties: Record<string, SchemaObject> = {
    statusCode: { type: 'integer', example: statusCode },
    success: { type: 'boolean', example: true },
    data: schemaFromExample(data),
    timestamp: {
      type: 'string',
      format: 'date-time',
      example: '2026-09-29T10:30:00.000Z',
    },
  };
  const example: Record<string, unknown> = {
    statusCode,
    success: true,
    data,
    timestamp: '2026-09-29T10:30:00.000Z',
  };

  if (message) {
    properties.message = { type: 'string', example: message };
    example.message = message;
  }
  if (meta !== undefined) {
    properties.meta = schemaFromExample(meta);
    example.meta = meta;
  }

  return {
    type: 'object',
    properties,
    example,
  };
}

function errorSchema(
  statusCode: HttpStatus,
  error: string,
  message: string | string[],
): SchemaObject {
  return {
    type: 'object',
    properties: {
      message: Array.isArray(message)
        ? { type: 'array', items: { type: 'string' } }
        : { type: 'string' },
      error: { type: 'string' },
      statusCode: { type: 'integer' },
    },
    example: { message, error, statusCode },
  };
}

export function ApiStandardOk(options: ApiWrappedResponseOptions) {
  return ApiOkResponse({
    description: options.description,
    schema: wrappedResponseSchema(
      HttpStatus.OK,
      options.data,
      options.message,
      options.meta,
    ),
  });
}

export function ApiStandardCreated(options: ApiWrappedResponseOptions) {
  return ApiCreatedResponse({
    description: options.description,
    schema: wrappedResponseSchema(
      HttpStatus.CREATED,
      options.data,
      options.message,
      options.meta,
    ),
  });
}

export function ApiValidationError() {
  return ApiBadRequestResponse({
    description: 'Dữ liệu gửi lên không hợp lệ.',
    schema: errorSchema(HttpStatus.BAD_REQUEST, 'Bad Request', [
      'Trường dữ liệu không hợp lệ.',
    ]),
  });
}

export function ApiAuthenticationErrors() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Thiếu token, token hết hạn hoặc không hợp lệ.',
      schema: errorSchema(
        HttpStatus.UNAUTHORIZED,
        'Unauthorized',
        'Unauthorized',
      ),
    }),
  );
}

export function ApiInternalAuthorizationErrors() {
  return applyDecorators(
    ApiAuthenticationErrors(),
    ApiForbiddenResponse({
      description: 'Tài khoản nội bộ không có quyền thực hiện thao tác này.',
      schema: errorSchema(
        HttpStatus.FORBIDDEN,
        'Forbidden',
        'Không có quyền thực hiện thao tác này.',
      ),
    }),
  );
}

export function ApiNotFoundError(resource = 'Tài nguyên') {
  return ApiNotFoundResponse({
    description: `${resource} không tồn tại hoặc không thuộc quyền truy cập.`,
    schema: errorSchema(
      HttpStatus.NOT_FOUND,
      'Not Found',
      `${resource} không tồn tại.`,
    ),
  });
}

export function ApiConflictError(
  message = 'Dữ liệu đã tồn tại hoặc xung đột.',
) {
  return ApiConflictResponse({
    description: message,
    schema: errorSchema(HttpStatus.CONFLICT, 'Conflict', message),
  });
}

export function ApiRateLimitError() {
  return ApiTooManyRequestsResponse({
    description: 'Vượt giới hạn số lượng request cho phép.',
    schema: errorSchema(
      HttpStatus.TOO_MANY_REQUESTS,
      'Too Many Requests',
      'ThrottlerException: Too Many Requests',
    ),
  });
}

export function ApiDependencyUnavailableError(
  message = 'Dịch vụ phụ thuộc tạm thời không khả dụng.',
) {
  return ApiServiceUnavailableResponse({
    description: message,
    schema: errorSchema(
      HttpStatus.SERVICE_UNAVAILABLE,
      'Service Unavailable',
      message,
    ),
  });
}
