import {
  providerSearchExample,
  uuidExample,
} from '../../../common/openapi/api-examples';

export const aiConsultationResultExample = {
  clientMessageId: uuidExample,
  reply:
    'Mình đã tìm được một số chuyên viên phù hợp. Bạn có thể xem hồ sơ và chọn người mình thấy ưng ý.',
  intent: 'PROVIDER_SEARCH',
  suggestedServices: [
    {
      id: uuidExample,
      name: 'Cắt tóc nam',
      slug: 'cat-toc-nam',
      minPriceAmount: 100000,
      maxPriceAmount: 300000,
      currencyCode: 'VND',
    },
  ],
  suggestedProviders: providerSearchExample.data,
  suggestedPosts: [
    {
      id: uuidExample,
      provider: {
        id: uuidExample,
        displayName: 'Minh Hair Artist',
        avatarUrl: null,
      },
      service: { id: uuidExample, name: 'Cắt tóc nam' },
      mediaKind: 'IMAGE',
      thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      mediaUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    },
  ],
  nextActions: [
    {
      type: 'VIEW_INSPIRATION',
      label: 'Xem mẫu tham khảo',
      targetId: uuidExample,
    },
    { type: 'VIEW_SERVICE', label: 'Xem dịch vụ', targetId: uuidExample },
    { type: 'FIND_PROVIDER', label: 'Xem chuyên viên', targetId: uuidExample },
    { type: 'CREATE_QUOTE', label: 'Xem báo giá' },
  ] as Record<string, string>[],
  followUpQuestion: null,
  conversionPrompt: null,
  nextAction: 'SHOW_PROVIDERS',
  degradedMode: false,
  citations: [],
};
