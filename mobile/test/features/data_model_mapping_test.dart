import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/address/domain/entities/address_entity.dart';
import 'package:mobile/features/customer/onboarding/domain/entities/onboarding_options_entity.dart';
import 'package:mobile/features/customer/onboarding/domain/entities/onboarding_preferences.dart';
import 'package:mobile/features/provider/registration/data/models/partner_api_model.dart';
import 'package:mobile/features/provider/registration/domain/entities/service_catalog_entity.dart';
import 'package:mobile/features/customer/recommendations/domain/entities/service_recommendations_entity.dart';

void main() {
  test('address JSON conversion stays in the data layer', () {
    const address = AddressEntity(
      id: 'address-1',
      addressLine: '1 Nguyen Hue',
      latitude: 10.77,
      longitude: 106.70,
      isDefault: true,
    );

    final json = address.toJson();
    final mapped = AddressEntity.fromJson({'id': address.id, ...json});

    expect(mapped.addressLine, address.addressLine);
    expect(mapped.latitude, address.latitude);
    expect(mapped.isDefault, isTrue);
  });

  test('onboarding options map categories without coupling to services', () {
    final options = OnboardingOptionsEntity.fromJson({
      'categories': [
        {
          'id': 'hair',
          'name': 'Hair',
          'services': [
            {'id': 'cut', 'name': 'Haircut'},
          ],
        },
      ],
      'services': [
        {'id': 'cut', 'name': 'Haircut'},
        {'id': 'spa', 'name': 'Spa', 'categoryId': 'wellness'},
      ],
    });

    expect(options.categories.single.id, 'hair');
  });

  test('onboarding preferences preserve selection lists in transport JSON', () {
    final json = const OnboardingPreferences(
      gender: 'FEMALE',
      categoryIds: ['hair'],
    ).toJson();

    expect(json, {
      'gender': 'FEMALE',
      'categoryIds': ['hair'],
      'serviceIds': <String>[],
    });
  });

  test('onboarding preferences map saved category objects', () {
    final preferences = OnboardingPreferences.fromJson({
      'gender': 'FEMALE',
      'preferredAudience': 'WOMEN',
      'pricePreference': 'BALANCED',
      'categories': [
        {'id': 'hair', 'name': 'Hair'},
      ],
      'services': [
        {'id': 'cut', 'name': 'Haircut'},
      ],
    });

    expect(preferences.gender, 'FEMALE');
    expect(preferences.preferredAudience, 'WOMEN');
    expect(preferences.categoryIds, ['hair']);
    expect(preferences.pricePreference, 'BALANCED');
  });

  test('recommendations map service pricing and category data', () {
    final recommendations = ServiceRecommendationsEntity.fromJson({
      'personalized': true,
      'services': [
        {
          'id': 'cut',
          'name': 'Haircut',
          'minPriceAmount': 100000.0,
          'maxPriceAmount': 250000,
          'currencyCode': 'VND',
          'defaultDurationMinutes': 45.0,
          'recommendationScore': 70,
          'category': {'id': 'hair', 'name': 'Hair'},
        },
      ],
    });

    expect(recommendations.personalized, isTrue);
    expect(recommendations.services.single.name, 'Haircut');
    expect(recommendations.services.single.minPriceAmount, 100000);
    expect(recommendations.services.single.categoryName, 'Hair');
  });

  test('partner mapper normalizes numeric service fields', () {
    final service = PartnerApiModel.serviceFromJson({
      'id': 'service-1',
      'name': 'Makeup',
      'category': {'id': 'beauty', 'name': 'Beauty'},
      'minPriceAmount': 100000.0,
      'defaultDurationMinutes': 45.0,
    });

    expect(service.categoryId, 'beauty');
    expect(service.minPriceAmount, 100000);
    expect(service.defaultDurationMinutes, 45);

    final payload = PartnerApiModel.providerServiceToJson(
      const ProviderServiceInput(
        serviceId: 'service-1',
        proposedPriceAmount: 120000,
        durationMinutes: 60,
        description: 'Premium',
      ),
    );
    expect(payload['proposedPriceAmount'], 120000);
  });
}
