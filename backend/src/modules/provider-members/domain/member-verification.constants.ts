import { ProviderDocumentType } from '@prisma/client';

export const MEMBER_TERMS_VERSION = 'member-2026-10-27';
export const MEMBER_TERMS_TEXT =
  'Tôi xác nhận thông tin và giấy tờ cung cấp là của mình, đồng ý để Lambe kiểm tra hồ sơ tham gia tổ chức. Tôi chỉ thực hiện dịch vụ khi được xác minh và được tổ chức cấp quyền. Tiền mặt nhận từ khách là tiền thu hộ tổ chức; việc trả lương, thưởng do tôi và tổ chức thỏa thuận.';
export const MEMBER_DOCUMENT_TYPES: ProviderDocumentType[] = [
  'PORTRAIT',
  'ID_CARD_FRONT',
  'ID_CARD_BACK',
  'IDENTITY_SELFIE',
  'PROFESSIONAL_CERTIFICATE',
  'PORTFOLIO',
];
