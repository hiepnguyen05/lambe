import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeedPostsService } from '../application/feed-posts.service';
import { FeedQueryService } from '../application/feed-query.service';
import { FeedSocialService } from '../application/feed-social.service';
import { OrganizationFeedReviewService } from '../application/organization/organization-feed-review.service';
import { MyFeedController } from './my-feed.controller';
import { OrganizationFeedController } from './organization-feed.controller';
import { PublicFeedController } from './public-feed.controller';
import { FeedAccessService } from '../application/organization/feed-access.service';
import { FeedReviewService } from '../application/feed-review.service';
import { FeedOperationsService } from '../application/feed-operations.service';

describe('organization feed OpenAPI contract', () => {
  let app: INestApplication, document: OpenAPIObject;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        MyFeedController,
        OrganizationFeedController,
        PublicFeedController,
      ],
      providers: [
        FeedPostsService,
        FeedQueryService,
        FeedSocialService,
        OrganizationFeedReviewService,
        FeedAccessService,
        FeedReviewService,
        FeedOperationsService,
      ].map((provide) => ({ provide, useValue: {} })),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'user-token').build(),
    );
    await app.init();
  });
  afterAll(async () => app?.close());

  it('documents authenticated discovery without exposing management metadata', () => {
    const operation = document.paths['/api/me/feed/posts'].get!;
    expect(operation.security).toEqual([{ 'user-token': [] }]);
    for (const code of ['200', '400', '401'])
      expect(operation.responses).toHaveProperty(code);
    const response = JSON.stringify(operation.responses['200']);
    expect(response).toContain('viewer');
    expect(response).toContain('nextCursor');
    expect(response).not.toContain('organizationReview');
  });

  it('documents the owner decision, optimistic revision and user authentication', () => {
    const operation =
      document.paths['/api/me/feed/posts/{id}/organization-review'].post!;
    expect(operation.security).toEqual([{ 'user-token': [] }]);
    for (const status of ['200', '400', '401', '403', '404', '409'])
      expect(operation.responses).toHaveProperty(status);
    const body = document.components!.schemas!.ReviewOrganizationFeedPostDto;
    expect(body).toMatchObject({ required: ['decision', 'revisionNumber'] });
    expect(
      document.paths['/api/me/feed/posts/{id}/manage'].get!.responses,
    ).toHaveProperty('200');
  });

  it('documents author snapshots publicly and review metadata only in management responses', () => {
    const published = JSON.stringify(
      document.paths['/api/feed/posts/{id}'].get!.responses['200'],
    );
    expect(published).toContain('authorMember');
    expect(published).not.toContain('organizationReview');
    const managed = JSON.stringify(
      document.paths['/api/me/feed/posts/{id}/manage'].get!.responses['200'],
    );
    expect(managed).toContain('organizationReview');
    expect(managed).toContain('revisionNumber');
    expect(document.paths['/api/me/feed/posts'].post!.responses).toHaveProperty(
      '201',
    );
    expect(document.paths['/api/me/feed/posts'].post!.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'idempotency-key', required: true }),
      ]),
    );
    expect(document.paths['/api/me/feed/posts/video'].post).toBeDefined();
    expect(document.paths['/api/me/feed/publishing-context'].get).toBeDefined();
  });
});
