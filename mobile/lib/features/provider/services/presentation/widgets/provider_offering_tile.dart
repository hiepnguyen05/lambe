import 'package:flutter/material.dart';

import '../../domain/provider_offering.dart';
import 'service_format.dart';

class ProviderOfferingTile extends StatelessWidget {
  final ProviderOffering offering;
  final VoidCallback onTap;
  const ProviderOfferingTile({
    super.key,
    required this.offering,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      onTap: onTap,
      title: Text(offering.service.name),
      trailing: const Icon(Icons.chevron_right),
      isThreeLine: true,
      subtitle: Text(
        '${serviceMoney(offering.price)} · ${offering.effectiveDuration == null ? 'Theo dịch vụ chuẩn' : '${offering.effectiveDuration} phút'}\n'
        '${offering.suspended
            ? 'Đình chỉ'
            : offering.active
            ? 'Đang bật'
            : 'Tạm ngừng'}'
        '${offering.blockerCode == null ? '' : ' · Chưa đủ điều kiện nhận đơn'}',
      ),
    ),
  );
}
