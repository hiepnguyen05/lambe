import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import '../../di/member_verification_providers.dart';
import '../../domain/entities/member_verification_entity.dart';

class MemberVerificationFormScreen extends ConsumerStatefulWidget {
  final String memberId;
  final MemberVerificationProfileEntity? initialProfile;

  const MemberVerificationFormScreen({
    super.key,
    required this.memberId,
    this.initialProfile,
  });

  @override
  ConsumerState<MemberVerificationFormScreen> createState() =>
      _MemberVerificationFormScreenState();
}

class _MemberVerificationFormScreenState
    extends ConsumerState<MemberVerificationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _experienceCtrl = TextEditingController();
  final _birthDateDisplayCtrl = TextEditingController();

  String _birthDate = '1995-01-01';
  String _gender = 'FEMALE';
  final Set<String> _selectedServiceIds = {};
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final p = widget.initialProfile;
    if (p != null) {
      _fullNameCtrl.text = p.legalFullName ?? '';
      _experienceCtrl.text = (p.experienceYears ?? '').toString();
      if (p.gender != null) _gender = p.gender!;
      if (p.birthDate != null && p.birthDate!.isNotEmpty) {
        _birthDate = p.birthDate!;
        final parts = _birthDate.split('-');
        if (parts.length == 3) {
          _birthDateDisplayCtrl.text = '${parts[2]}/${parts[1]}/${parts[0]}';
        }
      }
      _selectedServiceIds.addAll(p.requestedProviderServiceIds);
    }
  }

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _idNumberCtrl.dispose();
    _experienceCtrl.dispose();
    _birthDateDisplayCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    final firstDate = DateTime(1950);
    final lastDate = DateTime.now().subtract(const Duration(days: 365 * 18)); // >= 18 tuổi
    final parsed = DateTime.tryParse(_birthDate);
    final initial =
        (parsed != null && !parsed.isBefore(firstDate) && !parsed.isAfter(lastDate))
            ? parsed
            : DateTime(1995, 1, 1);
    final initialDate = initial.isAfter(lastDate) ? lastDate : initial;

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
    );
    if (picked != null) {
      setState(() {
        _birthDate =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
        _birthDateDisplayCtrl.text =
            '${picked.day.toString().padLeft(2, '0')}/${picked.month.toString().padLeft(2, '0')}/${picked.year}';
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedServiceIds.isEmpty) {
      AppDialog.showErrorDialog(
        context,
        message: 'Vui lòng chọn ít nhất một dịch vụ bạn muốn đăng ký làm.',
      );
      return;
    }

    setState(() => _isLoading = true);
    final notifier =
        ref.read(memberVerificationNotifierProvider(widget.memberId).notifier);

    final success = await notifier.saveProfile(
      legalFullName: _fullNameCtrl.text.trim(),
      birthDate: _birthDate,
      gender: _gender,
      nationalIdNumber: _idNumberCtrl.text.trim(),
      experienceYears: int.tryParse(_experienceCtrl.text.trim()) ?? 0,
      requestedProviderServiceIds: _selectedServiceIds.toList(),
    );

    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        context.push(
          '/provider/memberships/${widget.memberId}/verification/documents',
        );
      } else {
        AppDialog.showErrorDialog(
          context,
          message: 'Không thể lưu thông tin. Vui lòng kiểm tra lại số CCCD/tuổi.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final optionsAsync =
        ref.watch(memberVerificationOptionsProvider(widget.memberId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Khai báo chuyên môn',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Section 1: Thông tin cá nhân
              const Text(
                '1. Thông tin cá nhân & CCCD',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Số CCCD được mã hóa bảo mật chuẩn AES-256 theo quy định.',
                style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _fullNameCtrl,
                decoration: InputDecoration(
                  labelText: 'Họ và tên theo CCCD *',
                  hintText: 'NGUYỄN VĂN A',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
                validator: (v) => (v == null || v.trim().length < 2)
                    ? 'Họ tên tối thiểu 2 ký tự.'
                    : null,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _birthDateDisplayCtrl,
                      readOnly: true,
                      onTap: _pickBirthDate,
                      decoration: InputDecoration(
                        labelText: 'Ngày sinh *',
                        hintText: 'DD/MM/YYYY',
                        suffixIcon: const Icon(Icons.calendar_today_rounded),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Chọn ngày sinh.' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration: InputDecoration(
                        labelText: 'Giới tính',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      items: const [
                        DropdownMenuItem(value: 'FEMALE', child: Text('Nữ')),
                        DropdownMenuItem(value: 'MALE', child: Text('Nam')),
                        DropdownMenuItem(value: 'OTHER', child: Text('Khác')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _gender = val);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _idNumberCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Số CCCD (12 chữ số) *',
                  hintText: '001095012345',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
                validator: (v) {
                  if (v == null || !RegExp(r'^\d{12}$').hasMatch(v.trim())) {
                    return 'CCCD phải gồm đúng 12 chữ số.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _experienceCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Số năm kinh nghiệm làm nghề *',
                  hintText: '3',
                  suffixText: 'năm',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 0 || n > 80) {
                    return 'Kinh nghiệm từ 0 - 80 năm.';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 32),
              // Section 2: Dịch vụ của tổ chức
              const Text(
                '2. Chọn dịch vụ đăng ký chuyên môn',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Chọn các dịch vụ bạn có thể thực hiện. Nếu dịch vụ yêu cầu chứng chỉ nghề, bạn cần tải chứng chỉ ở bước tiếp theo.',
                style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 16),

              optionsAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text(
                  'Không thể tải dịch vụ của cơ sở: $e',
                  style: const TextStyle(color: Color(0xFFDC2626)),
                ),
                data: (services) {
                  if (services.isEmpty) {
                    return const Text(
                      'Cơ sở chưa có dịch vụ nào đang hoạt động.',
                      style: TextStyle(color: Color(0xFF6B7280)),
                    );
                  }
                  return Column(
                    children: services.map((s) {
                      final isSelected = _selectedServiceIds.contains(s.id);
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary.withValues(alpha: 0.05)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : const Color(0xFFE5E7EB),
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: CheckboxListTile(
                          value: isSelected,
                          activeColor: AppColors.primary,
                          title: Text(
                            s.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          subtitle: Wrap(
                            spacing: 8,
                            children: [
                              if (s.requiresCertificate)
                                const Text(
                                  '• Yêu cầu chứng chỉ',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFFD97706),
                                  ),
                                ),
                              Text(
                                '• Tối thiểu ${s.minExperienceYears} năm KN',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                            ],
                          ),
                          onChanged: (val) {
                            setState(() {
                              if (val == true) {
                                _selectedServiceIds.add(s.id);
                              } else {
                                _selectedServiceIds.remove(s.id);
                              }
                            });
                          },
                        ),
                      );
                    }).toList(),
                  );
                },
              ),

              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : const Text(
                        'Tiếp tục: Tải giấy tờ & Chứng chỉ',
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
