import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/registration/application/partner_services_validator.dart';
import 'package:mobile/features/provider/registration/presentation/models/partner_service_form_model.dart';

void main() {
  group('PartnerServicesValidator', () {
    test('returns invalid when no services are selected', () {
      final model = PartnerServiceFormModel(
        id: 'srv-1',
        name: 'Dọn dẹp',
        category: 'Vệ sinh',
        defaultDuration: 60,
        isSaved: false,
      );

      final result = PartnerServicesValidator.validate([model]);
      expect(result.isValid, isFalse);
      expect(
        result.errorMessage,
        contains('Vui lòng chọn ít nhất một dịch vụ'),
      );
    });

    test('validates price constraints (empty, non-numeric, min, max)', () {
      final model = PartnerServiceFormModel(
        id: 'srv-1',
        name: 'Dọn dẹp',
        category: 'Vệ sinh',
        defaultDuration: 60,
        minPrice: 50000,
        maxPrice: 200000,
        isSaved: true,
      );

      // Empty price
      model.priceController.text = '';
      expect(PartnerServicesValidator.validate([model]).isValid, isFalse);

      // Non-numeric price
      model.priceController.text = 'abc';
      expect(PartnerServicesValidator.validate([model]).isValid, isFalse);

      // Below min price
      model.priceController.text = '40000';
      final belowMin = PartnerServicesValidator.validate([model]);
      expect(belowMin.isValid, isFalse);
      expect(belowMin.errorMessage, contains('thấp hơn mức giá sàn'));

      // Above max price
      model.priceController.text = '300000';
      final aboveMax = PartnerServicesValidator.validate([model]);
      expect(aboveMax.isValid, isFalse);
      expect(aboveMax.errorMessage, contains('vượt quá mức giá trần'));
    });

    test('validates duration constraints', () {
      final model = PartnerServiceFormModel(
        id: 'srv-1',
        name: 'Dọn dẹp',
        category: 'Vệ sinh',
        defaultDuration: 60,
        isSaved: true,
      );
      model.priceController.text = '100000';

      model.durationController.text = '0';
      expect(PartnerServicesValidator.validate([model]).isValid, isFalse);

      model.durationController.text = '-15';
      expect(PartnerServicesValidator.validate([model]).isValid, isFalse);
    });

    test('successfully maps catalog services and suggestions', () {
      final standard = PartnerServiceFormModel(
        id: 'srv-1',
        name: 'Dọn dẹp',
        category: 'Vệ sinh',
        defaultDuration: 60,
        isSaved: true,
      );
      standard.priceController.text = '120000';
      standard.durationController.text = '90';
      standard.descriptionController.text = 'Dịch vụ chuyên nghiệp';

      final suggestion = PartnerServiceFormModel(
        id: 'sug-1',
        name: 'Sửa điện lạnh mới',
        category: 'Điện lạnh',
        categoryId: 'cat-2',
        defaultDuration: 120,
        isSaved: true,
        isSuggestion: true,
      );
      suggestion.priceController.text = '250000';
      suggestion.durationController.text = '120';

      final result = PartnerServicesValidator.validate([standard, suggestion]);
      expect(result.isValid, isTrue);
      expect(result.services.length, equals(1));
      expect(result.services.first.serviceId, equals('srv-1'));
      expect(result.services.first.proposedPriceAmount, equals(120000));
      expect(result.services.first.durationMinutes, equals(90));

      expect(result.suggestions.length, equals(1));
      expect(result.suggestions.first.categoryId, equals('cat-2'));
      expect(result.suggestions.first.name, equals('Sửa điện lạnh mới'));
      expect(result.suggestions.first.proposedPriceAmount, equals(250000));
    });
  });
}
