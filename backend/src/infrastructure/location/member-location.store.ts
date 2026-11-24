export const MEMBER_LOCATION_STORE = Symbol('MEMBER_LOCATION_STORE');

export interface MemberPosition {
  memberId: string;
  sessionId: string;
  version: number;
  latitude: number;
  longitude: number;
  capturedAtMs: number;
}

export interface MemberLocationStore {
  findNearbyMembers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): Promise<{ memberId: string; distanceKm: number; sessionId: string }[]>;
  saveMemberPosition(position: MemberPosition): Promise<boolean>;
  removeMemberPosition(memberId: string, version: number): Promise<void>;
  getMemberPosition(
    memberId: string,
    sessionId: string,
  ): Promise<{ latitude: number; longitude: number } | null>;
}
