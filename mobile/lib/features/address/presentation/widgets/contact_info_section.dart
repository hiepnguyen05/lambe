import 'package:flutter/material.dart';

import 'address_form_input.dart';

class ContactInfoSection extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final TextEditingController noteController;

  const ContactInfoSection({
    super.key,
    required this.nameController,
    required this.phoneController,
    required this.noteController,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Thông tin người đặt',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 16),
        AddressFormInput(
          label: 'Tên người nhận',
          controller: nameController,
          hint: 'Nhập tên người nhận',
          required: true,
        ),
        const SizedBox(height: 16),
        AddressFormInput(
          label: 'Số điện thoại',
          controller: phoneController,
          hint: 'Nhập số điện thoại',
          required: true,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 16),
        AddressFormInput(
          label: 'Ghi chú cho chuyên viên',
          controller: noteController,
          hint: 'Ví dụ: Gọi trước khi đến, hoặc để ở quầy lễ tân',
          maxLines: 3,
        ),
      ],
    );
  }
}
