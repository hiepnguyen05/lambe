import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_typography.dart';

class OtpPinInput extends StatefulWidget {
  final int length;
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onCompleted;

  const OtpPinInput({
    super.key,
    this.length = 6,
    required this.controller,
    this.onChanged,
    this.onCompleted,
  });

  @override
  State<OtpPinInput> createState() => _OtpPinInputState();
}

class _OtpPinInputState extends State<OtpPinInput> {
  late List<FocusNode> _focusNodes;
  late List<TextEditingController> _controllers;

  @override
  void initState() {
    super.initState();
    _focusNodes = List.generate(widget.length, (index) => FocusNode());
    _controllers = List.generate(widget.length, (index) => TextEditingController());

    widget.controller.addListener(_syncFromMainController);
  }

  void _syncFromMainController() {
    final text = widget.controller.text;
    for (int i = 0; i < widget.length; i++) {
      if (i < text.length) {
        _controllers[i].text = text[i];
      } else {
        _controllers[i].clear();
      }
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_syncFromMainController);
    for (var node in _focusNodes) {
      node.dispose();
    }
    for (var controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      if (digits.length >= widget.length) {
        widget.controller.text = digits.substring(0, widget.length);
        _focusNodes[widget.length - 1].requestFocus();
        widget.onCompleted?.call(widget.controller.text);
        return;
      }
    }

    final codeBuffer = StringBuffer();
    for (int i = 0; i < widget.length; i++) {
      codeBuffer.write(_controllers[i].text);
    }
    widget.controller.text = codeBuffer.toString();
    widget.onChanged?.call(widget.controller.text);

    if (value.isNotEmpty) {
      if (index < widget.length - 1) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
        if (widget.controller.text.length == widget.length) {
          widget.onCompleted?.call(widget.controller.text);
        }
      }
    }
  }

  void _onKey(KeyEvent event, int index) {
    if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.backspace) {
      if (_controllers[index].text.isEmpty && index > 0) {
        _focusNodes[index - 1].requestFocus();
        _controllers[index - 1].clear();
        _onDigitChanged(index - 1, '');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(
        widget.length,
        (index) => SizedBox(
          width: 46,
          height: 54,
          child: KeyboardListener(
            focusNode: FocusNode(),
            onKeyEvent: (event) => _onKey(event, index),
            child: TextField(
              controller: _controllers[index],
              focusNode: _focusNodes[index],
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 1,
              style: AppTypography.headlineLg.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
              ],
              decoration: InputDecoration(
                counterText: '',
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                fillColor: Colors.white,
                filled: true,
                border: OutlineInputBorder(
                  borderRadius: AppRadii.borderMd,
                  borderSide: BorderSide(color: AppColors.outlineVariant.withValues(alpha: 0.6)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: AppRadii.borderMd,
                  borderSide: BorderSide(color: AppColors.outlineVariant.withValues(alpha: 0.6)),
                ),
                focusedBorder: const OutlineInputBorder(
                  borderRadius: AppRadii.borderMd,
                  borderSide: BorderSide(color: AppColors.primary, width: 2.0),
                ),
              ),
              onChanged: (val) => _onDigitChanged(index, val),
            ),
          ),
        ),
      ),
    );
  }
}
