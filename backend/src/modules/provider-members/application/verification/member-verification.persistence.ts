import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const memberVerificationInclude = {
  documents: {
    where: { supersededAt: null },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProviderMemberVerificationInclude;
export type MemberVerification = Prisma.ProviderMemberVerificationGetPayload<{
  include: typeof memberVerificationInclude;
}>;

export async function lockVerificationMember(
  tx: Prisma.TransactionClient,
  memberId: string,
  userId?: string,
) {
  const candidate = await tx.providerMember.findFirst({
    where: { id: memberId, ...(userId ? { userId } : {}) },
    select: { providerId: true, userId: true },
  });
  if (!candidate) throw new NotFoundException('Không tìm thấy thành viên.');
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${candidate.providerId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${candidate.userId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "provider_members" WHERE "id" = ${memberId} FOR UPDATE`,
  );
  const member = await tx.providerMember.findUniqueOrThrow({
    where: { id: memberId },
    include: {
      provider: { select: { providerType: true, status: true } },
      user: { select: { status: true } },
    },
  });
  if (member.status === 'LEFT')
    throw new ConflictException('Thành viên đã rời tổ chức.');
  if (member.provider.providerType !== 'ORGANIZATION')
    throw new ForbiddenException(
      'Hồ sơ cá nhân sử dụng quy trình xét duyệt đối tác hiện có.',
    );
  return member;
}

export function assertMemberCanVerify(
  member: Awaited<ReturnType<typeof lockVerificationMember>>,
) {
  if (
    member.status === 'SUSPENDED' ||
    member.provider.status === 'SUSPENDED' ||
    member.user.status !== 'ACTIVE'
  ) {
    throw new ForbiddenException('Thành viên hoặc tổ chức đang bị hạn chế.');
  }
}

export function assertVerificationEditable(verification: { status: string }) {
  if (!['DRAFT', 'NEEDS_CHANGES'].includes(verification.status))
    throw new ConflictException(
      'Hồ sơ đã gửi hoặc đã được xử lý, không thể sửa.',
    );
}

export async function currentVerification(
  tx: Prisma.TransactionClient,
  member: { id: string; membershipVersion: number },
) {
  const verification = await tx.providerMemberVerification.findUnique({
    where: {
      memberId_membershipVersion: {
        memberId: member.id,
        membershipVersion: member.membershipVersion,
      },
    },
    include: memberVerificationInclude,
  });
  if (!verification)
    throw new NotFoundException('Chưa có hồ sơ xác minh cho lần gia nhập này.');
  return verification;
}

export function assertReviewRevision(
  verification: { id: string; status: string; revisionNumber: number },
  revisionNumber: number,
  verificationId: string,
) {
  if (
    verification.id !== verificationId ||
    verification.status !== 'PENDING_REVIEW' ||
    verification.revisionNumber !== revisionNumber
  )
    throw new ConflictException(
      'Phiên bản hồ sơ đã thay đổi hoặc không còn chờ xét duyệt.',
    );
}

export const safeMemberDocumentSelect = {
  id: true,
  type: true,
  providerServiceId: true,
  expiresAt: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.ProviderMemberDocumentSelect;

export function presentVerification(profile: MemberVerification) {
  return {
    id: profile.id,
    memberId: profile.memberId,
    membershipVersion: profile.membershipVersion,
    status: profile.status,
    revisionNumber: profile.revisionNumber,
    legalFullName: profile.legalFullName,
    birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
    gender: profile.gender,
    experienceYears: profile.experienceYears,
    nationalIdMasked: profile.nationalIdLast4
      ? `********${profile.nationalIdLast4}`
      : null,
    requestedProviderServiceIds: profile.requestedProviderServiceIds,
    termsVersion: profile.termsVersion,
    termsAcceptedAt: profile.termsAcceptedAt,
    submittedAt: profile.submittedAt,
    reviewedAt: profile.reviewedAt,
    decisionReason: profile.decisionReason,
    documents: profile.documents.map((d) => ({
      id: d.id,
      type: d.type,
      providerServiceId: d.providerServiceId,
      expiresAt: d.expiresAt,
      status: d.status,
      reviewNote: d.reviewNote,
      reviewedAt: d.reviewedAt,
      createdAt: d.createdAt,
    })),
  };
}
