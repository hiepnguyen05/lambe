import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  memberOfferingInclude,
  memberServiceBlocker,
  memberVerificationForServing,
} from '../../../provider-members/application/capabilities/member-service-eligibility';

@Injectable()
export class FeedAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    userId: string,
    memberId?: string,
    tx: Prisma.TransactionClient = this.prisma,
    lock = false,
  ) {
    const owned = memberId
      ? null
      : await tx.providerProfile.findUnique({
          where: { userId },
          select: { id: true },
        });
    const member = await tx.providerMember.findFirst({
      where: memberId
        ? { id: memberId, userId }
        : owned
          ? { providerId: owned.id, userId, role: 'OWNER' }
          : {
              userId,
              role: 'WORKER',
              status: 'ACTIVE',
              canProvideServices: true,
            },
      select: { id: true, providerId: true },
    });
    const providerId = member?.providerId ?? owned?.id;
    if (!providerId || (memberId && !member))
      throw new ForbiddenException('Không có quyền đăng bài cho đối tác này.');
    if (lock) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM provider_profiles WHERE id=${providerId} FOR SHARE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id=${userId} OR id=(SELECT "userId" FROM provider_profiles WHERE id=${providerId}) ORDER BY id FOR SHARE`,
      );
      if (member)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM provider_members WHERE id=${member.id} FOR SHARE`,
        );
    }
    const provider = await tx.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      include: { user: { select: { status: true } } },
    });
    const current = member
      ? await tx.providerMember.findUniqueOrThrow({
          where: { id: member.id },
          include: {
            user: { select: { status: true, fullName: true, avatarUrl: true } },
          },
        })
      : null;
    if (
      provider.status !== 'ACTIVE' ||
      provider.user.status !== 'ACTIVE' ||
      (provider.providerType === 'ORGANIZATION' &&
        (!current ||
          current.status !== 'ACTIVE' ||
          current.user.status !== 'ACTIVE' ||
          (current.role === 'OWNER'
            ? provider.userId !== userId
            : !current.canProvideServices)))
    )
      throw new ForbiddenException(
        'Đối tác hoặc thành viên chưa đủ điều kiện đăng bài.',
      );
    if (provider.providerType === 'INDIVIDUAL' && provider.userId !== userId)
      throw new ForbiddenException('Không có quyền đăng bài.');
    return {
      providerId,
      providerType: provider.providerType,
      userId,
      memberId: provider.providerType === 'ORGANIZATION' ? current!.id : null,
      membershipVersion:
        provider.providerType === 'ORGANIZATION'
          ? current!.membershipVersion
          : null,
      role: current?.role ?? 'OWNER',
      displayName:
        current?.role === 'OWNER'
          ? provider.displayName
          : (current?.displayName ??
            current?.user.fullName ??
            provider.displayName),
      avatarUrl:
        current?.role === 'OWNER'
          ? provider.avatarUrl
          : (current?.avatarUrl ?? current?.user.avatarUrl ?? null),
    };
  }

  async assertServices(
    actor: FeedActor,
    ids: string[],
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (!ids.length || new Set(ids).size !== ids.length)
      throw new BadRequestException('Chọn 1–5 dịch vụ khác nhau.');
    const offerings = await tx.providerService.findMany({
      where: {
        id: { in: ids },
        providerId: actor.providerId,
        status: 'ACTIVE',
        service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
      },
      include: memberOfferingInclude,
    });
    if (offerings.length !== ids.length)
      throw new BadRequestException(
        'Dịch vụ phải thuộc đối tác và đang hoạt động.',
      );
    if (actor.role !== 'WORKER' || !actor.memberId) return;
    const [assignments, profile] = await Promise.all([
      tx.providerMemberService.findMany({
        where: {
          memberId: actor.memberId,
          membershipVersion: actor.membershipVersion!,
          enabled: true,
          providerServiceId: { in: ids },
        },
      }),
      memberVerificationForServing(tx, {
        id: actor.memberId,
        membershipVersion: actor.membershipVersion!,
      }),
    ]);
    if (
      assignments.length !== ids.length ||
      offerings.some((offering) => memberServiceBlocker(profile, offering))
    )
      throw new ForbiddenException(
        'Chỉ được gắn dịch vụ đã được cấp và còn đủ chuyên môn.',
      );
  }

  async publishingContext(userId: string) {
    const actor = await this.resolve(userId);
    const activeOffering = {
      providerId: actor.providerId,
      status: 'ACTIVE' as const,
      service: {
        status: 'ACTIVE' as const,
        category: { status: 'ACTIVE' as const },
      },
    };
    if (actor.role !== 'WORKER' || !actor.memberId) {
      const offerings = await this.prisma.providerService.findMany({
        where: activeOffering,
        include: memberOfferingInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return {
        success: true,
        data: {
          providerId: actor.providerId,
          memberId: actor.memberId,
          offerings: offerings.map((offering) => ({
            ...offering,
            blockerCode: null,
          })),
        },
      };
    }
    const [assignments, profile] = await Promise.all([
      this.prisma.providerMemberService.findMany({
        where: {
          memberId: actor.memberId,
          membershipVersion: actor.membershipVersion!,
          enabled: true,
          providerService: activeOffering,
        },
        include: { providerService: { include: memberOfferingInclude } },
        orderBy: { createdAt: 'asc' },
      }),
      memberVerificationForServing(this.prisma, {
        id: actor.memberId,
        membershipVersion: actor.membershipVersion!,
      }),
    ]);
    return {
      success: true,
      data: {
        providerId: actor.providerId,
        memberId: actor.memberId,
        offerings: assignments
          .map((assignment) => assignment.providerService)
          .filter((offering) => !memberServiceBlocker(profile, offering))
          .map((offering) => ({ ...offering, blockerCode: null })),
      },
    };
  }

  async managedScope(userId: string): Promise<Prisma.FeedPostWhereInput> {
    const [owned, memberships] = await Promise.all([
      this.prisma.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
      this.prisma.providerMember.findMany({
        where: {
          userId,
          role: 'WORKER',
          status: 'ACTIVE',
          canProvideServices: true,
          provider: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
        },
        select: { id: true, membershipVersion: true },
      }),
    ]);
    if (!owned && memberships.length === 0) return { id: { in: [] } };
    return {
      OR: [
        ...(owned ? [{ providerId: owned.id, provider: { userId } }] : []),
        ...memberships.map((m) => ({
          authorMemberId: m.id,
          authorMembershipVersion: m.membershipVersion,
          authorMember: {
            userId,
            status: 'ACTIVE' as const,
            canProvideServices: true,
            membershipVersion: m.membershipVersion,
            provider: {
              status: 'ACTIVE' as const,
              user: { status: 'ACTIVE' as const },
            },
          },
        })),
      ],
    };
  }

  async lockPost(tx: Prisma.TransactionClient, id: string, actor: FeedActor) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM feed_posts WHERE id=${id} AND "providerId"=${actor.providerId} FOR UPDATE`,
    );
    const post = await tx.feedPost.findFirst({
      where: { id, providerId: actor.providerId, status: { not: 'DELETED' } },
      include: { services: { select: { providerServiceId: true } } },
    });
    if (
      !post ||
      (actor.role === 'WORKER' &&
        (post.authorMemberId !== actor.memberId ||
          post.authorMembershipVersion !== actor.membershipVersion))
    )
      throw new NotFoundException('Không tìm thấy bài đăng được phép quản lý.');
    return post;
  }

  async forPost(tx: Prisma.TransactionClient, userId: string, id: string) {
    const candidate = await tx.feedPost.findUnique({
      where: { id },
      include: {
        provider: { select: { userId: true } },
        authorMember: { select: { userId: true } },
      },
    });
    if (
      !candidate ||
      candidate.status === 'DELETED' ||
      (candidate.provider.userId !== userId &&
        candidate.authorMember?.userId !== userId)
    )
      throw new NotFoundException('Không tìm thấy bài đăng được phép quản lý.');
    const actor = await this.resolve(
      userId,
      candidate.provider.userId === userId
        ? undefined
        : candidate.authorMemberId!,
      tx,
      true,
    );
    if (actor.providerId !== candidate.providerId)
      throw new NotFoundException('Không tìm thấy bài đăng được phép quản lý.');
    return { actor, candidate };
  }

  async author(
    tx: Prisma.TransactionClient,
    post: {
      providerId: string;
      authorMemberId: string | null;
      authorMembershipVersion: number | null;
    },
    owner: FeedActor,
  ) {
    if (!post.authorMemberId) return owner;
    const member = await tx.providerMember.findUnique({
      where: { id: post.authorMemberId },
      select: { userId: true },
    });
    if (!member) throw new ConflictException('Không còn tác giả hợp lệ.');
    const actor = await this.resolve(
      member.userId,
      post.authorMemberId,
      tx,
      true,
    );
    if (
      actor.providerId !== post.providerId ||
      actor.membershipVersion !== post.authorMembershipVersion
    )
      throw new ConflictException(
        'Bài thuộc nhiệm kỳ cũ; không thể đăng lại với nhiệm kỳ mới.',
      );
    return actor;
  }
}

export type FeedActor = Awaited<ReturnType<FeedAccessService['resolve']>>;
