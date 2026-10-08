import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../di/partner_providers.dart';
import '../utils/currency_utils.dart';
import '../models/partner_service_form_model.dart';
import '../widgets/partner_form_input.dart';

class PartnerSuggestServiceModal extends ConsumerStatefulWidget {
  final Map<String, String> categories;

  const PartnerSuggestServiceModal({super.key, required this.categories});

  @override
  ConsumerState<PartnerSuggestServiceModal> createState() =>
      _PartnerSuggestServiceModalState();
}

class _PartnerSuggestServiceModalState
    extends ConsumerState<PartnerSuggestServiceModal> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedCategoryId;
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _durationCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitSuggestion() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategoryId == null) {
      AppDialogs.showErrorDialog(context, message: 'Vui lòng chọn danh mục.');
      return;
    }

    final payload = PartnerServiceFormModel(
      id: 'suggestion_${DateTime.now().millisecondsSinceEpoch}',
      categoryId: _selectedCategoryId,
      category: widget.categories[_selectedCategoryId]!,
      name: _nameCtrl.text.trim(),
      defaultDuration: int.parse(_durationCtrl.text.trim()),
      isSuggestion: true,
      isSaved: true,
      price: _priceCtrl.text.trim(),
      duration: _durationCtrl.text.trim(),
      description: _descCtrl.text.trim(),
    );

    Navigator.of(context).pop(payload);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        top: 24,
        left: 24,
        right: 24,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Đề xuất dịch vụ mới',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0B1C30),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Dịch vụ này chưa có trên hệ thống? Hãy đề xuất cho chúng tôi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF6B7280), fontSize: 14),
              ),
              const SizedBox(height: 24),

              const Text(
                'Danh mục *',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _selectedCategoryId,
                hint: const Text('Chọn danh mục'),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.white,
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
                ),
                items: widget.categories.entries.map((e) {
                  return DropdownMenuItem(value: e.key, child: Text(e.value));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedCategoryId = val);
                },
              ),
              const SizedBox(height: 16),

              PartnerFormInput(
                label: 'Tên dịch vụ đề xuất',
                controller: _nameCtrl,
                hint: 'Vd: Nhuộm highlight Balayage',
                required: true,
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Vui lòng nhập tên dịch vụ';
                  }
                  return null;
                },
              ),

              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Giá đề xuất (đ) *',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B1C30),
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _priceCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            hintText: 'Nhập giá',
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 16,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: Color(0xFFE5E7EB),
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: Color(0xFFE5E7EB),
                              ),
                            ),
                          ),
                        ),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _priceCtrl,
                          builder: (context, value, child) {
                            final text = numberToVietnameseText(value.text);
                            if (text.isEmpty) return const SizedBox.shrink();
                            return Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                text,
                                style: const TextStyle(
                                  color: Color(0xFF0F766E),
                                  fontSize: 12,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: PartnerFormInput(
                      label: 'Thời gian (phút)',
                      controller: _durationCtrl,
                      hint: 'Vd: 60',
                      required: true,
                      keyboardType: TextInputType.number,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Bắt buộc';
                        }
                        if (int.tryParse(val) == null ||
                            int.tryParse(val)! <= 0) {
                          return 'Không hợp lệ';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),

              PartnerFormInput(
                label: 'Mô tả chi tiết (Tùy chọn)',
                controller: _descCtrl,
                hint: 'Mô tả cách bạn thực hiện dịch vụ này...',
                maxLines: 2,
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: state.isLoading ? null : _submitSuggestion,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
                child: state.isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Thêm vào danh sách đã chọn',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
