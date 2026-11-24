import 'package:flutter/material.dart';

import './partner_dropdown_input.dart';
import './partner_form_input.dart';

class PartnerOrganizationFormSection extends StatelessWidget {
  final TextEditingController orgNameCtrl;
  final TextEditingController taxCodeCtrl;
  final TextEditingController businessRegCtrl;
  final TextEditingController orgAddressCtrl;
  final TextEditingController repNameCtrl;
  final bool hasSubmitted;

  const PartnerOrganizationFormSection({
    super.key,
    required this.orgNameCtrl,
    required this.taxCodeCtrl,
    required this.businessRegCtrl,
    required this.orgAddressCtrl,
    required this.repNameCtrl,
    required this.hasSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PartnerFormInput(
          label: 'Tên tổ chức/Salon',
          controller: orgNameCtrl,
          hint: 'Vd: Lambe Beauty Studio',
          required: true,
          forceValidate: hasSubmitted,
        ),
        PartnerFormInput(
          label: 'Mã số thuế',
          controller: taxCodeCtrl,
          hint: 'Vd: 0123456789',
          required: true,
          forceValidate: hasSubmitted,
          validator: (val) {
            if (val == null || val.trim().isEmpty) {
              return 'Vui lòng nhập Mã số thuế';
            }
            if (val.trim().length < 10) {
              return 'Mã số thuế phải có ít nhất 10 ký tự';
            }
            return null;
          },
        ),
        PartnerFormInput(
          label: 'Số ĐKKD',
          controller: businessRegCtrl,
          hint: 'Số đăng ký kinh doanh',
          required: true,
          forceValidate: hasSubmitted,
        ),
        PartnerFormInput(
          label: 'Địa chỉ đăng ký',
          controller: orgAddressCtrl,
          hint: 'Địa chỉ trên giấy phép',
          required: true,
          forceValidate: hasSubmitted,
        ),
        PartnerFormInput(
          label: 'Người đại diện',
          controller: repNameCtrl,
          hint: 'Họ tên người đại diện pháp luật',
          required: true,
          forceValidate: hasSubmitted,
        ),
      ],
    );
  }
}

class PartnerIndividualFormSection extends StatelessWidget {
  final TextEditingController fullNameCtrl;
  final TextEditingController idNumberCtrl;
  final TextEditingController experienceCtrl;
  final TextEditingController birthDateDisplayCtrl;
  final String gender;
  final String? nationalIdMasked;
  final bool hasSubmitted;
  final VoidCallback onPickBirthDate;
  final ValueChanged<String?> onGenderChanged;

  const PartnerIndividualFormSection({
    super.key,
    required this.fullNameCtrl,
    required this.idNumberCtrl,
    required this.experienceCtrl,
    required this.birthDateDisplayCtrl,
    required this.gender,
    this.nationalIdMasked,
    required this.hasSubmitted,
    required this.onPickBirthDate,
    required this.onGenderChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PartnerFormInput(
          label: 'Họ và tên pháp lý',
          controller: fullNameCtrl,
          hint: 'Nhập đúng như trên CCCD',
          required: true,
          forceValidate: hasSubmitted,
        ),
        PartnerFormInput(
          label: 'Số CCCD',
          controller: idNumberCtrl,
          hint: '12 số CCCD của bạn',
          required: true,
          keyboardType: TextInputType.number,
          forceValidate: hasSubmitted,
          validator: (val) {
            if (val == nationalIdMasked &&
                nationalIdMasked?.isNotEmpty == true) {
              return null;
            }
            if (val == null || val.trim().isEmpty) {
              return 'Vui lòng nhập số CCCD';
            }
            if (val.trim().length != 12) {
              return 'CCCD phải bao gồm đúng 12 số';
            }
            if (!RegExp(r'^[0-9]+$').hasMatch(val.trim())) {
              return 'CCCD chỉ được chứa các chữ số';
            }
            return null;
          },
        ),
        PartnerFormInput(
          label: 'Số năm kinh nghiệm',
          controller: experienceCtrl,
          hint: 'Vd: 3',
          required: true,
          keyboardType: TextInputType.number,
          forceValidate: hasSubmitted,
          validator: (val) {
            if (val == null || val.trim().isEmpty) {
              return 'Vui lòng nhập số năm kinh nghiệm';
            }
            final exp = int.tryParse(val.trim());
            if (exp == null) {
              return 'Chỉ được nhập số';
            }
            if (exp < 0 || exp > 50) {
              return 'Số năm kinh nghiệm không hợp lệ';
            }
            return null;
          },
        ),

        // Chọn ngày sinh
        PartnerFormInput(
          label: 'Ngày sinh',
          controller: birthDateDisplayCtrl,
          hint: 'DD/MM/YYYY',
          required: true,
          readOnly: true,
          onTap: onPickBirthDate,
          suffixIcon: const Icon(
            Icons.calendar_month,
            color: Color(0xFF9CA3AF),
          ),
          forceValidate: hasSubmitted,
        ),

        // Dropdown Giới tính
        PartnerDropdownInput<String>(
          label: 'Giới tính',
          required: true,
          value: gender,
          items: const [
            DropdownMenuItem(value: 'MALE', child: Text('Nam')),
            DropdownMenuItem(value: 'FEMALE', child: Text('Nữ')),
            DropdownMenuItem(value: 'OTHER', child: Text('Khác')),
          ],
          onChanged: onGenderChanged,
        ),
      ],
    );
  }
}
