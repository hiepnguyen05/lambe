import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { INTERNAL_ROLES_KEY } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import { OrderSafetyEvidenceService } from '../application/safety/order-safety-evidence.service';
import { OrderSafetyService } from '../application/safety/order-safety.service';
import { OrderSafetyController } from './order-safety.controller';
import { SupportOrderSafetyController } from './support-order-safety.controller';

describe('order safety API contract', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderSafetyController, SupportOrderSafetyController],
      providers: [
        { provide: OrderSafetyService, useValue: {} },
        { provide: OrderSafetyEvidenceService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InternalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InternalRolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
  });
  afterAll(async () => app?.close());

  it('documents both SOS routes without an evidence requirement', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Order safety')
        .addBearerAuth(undefined, 'user-token')
        .addBearerAuth(undefined, 'internal-token')
        .build(),
    );
    for (const path of [
      '/api/me/orders/{id}/safety/sos',
      '/api/me/provider/orders/{id}/safety/sos',
    ]) {
      const endpoint = document.paths[path].post!;
      expect(endpoint.responses).toHaveProperty('200');
      expect(endpoint.security).toEqual([{ 'user-token': [] }]);
      expect(endpoint.requestBody).not.toEqual(
        expect.objectContaining({ required: true }),
      );
    }
    expect(document.paths['/api/admin/safety/incidents'].get!.security).toEqual(
      [{ 'internal-token': [] }],
    );
  });

  it('limits the internal safety queue to admin and support', () => {
    expect(
      Reflect.getMetadata(INTERNAL_ROLES_KEY, SupportOrderSafetyController),
    ).toEqual([InternalRole.ADMIN, InternalRole.SUPPORT]);
  });
});
