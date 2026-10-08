import 'package:flutter/material.dart';

import 'address_form_input.dart';

class AddressDetailsSection extends StatelessWidget {
  final TextEditingController provinceController;
  final TextEditingController wardController;
  final TextEditingController streetController;
  final VoidCallback? onAddressSubmitted;

  const AddressDetailsSection({
    super.key,
    required this.provinceController,
    required this.wardController,
    required this.streetController,
    this.onAddressSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Thông tin địa chỉ',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 16),
        AddressFormInput(
          label: 'Tỉnh / Thành phố',
          controller: provinceController,
          hint: 'VD: Hà Nội',
          required: true,
        ),
        const SizedBox(height: 16),
        AddressFormInput(
          label: 'Phường/Xã',
          controller: wardController,
          hint: 'VD: Cầu Giấy, Yên Hòa',
          required: true,
        ),
        const SizedBox(height: 16),
        AddressFormInput(
          label: 'Địa chỉ cụ thể',
          controller: streetController,
          hint: 'Số nhà, ngõ, toà nhà, tên đường...',
          required: true,
          maxLines: 2,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) {
            if (onAddressSubmitted != null) {
              onAddressSubmitted!();
            }
          },
        ),
      ],
    );
  }
}
