import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/address/data/models/address_model.dart';
import 'package:mobile/features/address/domain/entities/address_entity.dart';
import 'package:mobile/features/onboarding/data/models/onboarding_model.dart';
import 'package:mobile/features/onboarding/domain/entities/onboarding_preferences.dart';
import 'package:mobile/features/partner/data/models/partner_api_model.dart';
import 'package:mobile/features/partner/domain/entities/service_catalog_entity.dart';
import 'package:mobile/features/recommendations/data/models/service_recommendations_model.dart';

void main() {
  test('address JSON conversion stays in the data layer', () {
    const address = AddressEntity(
      id: 'address-1',
      addressLine: '1 Nguyen Hue',
      latitude: 10.77,
      longitude: 106.70,
      isDefault: true,
    );

    final json = AddressModel.toJson(address);
    final mapped = AddressModel.fromJson({'id': address.id, ...json});

    expect(mapped.addressLine, address.addressLine);
    expect(mapped.latitude, address.latitude);
    expect(mapped.isDefault, isTrue);
  });

  test('onboarding options map categories without coupling to services', () {
    final options = OnboardingModel.optionsFromJson({
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
    final json = OnboardingModel.preferencesToJson(
      const OnboardingPreferences(gender: 'FEMALE', categoryIds: ['hair']),
    );

    expect(json, {
      'gender': 'FEMALE',
      'categoryIds': ['hair'],
      'serviceIds': <String>[],
    });
  });

  test('onboarding preferences map saved category objects', () {
    final preferences = OnboardingModel.preferencesFromJson({
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
    final recommendations = ServiceRecommendationsModel.fromJson({
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
