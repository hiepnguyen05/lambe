import 'package:flutter/material.dart';

import '../../domain/entities/provider_application_entity.dart';

String partnerRouteForStep(PartnerApplicationStep step) {
  return switch (step) {
    PartnerApplicationStep.info => '/partner/info',
    PartnerApplicationStep.services => '/partner/services',
    PartnerApplicationStep.identity => '/partner/identity',
    PartnerApplicationStep.expertise => '/partner/expertise',
    PartnerApplicationStep.submit => '/partner/submit',
  };
}

Future<bool> showPartnerResumeDialog(BuildContext context) async {
  return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Text(
            'Tiếp tục hồ sơ?',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: Color(0xFF0B1C30),
            ),
          ),
          content: const Text(
            'Bạn còn một hồ sơ đăng ký đối tác chưa hoàn tất. Bạn có muốn tiếp tục từ bước đang dở không?',
            style: TextStyle(height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Để sau'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
              ),
              child: const Text('Tiếp tục'),
            ),
          ],
        ),
      ) ??
      false;
}
