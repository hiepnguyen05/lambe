import 'package:flutter/material.dart';

class IncomingOrderServiceInfo extends StatelessWidget {
  final String serviceName;
  final String serviceDescription;

  const IncomingOrderServiceInfo({
    super.key,
    required this.serviceName,
    required this.serviceDescription,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          serviceName,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0F172A),
            height: 1.3,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          serviceDescription,
          style: const TextStyle(
            fontSize: 12,
            color: Color(0xFF64748B),
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
