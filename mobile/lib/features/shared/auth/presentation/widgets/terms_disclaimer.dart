import 'package:flutter/material.dart';

class TermsDisclaimer extends StatelessWidget {
  const TermsDisclaimer({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: RichText(
        textAlign: TextAlign.center,
        text: const TextSpan(
          style: TextStyle(fontSize: 12, color: Color(0xFF3E4947), height: 1.5),
          children: [
            TextSpan(text: 'Bằng việc tiếp tục, bạn đồng ý với '),
            TextSpan(
              text: 'Điều khoản dịch vụ',
              style: TextStyle(
                color: Color(0xFF005C55),
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
              ),
            ),
            TextSpan(text: ' và '),
            TextSpan(
              text: 'Chính sách bảo mật',
              style: TextStyle(
                color: Color(0xFF005C55),
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
              ),
            ),
            TextSpan(text: ' của Lambe.'),
          ],
        ),
      ),
    );
  }
}
