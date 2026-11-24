import 'package:flutter/material.dart';

import '../../domain/service_change.dart';
import 'service_format.dart';

class ServiceRequestTile extends StatelessWidget {
  final ServiceChange request;
  final VoidCallback onTap;
  const ServiceRequestTile({
    super.key,
    required this.request,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      onTap: onTap,
      isThreeLine: true,
      title: Text(request.name),
      trailing: const Icon(Icons.chevron_right),
      subtitle: Text(
        '${request.type.label}\n${request.status.label} · ${serviceMoney(request.price)}',
      ),
    ),
  );
}
