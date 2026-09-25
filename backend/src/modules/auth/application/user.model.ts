export interface PublicUserSource {
  id: string;
  phone: string;
  fullName: string | null;
  status: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: PublicUserSource) {
  return {
    id: user.id,
    phone: user.phone,
    fullName: user.fullName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
