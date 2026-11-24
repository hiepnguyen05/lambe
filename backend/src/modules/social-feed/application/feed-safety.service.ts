import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { Interval } from '@nestjs/schedule';

export function feedSafetySignals(text: string) {
  const normalized = text
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');
  const labels: string[] = [];
  if (/https?:\/\/|www\./.test(normalized)) labels.push('EXTERNAL_LINK');
  if (/(?:\+?84|0)(?:[\s.-]*\d){9,10}\b/.test(normalized))
    labels.push('PHONE_NUMBER');
  if (
    /chua (khoi|dut diem)|cam ket.*100%|tri.*vinh vien|khong.*tac dung phu/.test(
      normalized,
    )
  )
    labels.push('MEDICAL_CLAIM');
  if (
    /(?:chuyen tien|dat coc).*(?:telegram|zalo|tai khoan)|(?:telegram|zalo).*(?:chuyen tien|dat coc)/.test(
      normalized,
    )
  )
    labels.push('PAYMENT_OFF_PLATFORM');
  if (/(.)\1{12,}/u.test(normalized)) labels.push('REPETITIVE_TEXT');
  return {
    score: Math.min(
      100,
      labels.reduce(
        (sum, l) =>
          sum +
          (['MEDICAL_CLAIM', 'PAYMENT_OFF_PLATFORM'].includes(l) ? 40 : 15),
        0,
      ),
    ),
    labels,
  };
}

@Injectable()
export class FeedSafetyService {
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  signals(text: string) {
    return this.config.get<boolean>('cache.feedSafetyEnabled', true)
      ? feedSafetySignals(text)
      : { score: 0, labels: [] as string[] };
  }
  async flagReport(postId: string, reason: string) {
    const score =
      reason === 'PRIVACY'
        ? 90
        : reason === 'INAPPROPRIATE'
          ? 80
          : reason === 'MISLEADING'
            ? 60
            : 30;
    await this.prisma.feedPost.updateMany({
      where: { id: postId, safetyScore: { lt: score } },
      data: { safetyScore: score },
    });
  }
  static hashes(files: Express.Multer.File[]) {
    return files.map((f) =>
      createHash('sha256').update(f.buffer).digest('hex'),
    );
  }
  async assertProvider(
    providerId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (
      (
        await tx.providerProfile.findUnique({
          where: { id: providerId },
          select: { feedPostingBlocked: true },
        })
      )?.feedPostingBlocked
    )
      throw new ForbiddenException('Hồ sơ đang bị hạn chế đăng Feed.');
  }
  async assertAllowed(
    hashes: string[],
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (
      await tx.feedBlockedMedia.findFirst({
        where: { sha256: { in: hashes }, active: true },
        select: { sha256: true },
      })
    )
      throw new BadRequestException(
        'Media trùng nội dung đã bị xác nhận vi phạm.',
      );
  }
  async assertComment(userId: string, text: string) {
    if (
      await this.prisma.feedComment.findFirst({
        where: {
          userId,
          text,
          createdAt: { gt: new Date(Date.now() - 60000) },
          deletedAt: null,
        },
        select: { id: true },
      })
    )
      throw new BadRequestException(
        'Bạn vừa gửi nội dung này. Hãy chờ trước khi gửi lại.',
      );
  }
  async flagEngagement(postId: string) {
    if (!this.config.get<boolean>('cache.feedSafetyEnabled', true)) return;
    if (
      (await this.prisma.feedEngagement.count({
        where: {
          postId,
          kind: 'VIEW',
          createdAt: { gt: new Date(Date.now() - 300000) },
        },
      })) >= 20
    )
      await this.prisma.feedPost.updateMany({
        where: {
          id: postId,
          safetyCheckedAt: { lt: new Date(Date.now() - 60000) },
        },
        data: { safetyCheckedAt: null },
      });
  }
  @Interval(60000)
  async rescan() {
    if (
      this.running ||
      !this.config.get<boolean>('cache.feedSafetyEnabled', true)
    )
      return;
    this.running = true;
    try {
      const posts = await this.prisma.feedPost.findMany({
        where: {
          status: { not: 'DELETED' },
          OR: [
            { safetyCheckedAt: null },
            {
              reports: { some: { resolution: null } },
              safetyCheckedAt: { lt: new Date(Date.now() - 3600000) },
            },
          ],
        },
        orderBy: [
          { safetyCheckedAt: { sort: 'asc', nulls: 'first' } },
          { id: 'asc' },
        ],
        take: 50,
        select: {
          id: true,
          caption: true,
          revisionNumber: true,
          reports: {
            where: { resolution: null },
            take: 50,
            select: { reason: true },
          },
        },
      });
      for (const p of posts) {
        const signals = feedSafetySignals(p.caption);
        for (const r of p.reports)
          signals.score = Math.max(
            signals.score,
            r.reason === 'PRIVACY'
              ? 90
              : r.reason === 'INAPPROPRIATE'
                ? 80
                : r.reason === 'MISLEADING'
                  ? 60
                  : 30,
          );
        await this.prisma.feedPost.updateMany({
          where: { id: p.id, revisionNumber: p.revisionNumber },
          data: {
            safetyScore: signals.score,
            safetyLabels: signals.labels,
            safetyCheckedAt: new Date(),
          },
        });
      }
    } finally {
      this.running = false;
    }
  }
}
