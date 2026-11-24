import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PhoneInputField extends StatefulWidget {
  final Function(String) onPhoneChanged;

  const PhoneInputField({super.key, required this.onPhoneChanged});

  @override
  State<PhoneInputField> createState() => _PhoneInputFieldState();
}

class _PhoneInputFieldState extends State<PhoneInputField> {
  final TextEditingController _controller = TextEditingController();
  bool _isValid = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final text = _controller.text.replaceAll(' ', '');
      final valid = text.length >= 9 && text.length <= 11;
      if (_isValid != valid) {
        setState(() {
          _isValid = valid;
        });
      }
      widget.onPhoneChanged(text);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Số điện thoại của bạn',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          height: 56,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F766E).withValues(alpha: 0.06),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
            border: Border.all(
              color: _isValid
                  ? const Color(0xFF0F766E)
                  : const Color(0xFFBDC9C6).withValues(alpha: 0.3),
              width: _isValid ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              // Country Code (Vietnam)
              InkWell(
                onTap: () {}, // Add country picker logic later
                borderRadius: const BorderRadius.horizontal(
                  left: Radius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Container(
                        width: 24,
                        height: 16,
                        decoration: BoxDecoration(
                          color: const Color(0xFFDA251D),
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.star,
                            color: Color(0xFFFFFF00),
                            size: 10,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        '+84',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const Icon(
                        Icons.expand_more,
                        size: 20,
                        color: Color(0xFF6E7977),
                      ),
                    ],
                  ),
                ),
              ),
              Container(width: 1, height: 24, color: const Color(0xFFD3E4FE)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: TextField(
                    controller: _controller,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0B1C30),
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      errorBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                      fillColor: Colors.transparent,
                      filled: true,
                      hintText: '0912 345 678',
                      hintStyle: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.normal,
                        color: Color(0xFFBDC9C6),
                      ),
                    ),
                  ),
                ),
              ),
              if (_isValid)
                const Padding(
                  padding: EdgeInsets.only(right: 16),
                  child: Icon(
                    Icons.check_circle,
                    color: Color(0xFF005C55),
                    size: 20,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: const [
            Icon(Icons.chat, size: 16, color: Color(0xFF005C55)),
            SizedBox(width: 6),
            Text(
              'Mã OTP sẽ được gửi qua tin nhắn SMS hoặc Zalo',
              style: TextStyle(fontSize: 12, color: Color(0xFF3E4947)),
            ),
          ],
        ),
      ],
    );
  }
}
