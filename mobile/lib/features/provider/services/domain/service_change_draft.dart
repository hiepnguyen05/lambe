import 'provider_offering.dart';
import 'service_change.dart';

class ServiceChangeDraft {
  final ServiceChangeType type;
  final String? serviceId, offeringId, categoryId, name, description;
  final int price;
  final int? duration;
  const ServiceChangeDraft({
    required this.type,
    this.serviceId,
    this.offeringId,
    this.categoryId,
    this.name,
    this.description,
    required this.price,
    this.duration,
  });
  String? validate({ServiceDefinition? definition}) {
    if (price < 1 || price > 2000000000) {
      return 'Giá phải từ 1 đến 2.000.000.000 đồng.';
    }
    if (duration != null && (duration! < 15 || duration! > 720)) {
      return 'Thời lượng phải từ 15 đến 720 phút.';
    }
    if ((description?.trim().runes.length ?? 0) > 1000) {
      return 'Mô tả tối đa 1.000 ký tự.';
    }
    if (type == ServiceChangeType.proposeNew) {
      if (categoryId == null ||
          (name?.trim().runes.length ?? 0) < 2 ||
          name!.trim().runes.length > 100) {
        return 'Chọn danh mục và nhập tên dịch vụ từ 2 đến 100 ký tự.';
      }
      if (serviceId != null || offeringId != null) {
        return 'Thông tin dịch vụ mới không hợp lệ.';
      }
    } else {
      if (definition == null ||
          categoryId != null ||
          name != null ||
          (type == ServiceChangeType.addExisting &&
              (serviceId != definition.id || offeringId != null)) ||
          (type == ServiceChangeType.updateOffering &&
              (offeringId == null || serviceId != null))) {
        return 'Hãy chọn đúng dịch vụ cần đề xuất.';
      }
      if (price < definition.minPrice || price > definition.maxPrice) {
        return 'Giá phải trong khoảng ${definition.minPrice}–${definition.maxPrice} đồng.';
      }
    }
    return null;
  }

  bool targets(ServiceChange row) =>
      row.type == type &&
      switch (type) {
        ServiceChangeType.updateOffering => row.offeringId == offeringId,
        ServiceChangeType.addExisting => row.serviceId == serviceId,
        ServiceChangeType.proposeNew =>
          row.categoryId == categoryId &&
              row.proposedName?.trim().toLowerCase() ==
                  name?.trim().toLowerCase(),
      };
}
