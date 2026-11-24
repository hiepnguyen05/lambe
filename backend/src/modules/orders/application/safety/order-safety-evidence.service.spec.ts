import { NotFoundException } from '@nestjs/common';
import { OrderSafetyEvidenceService } from './order-safety-evidence.service';

describe('OrderSafetyEvidenceService', () => {
  it('does not upload an image for someone who has not reported the incident', async () => {
    const storage = { uploadPrivateImage: jest.fn() };
    const prisma = {
      orderSafetyIncident: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new OrderSafetyEvidenceService(
      prisma as never,
      storage as never,
      {} as never,
    );

    await expect(
      service.upload('stranger', 'order-1', Buffer.from('image')),
    ).rejects.toThrow(NotFoundException);
    expect(storage.uploadPrivateImage).not.toHaveBeenCalled();
  });

  it('only issues the uploader a private evidence URL', async () => {
    const prisma = {
      orderSafetyEvidence: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const storage = { createPrivateDownloadUrl: jest.fn() };
    const service = new OrderSafetyEvidenceService(
      prisma as never,
      storage as never,
      {} as never,
    );

    await expect(
      service.ownDownload('other-user', 'order-1', 'evidence-1'),
    ).rejects.toThrow(NotFoundException);
    const lookup = (
      prisma.orderSafetyEvidence.findFirst.mock.calls as unknown[][]
    )[0]?.[0];
    expect(lookup).toMatchObject({ where: { uploadedById: 'other-user' } });
    expect(storage.createPrivateDownloadUrl).not.toHaveBeenCalled();
  });
});
