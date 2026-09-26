import { BadRequestException } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import {
  assertServiceStatusTransition,
  assertValidPriceRange,
} from './service-status.policy';

describe('service status policy', () => {
  it('allows supported transitions', () => {
    expect(() =>
      assertServiceStatusTransition(
        ServiceStatus.INACTIVE,
        ServiceStatus.ACTIVE,
      ),
    ).not.toThrow();
    expect(() =>
      assertServiceStatusTransition(
        ServiceStatus.ARCHIVED,
        ServiceStatus.INACTIVE,
      ),
    ).not.toThrow();
  });

  it('rejects unchanged and unsupported transitions', () => {
    expect(() =>
      assertServiceStatusTransition(ServiceStatus.ACTIVE, ServiceStatus.ACTIVE),
    ).toThrow(BadRequestException);
    expect(() =>
      assertServiceStatusTransition(
        ServiceStatus.ARCHIVED,
        ServiceStatus.ACTIVE,
      ),
    ).toThrow(BadRequestException);
  });

  it('validates price ranges', () => {
    expect(() => assertValidPriceRange(50000, 50000)).not.toThrow();
    expect(() => assertValidPriceRange(100000, 50000)).toThrow(
      BadRequestException,
    );
  });
});
