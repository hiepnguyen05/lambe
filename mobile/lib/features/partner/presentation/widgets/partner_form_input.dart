import 'package:flutter/material.dart';

class PartnerFormInput extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final String hint;
  final bool required;
  final int maxLines;
  final TextInputType? keyboardType;
  final VoidCallback? onTap;
  final bool readOnly;
  final Widget? suffixIcon;
  final FormFieldValidator<String>? validator;
  final bool forceValidate;

  const PartnerFormInput({
    super.key,
    required this.label,
    required this.controller,
    required this.hint,
    this.required = false,
    this.maxLines = 1,
    this.keyboardType,
    this.onTap,
    this.readOnly = false,
    this.suffixIcon,
    this.validator,
    this.forceValidate = false,
  });

  @override
  State<PartnerFormInput> createState() => _PartnerFormInputState();
}

class _PartnerFormInputState extends State<PartnerFormInput> {
  late FocusNode _focusNode;
  bool _isTouched = false;

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode();
    _focusNode.addListener(() {
      // Khi người dùng click ra ngoài (mất focus) và đã từng chạm vào ô
      if (!_focusNode.hasFocus) {
        setState(() {
          _isTouched = true;
        });
      }
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                widget.label,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  fontSize: 14,
                ),
              ),
              if (widget.required)
                const Text(
                  ' *',
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: widget.controller,
            focusNode: _focusNode,
            maxLines: widget.maxLines,
            keyboardType: widget.keyboardType,
            onTap: widget.onTap,
            readOnly: widget.readOnly,
            // Chỉ hiển thị lỗi tự động SAU KHI người dùng thoát khỏi ô (mất focus) HOẶC khi bị ép buộc (nhấn Submit)
            autovalidateMode: (widget.forceValidate || _isTouched)
                ? AutovalidateMode.always
                : AutovalidateMode.disabled,
            validator:
                widget.validator ??
                (widget.required
                    ? (val) => val == null || val.trim().isEmpty
                          ? 'Vui lòng không để trống'
                          : null
                    : null),
            decoration: InputDecoration(
              hintText: widget.hint,
              hintStyle: const TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 14,
              ),
              filled: true,
              fillColor: Colors.white,
              suffixIcon: widget.suffixIcon,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: Color(0xFF0F766E),
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.redAccent),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
