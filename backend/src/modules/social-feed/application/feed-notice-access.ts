import type { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedAccessService } from './organization/feed-access.service';
export async function canReadFeedNotice(
  prisma: PrismaService,
  id: string,
  userId: string,
) {
  const notice = await prisma.feedNotice.findFirst({
    where: { id, userId },
    select: { managed: true, postId: true },
  });
  if (!notice) return false;
  if (!notice.managed) return true;
  const scope = await new FeedAccessService(prisma).managedScope(userId);
  return !!(await prisma.feedPost.findFirst({
    where: { AND: [scope, { id: notice.postId }] },
    select: { id: true },
  }));
}
