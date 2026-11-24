import '../domain/entities/service_catalog_entity.dart';
import '../presentation/models/partner_service_form_model.dart';

class PartnerServicesValidationResult {
  final bool isValid;
  final String? errorMessage;
  final List<ProviderServiceInput> services;
  final List<ServiceSuggestionInput> suggestions;

  const PartnerServicesValidationResult({
    required this.isValid,
    this.errorMessage,
    this.services = const [],
    this.suggestions = const [],
  });
}

class PartnerServicesValidator {
  PartnerServicesValidator._();

  static PartnerServicesValidationResult validate(
    List<PartnerServiceFormModel> masterServices,
  ) {
    final selectedServices = masterServices.where((s) => s.isSaved).toList();

    if (selectedServices.isEmpty) {
      return const PartnerServicesValidationResult(
        isValid: false,
        errorMessage: 'Vui lòng chọn ít nhất một dịch vụ bạn muốn cung cấp.',
      );
    }

    for (final s in selectedServices) {
      final price = s.priceController.text.trim();
      if (price.isEmpty) {
        return PartnerServicesValidationResult(
          isValid: false,
          errorMessage: 'Vui lòng nhập giá đề xuất cho dịch vụ: ${s.name}',
        );
      }
      final priceNum = int.tryParse(price);
      if (priceNum == null) {
        return PartnerServicesValidationResult(
          isValid: false,
          errorMessage: 'Giá đề xuất cho dịch vụ ${s.name} không hợp lệ.',
        );
      }

      if (s.minPrice != null && priceNum < s.minPrice!) {
        return PartnerServicesValidationResult(
          isValid: false,
          errorMessage:
              'Giá đề xuất cho ${s.name} thấp hơn mức giá sàn cho phép (${s.minPrice}đ).',
        );
      }
      if (s.maxPrice != null && priceNum > s.maxPrice!) {
        return PartnerServicesValidationResult(
          isValid: false,
          errorMessage:
              'Giá đề xuất cho ${s.name} vượt quá mức giá trần cho phép (${s.maxPrice}đ).',
        );
      }

      final duration = s.durationController.text.trim();
      if (duration.isEmpty ||
          int.tryParse(duration) == null ||
          int.tryParse(duration)! <= 0) {
        return PartnerServicesValidationResult(
          isValid: false,
          errorMessage: 'Vui lòng nhập thời gian hợp lệ cho dịch vụ: ${s.name}',
        );
      }
    }

    final payloadServices = selectedServices
        .where((s) => !s.isSuggestion)
        .map(
          (s) => ProviderServiceInput(
            serviceId: s.id,
            proposedPriceAmount: s.proposedPrice ?? 0,
            durationMinutes: s.durationMinutes ?? s.defaultDuration,
            description: s.descriptionController.text.trim().isNotEmpty
                ? s.descriptionController.text.trim()
                : 'Cung cấp bởi đối tác Lambe',
          ),
        )
        .toList();

    final payloadSuggestions = selectedServices
        .where((s) => s.isSuggestion)
        .map(
          (s) => ServiceSuggestionInput(
            categoryId: s.categoryId!,
            name: s.name,
            description: s.descriptionController.text.trim().isEmpty
                ? null
                : s.descriptionController.text.trim(),
            proposedPriceAmount: s.proposedPrice ?? 0,
            durationMinutes: s.durationMinutes ?? s.defaultDuration,
          ),
        )
        .toList();

    return PartnerServicesValidationResult(
      isValid: true,
      services: payloadServices,
      suggestions: payloadSuggestions,
    );
  }
}
