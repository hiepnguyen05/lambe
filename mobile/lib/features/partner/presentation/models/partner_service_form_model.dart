import 'package:flutter/material.dart';

import '../../domain/entities/service_catalog_entity.dart';

class PartnerServiceFormModel {
  final String id;
  final String name;
  final String category;
  final String? categoryId;
  final int? minPrice;
  final int? maxPrice;
  final int defaultDuration;
  final bool requiresCertificate;
  final int minPortfolioImages;
  final int minExperienceYears;
  final bool isSuggestion;
  bool isSaved;
  bool isExpanded;
  final TextEditingController priceController;
  final TextEditingController durationController;
  final TextEditingController descriptionController;

  PartnerServiceFormModel({
    required this.id,
    required this.name,
    required this.category,
    this.categoryId,
    this.minPrice,
    this.maxPrice,
    required this.defaultDuration,
    this.requiresCertificate = false,
    this.minPortfolioImages = 0,
    this.minExperienceYears = 0,
    this.isSuggestion = false,
    this.isSaved = false,
    this.isExpanded = false,
    String price = '',
    String? duration,
    String description = '',
  }) : priceController = TextEditingController(text: price),
       durationController = TextEditingController(
         text: duration ?? defaultDuration.toString(),
       ),
       descriptionController = TextEditingController(text: description);

  factory PartnerServiceFormModel.fromCatalog(ServiceCatalogEntity service) {
    return PartnerServiceFormModel(
      id: service.id,
      name: service.name,
      category: service.categoryName,
      categoryId: service.categoryId,
      minPrice: service.minPriceAmount,
      maxPrice: service.maxPriceAmount,
      defaultDuration: service.defaultDurationMinutes,
      requiresCertificate: service.requiresCertificate,
      minPortfolioImages: service.minPortfolioImages,
      minExperienceYears: service.minExperienceYears,
    );
  }

  int? get proposedPrice => int.tryParse(priceController.text.trim());

  int? get durationMinutes => int.tryParse(durationController.text.trim());

  void reset() {
    isSaved = false;
    isExpanded = false;
    priceController.clear();
    durationController.text = defaultDuration.toString();
    descriptionController.clear();
  }

  void dispose() {
    priceController.dispose();
    durationController.dispose();
    descriptionController.dispose();
  }
}
