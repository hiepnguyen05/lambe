import { ConflictException } from '@nestjs/common';
import {
  ProviderApplicationStatus,
  ProviderDocumentType,
  ReviewStatus,
} from '@prisma/client';
import { ProviderApplicationDocumentsService } from './provider-application-documents.service';

describe('ProviderApplicationDocumentsService', () => {
  const applicationId = '7a813785-8ce1-4aa6-84fb-92af85c993f6';
  const documentId = '983433c1-3eb9-46ee-8a7d-937709700a49';
  const userId = '6cd8d6ee-c3d4-4aaf-aa9b-9905477a74c2';

  function createContext() {
    const storedDocument = {
      id: documentId,
      applicationId,
      applicationServiceId: null,
      type: ProviderDocumentType.ID_CARD_FRONT,
      fileUrl: 'https://res.cloudinary.test/private.webp',
      publicId: `lambe/provider-applications/${applicationId}/private`,
      fileFormat: 'webp',
      deliveryType: 'authenticated',
      isPublicCandidate: false,
      status: ReviewStatus.PENDING,
      reviewNote: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const providerApplication = {
      findFirst: jest.fn().mockResolvedValue({
        id: applicationId,
        userId,
        status: ProviderApplicationStatus.DRAFT,
        documents: [],
        checks: [],
      }),
    };
    const providerApplicationDocument = {
      create: jest.fn().mockResolvedValue(storedDocument),
      findFirst: jest.fn().mockResolvedValue(storedDocument),
    };
    const providerApplicationCheck = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const transaction = {
      providerApplication,
      providerApplicationService: { findFirst: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ id: applicationId }]),
      providerApplicationDocument,
      providerApplicationCheck,
    };
    const prisma = {
      providerApplication,
      providerApplicationDocument,
      providerApplicationCheck,
      providerApplicationService: { findFirst: jest.fn() },
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const mediaStorage = {
      uploadImage: jest.fn(),
      uploadPrivateImage: jest.fn().mockResolvedValue({
        url: 'http://res.cloudinary.test/private.webp',
        secureUrl: storedDocument.fileUrl,
        publicId: storedDocument.publicId,
        format: 'webp',
        resourceType: 'image',
        deliveryType: 'authenticated' as const,
      }),
      createPrivateDownloadUrl: jest
        .fn()
        .mockReturnValue('https://signed.example.test/temporary'),
      deleteImage: jest.fn().mockResolvedValue(true),
    };
    return {
      service: new ProviderApplicationDocumentsService(
        prisma as never,
        audit as never,
        mediaStorage,
      ),
      prisma,
      audit,
      mediaStorage,
      storedDocument,
    };
  }

  it('uploads KYC privately and omits storage secrets from the response', async () => {
    const { service, mediaStorage } = createContext();

    const result = await service.upload(
      applicationId,
      userId,
      ProviderDocumentType.ID_CARD_FRONT,
      {},
      Buffer.from('image'),
    );

    expect(mediaStorage.uploadPrivateImage).toHaveBeenCalled();
    expect(result.data).not.toHaveProperty('fileUrl');
    expect(result.data).not.toHaveProperty('publicId');
    expect(result.data).not.toHaveProperty('deliveryType');
  });

  it('issues a signed URL only after ownership validation and records access', async () => {
    const { service, prisma, audit, mediaStorage } = createContext();
    const request = { requestId: 'request-id', ipAddress: '127.0.0.1' };

    await expect(
      service.getApplicantAccess(applicationId, documentId, userId, request),
    ).resolves.toEqual({
      success: true,
      data: { url: 'https://signed.example.test/temporary' },
    });
    const [ownershipQuery] = prisma.providerApplicationDocument.findFirst.mock
      .calls[0] as unknown as [{ where: { application: { userId: string } } }];
    expect(ownershipQuery.where.application).toEqual({ userId });
    expect(mediaStorage.createPrivateDownloadUrl).toHaveBeenCalledWith(
      expect.any(String),
      'webp',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: userId,
        action: 'KYC_DOCUMENT_ACCESSED',
      }),
      request,
    );
  });

  it('refuses to issue access URLs for legacy public documents', async () => {
    const { service, prisma, mediaStorage, storedDocument } = createContext();
    prisma.providerApplicationDocument.findFirst.mockResolvedValue({
      ...storedDocument,
      deliveryType: 'upload',
    });

    await expect(
      service.getApplicantAccess(applicationId, documentId, userId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mediaStorage.createPrivateDownloadUrl).not.toHaveBeenCalled();
  });

  it('cleans up an upload when the application became pending during the network request', async () => {
    const { service, prisma, mediaStorage } = createContext();
    prisma.providerApplication.findFirst
      .mockResolvedValueOnce({
        id: applicationId,
        userId,
        status: ProviderApplicationStatus.DRAFT,
        documents: [],
        checks: [],
      })
      .mockResolvedValue({
        id: applicationId,
        userId,
        status: ProviderApplicationStatus.PENDING_REVIEW,
        documents: [],
        checks: [],
      });
    await expect(
      service.upload(
        applicationId,
        userId,
        ProviderDocumentType.ID_CARD_FRONT,
        {},
        Buffer.from('image'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.providerApplicationDocument.create).not.toHaveBeenCalled();
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith(
      expect.any(String),
      'authenticated',
    );
  });
});
