import 'package:flutter/material.dart';

import 'address_type_option.dart';

class AddressTypeSection extends StatelessWidget {
  final String selectedType;
  final ValueChanged<String> onTypeSelected;

  const AddressTypeSection({
    super.key,
    required this.selectedType,
    required this.onTypeSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Loại địa chỉ',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            AddressTypeOption(
              type: 'HOME',
              icon: Icons.home_rounded,
              label: 'Nhà',
              isSelected: selectedType == 'HOME',
              onTap: () => onTypeSelected('HOME'),
            ),
            const SizedBox(width: 12),
            AddressTypeOption(
              type: 'WORK',
              icon: Icons.work_rounded,
              label: 'Công ty',
              isSelected: selectedType == 'WORK',
              onTap: () => onTypeSelected('WORK'),
            ),
            const SizedBox(width: 12),
            AddressTypeOption(
              type: 'OTHER',
              icon: Icons.location_on_rounded,
              label: 'Khác',
              isSelected: selectedType == 'OTHER',
              onTap: () => onTypeSelected('OTHER'),
            ),
          ],
        ),
      ],
    );
  }
}
