import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

void main() {
  group('PartnerPublicProfileEntity', () {
    test('parses real backend discovery JSON correctly', () {
      final json = {
        'id': 'p-12345',
        'displayName': 'Lê Hoàng Yến',
        'avatarUrl': 'https://example.com/avatar.jpg',
        'biography': 'Chuyên viên chăm sóc sắc đẹp tận tâm với 5 năm kinh nghiệm.',
        'experienceYears': 5,
        'serviceAreaName': 'Thảo Điền, TP. Thủ Đức',
        'serviceRadiusKm': 7,
        'online': true,
        'stats': {
          'rating': 4.9,
          'reviewCount': 42,
          'completedOrdersCount': 128,
          'acceptanceRate': 99.2,
          'onTimeRate': 98.8,
        },
        'services': [
          {
            'id': 'ps-1',
            'priceAmount': 250000,
            'durationMinutes': 60,
            'service': {
              'id': 's-1',
              'name': 'Chăm sóc da mặt chuyên sâu',
              'slug': 'cham-soc-da-mat',
              'coverImageUrl': 'https://example.com/skin.jpg',
              'category': {
                'name': 'Chăm sóc da',
                'slug': 'skin-care',
              },
            },
          },
          {
            'id': 'ps-2',
            'priceAmount': 180000,
            'durationMinutes': 45,
            'service': {
              'id': 's-2',
              'name': 'Làm móng Gel Hàn Quốc',
              'slug': 'lam-mong-gel',
              'iconUrl': 'brush',
              'category': {
                'name': 'Làm móng',
                'slug': 'nail',
              },
            },
          },
        ],
        'reviews': [
          {
            'id': 'rev-1',
            'rating': 5,
            'comment': 'Dịch vụ rất chu đáo và chuyên nghiệp!',
            'createdAt': '2026-10-24T10:00:00.000Z',
            'customerName': 'Ngọc Trâm',
            'customerAvatar': 'https://example.com/cust1.jpg',
          },
        ],
        'portfolio': [
          {
            'id': 'post-1',
            'title': 'Bộ nail mùa thu sang trọng',
            'imageUrl': 'https://example.com/photo1.jpg',
            'likesCount': 15,
          },
        ],
      };

      final profile = PartnerPublicProfileEntity.fromJson(json);

      expect(profile.id, 'p-12345');
      expect(profile.displayName, 'Lê Hoàng Yến');
      expect(profile.avatarUrl, 'https://example.com/avatar.jpg');
      expect(profile.biography, contains('tận tâm'));
      expect(profile.experienceYears, 5);
      expect(profile.serviceAreaName, 'Thảo Điền, TP. Thủ Đức');
      expect(profile.serviceRadiusKm, 7);
      expect(profile.isOnline, isTrue);

      expect(profile.rating, 4.9);
      expect(profile.reviewCount, 42);
      expect(profile.completedOrdersCount, 128);
      expect(profile.acceptanceRate, 99.2);
      expect(profile.onTimeRate, 98.8);

      expect(profile.services.length, 2);
      expect(profile.services[0].name, 'Chăm sóc da mặt chuyên sâu');
      expect(profile.services[0].categoryName, 'Chăm sóc da');
      expect(profile.services[0].priceAmount, 250000);
      expect(profile.services[0].durationMinutes, 60);
      expect(profile.services[1].iconUrl, 'brush');

      expect(profile.categories, ['Chăm sóc da', 'Làm móng']);
      expect(profile.startingPrice, 180000); // Giá thấp nhất là 180.000 đ

      expect(profile.reviews.length, 1);
      expect(profile.reviews[0].customerName, 'Ngọc Trâm');
      expect(profile.reviews[0].rating, 5);

      expect(profile.portfolio.length, 1);
      expect(profile.portfolio[0].title, 'Bộ nail mùa thu sang trọng');
      expect(profile.portfolio[0].likesCount, 15);
    });

    test('handles empty or missing fields safely without mock fallbacks', () {
      final json = <String, dynamic>{};
      final profile = PartnerPublicProfileEntity.fromJson(json);

      expect(profile.id, '');
      expect(profile.services, isEmpty);
      expect(profile.reviews, isEmpty);
      expect(profile.portfolio, isEmpty);
      expect(profile.categories, isEmpty);
      expect(profile.startingPrice, 0);
    });
  });
}
