import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../di/partner_providers.dart';
import '../../domain/entities/provider_application_entity.dart';
import '../../domain/entities/provider_application_update.dart';
import '../widgets/partner_dropdown_input.dart';
import '../widgets/partner_form_input.dart';
import '../widgets/partner_registration_progress.dart';

class PartnerInfoScreen extends ConsumerStatefulWidget {
  const PartnerInfoScreen({super.key});

  @override
  ConsumerState<PartnerInfoScreen> createState() => _PartnerInfoScreenState();
}

class _PartnerInfoScreenState extends ConsumerState<PartnerInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _hasSubmitted = false;

  // INDIVIDUAL
  final _fullNameCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _experienceCtrl = TextEditingController();

  // ORGANIZATION
  final _orgNameCtrl = TextEditingController();
  final _taxCodeCtrl = TextEditingController();
  final _businessRegCtrl = TextEditingController();
  final _orgAddressCtrl = TextEditingController();
  final _repNameCtrl = TextEditingController();

  // COMMON
  final _emailCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();

  String _gender = 'MALE';
  String _birthDate = '1995-01-01';
  final _birthDateDisplayCtrl = TextEditingController(text: '01/01/1995');
  Timer? _draftTimer;
  bool _canSaveDraft = false;

  List<TextEditingController> get _draftControllers => [
    _fullNameCtrl,
    _idNumberCtrl,
    _experienceCtrl,
    _orgNameCtrl,
    _taxCodeCtrl,
    _businessRegCtrl,
    _orgAddressCtrl,
    _repNameCtrl,
    _emailCtrl,
    _bioCtrl,
  ];

  Future<void> _pickBirthDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_birthDate) ?? DateTime(1995, 1, 1),
      firstDate: DateTime(1950),
      lastDate: DateTime.now().subtract(
        const Duration(days: 365 * 15),
      ), // Tối thiểu 15 tuổi
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: Color(0xFF0F766E)),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _birthDate =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
        _birthDateDisplayCtrl.text =
            '${picked.day.toString().padLeft(2, '0')}/${picked.month.toString().padLeft(2, '0')}/${picked.year}';
      });
      _scheduleDraftSave();
    }
  }

  @override
  void initState() {
    super.initState();
    for (final controller in _draftControllers) {
      controller.addListener(_scheduleDraftSave);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _restoreForm());
  }

  Future<void> _restoreForm() async {
    final application = ref.read(partnerNotifierProvider).valueOrNull;
    if (application == null) return;
    _applyApplication(application);
    final draft = await ref
        .read(partnerNotifierProvider.notifier)
        .loadInfoDraft();
    if (!mounted) return;
    if (draft != null) _applyUpdate(draft, application.providerType);
    _canSaveDraft = true;
    setState(() {});
  }

  void _applyApplication(ProviderApplicationEntity application) {
    _emailCtrl.text = application.email ?? '';
    _bioCtrl.text = application.biography ?? '';
    if (application.providerType == 'ORGANIZATION') {
      _orgNameCtrl.text = application.organizationName ?? '';
      _taxCodeCtrl.text = application.taxCode ?? '';
      _businessRegCtrl.text = application.businessRegistrationNumber ?? '';
      _orgAddressCtrl.text = application.registeredAddress ?? '';
      _repNameCtrl.text = application.representativeName ?? '';
      return;
    }
    _fullNameCtrl.text = application.legalFullName ?? '';
    _idNumberCtrl.text =
        application.nationalIdNumber ?? application.nationalIdMasked ?? '';
    _experienceCtrl.text = (application.experienceYears ?? '').toString();
    if (['MALE', 'FEMALE', 'OTHER'].contains(application.gender)) {
      _gender = application.gender!;
    }
    _setBirthDate(application.birthDate);
  }

  void _applyUpdate(ProviderApplicationUpdate update, String providerType) {
    _emailCtrl.text = update.email;
    _bioCtrl.text = update.biography;
    if (providerType == 'ORGANIZATION') {
      _orgNameCtrl.text = update.organizationName ?? '';
      _taxCodeCtrl.text = update.taxCode ?? '';
      _businessRegCtrl.text = update.businessRegistrationNumber ?? '';
      _orgAddressCtrl.text = update.registeredAddress ?? '';
      _repNameCtrl.text = update.representativeName ?? '';
      return;
    }
    _fullNameCtrl.text = update.legalFullName ?? '';
    _idNumberCtrl.text = update.nationalIdNumber ?? _idNumberCtrl.text;
    _experienceCtrl.text = (update.experienceYears ?? '').toString();
    if (['MALE', 'FEMALE', 'OTHER'].contains(update.gender)) {
      _gender = update.gender!;
    }
    _setBirthDate(update.birthDate);
  }

  void _setBirthDate(String? value) {
    if (value == null || value.isEmpty) return;
    _birthDate = value;
    final parts = value.split('-');
    if (parts.length == 3) {
      _birthDateDisplayCtrl.text = '${parts[2]}/${parts[1]}/${parts[0]}';
    }
  }

  void _scheduleDraftSave() {
    if (!_canSaveDraft) return;
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 400), _saveDraft);
  }

  Future<void> _saveDraft() async {
    final application = ref.read(partnerNotifierProvider).valueOrNull;
    if (application == null) return;
    await ref
        .read(partnerNotifierProvider.notifier)
        .saveInfoDraft(_currentUpdate(application));
  }

  @override
  void dispose() {
    _draftTimer?.cancel();
    if (_canSaveDraft) unawaited(_saveDraft());
    _fullNameCtrl.dispose();
    _idNumberCtrl.dispose();
    _experienceCtrl.dispose();
    _orgNameCtrl.dispose();
    _taxCodeCtrl.dispose();
    _businessRegCtrl.dispose();
    _orgAddressCtrl.dispose();
    _repNameCtrl.dispose();
    _emailCtrl.dispose();
    _bioCtrl.dispose();
    _birthDateDisplayCtrl.dispose();
    super.dispose();
  }

  ProviderApplicationUpdate _currentUpdate(
    ProviderApplicationEntity application,
  ) {
    final isOrg = application.providerType == 'ORGANIZATION';
    final nationalId = _idNumberCtrl.text.trim();
    return ProviderApplicationUpdate(
      email: _emailCtrl.text.trim(),
      biography: _bioCtrl.text.trim(),
      organizationName: isOrg ? _orgNameCtrl.text.trim() : null,
      taxCode: isOrg ? _taxCodeCtrl.text.trim() : null,
      businessRegistrationNumber: isOrg ? _businessRegCtrl.text.trim() : null,
      registeredAddress: isOrg ? _orgAddressCtrl.text.trim() : null,
      representativeName: isOrg ? _repNameCtrl.text.trim() : null,
      legalFullName: isOrg ? null : _fullNameCtrl.text.trim(),
      birthDate: isOrg ? null : _birthDate,
      gender: isOrg ? null : _gender,
      nationalIdNumber: isOrg || nationalId == application.nationalIdMasked
          ? null
          : nationalId,
      experienceYears: isOrg ? null : int.tryParse(_experienceCtrl.text.trim()),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _hasSubmitted = true;
    });

    if (!_formKey.currentState!.validate()) return;
    _draftTimer?.cancel();

    final state = ref.read(partnerNotifierProvider).value;
    if (state == null) return;

    final update = _currentUpdate(state);

    final success = await ref
        .read(partnerNotifierProvider.notifier)
        .updateApplication(update);
    if (success && mounted) {
      _canSaveDraft = false;
      context.push('/partner/services');
    } else if (mounted) {
      final error = ref.read(partnerNotifierProvider).error;
      AppDialogs.showErrorDialog(
        context,
        message: error?.toString() ?? 'Không thể lưu thông tin hồ sơ.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);
    final app = state.valueOrNull;

    if (app == null && !state.isLoading) {
      return const Scaffold(
        body: Center(child: Text('Lỗi: Không tìm thấy hồ sơ nháp')),
      );
    }

    // Nếu app == null mà đang loading thì hiển thị vòng xoay
    if (app == null && state.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isOrg = app!.providerType == 'ORGANIZATION';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Thông tin hồ sơ',
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
      body: SafeArea(
        child: Column(
          children: [
            const PartnerRegistrationProgress(
              currentStep: PartnerRegistrationStep.info,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        isOrg ? 'Thông tin tổ chức' : 'Thông tin cá nhân',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Vui lòng cung cấp thông tin chính xác để quá trình xét duyệt diễn ra nhanh chóng.',
                        style: TextStyle(color: Color(0xFF6B7280)),
                      ),
                      const SizedBox(height: 24),

                      if (isOrg) ...[
                        PartnerFormInput(
                          label: 'Tên tổ chức/Salon',
                          controller: _orgNameCtrl,
                          hint: 'Vd: Lambe Beauty Studio',
                          required: true,
                          forceValidate: _hasSubmitted,
                        ),
                        PartnerFormInput(
                          label: 'Mã số thuế',
                          controller: _taxCodeCtrl,
                          hint: 'Vd: 0123456789',
                          required: true,
                          forceValidate: _hasSubmitted,
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Vui lòng nhập Mã số thuế';
                            }
                            if (val.trim().length < 10) {
                              return 'Mã số thuế phải có ít nhất 10 ký tự';
                            }
                            return null;
                          },
                        ),
                        PartnerFormInput(
                          label: 'Số ĐKKD',
                          controller: _businessRegCtrl,
                          hint: 'Số đăng ký kinh doanh',
                          required: true,
                          forceValidate: _hasSubmitted,
                        ),
                        PartnerFormInput(
                          label: 'Địa chỉ đăng ký',
                          controller: _orgAddressCtrl,
                          hint: 'Địa chỉ trên giấy phép',
                          required: true,
                          forceValidate: _hasSubmitted,
                        ),
                        PartnerFormInput(
                          label: 'Người đại diện',
                          controller: _repNameCtrl,
                          hint: 'Họ tên người đại diện pháp luật',
                          required: true,
                          forceValidate: _hasSubmitted,
                        ),
                      ] else ...[
                        PartnerFormInput(
                          label: 'Họ và tên pháp lý',
                          controller: _fullNameCtrl,
                          hint: 'Nhập đúng như trên CCCD',
                          required: true,
                          forceValidate: _hasSubmitted,
                        ),
                        PartnerFormInput(
                          label: 'Số CCCD',
                          controller: _idNumberCtrl,
                          hint: '12 số CCCD của bạn',
                          required: true,
                          keyboardType: TextInputType.number,
                          forceValidate: _hasSubmitted,
                          validator: (val) {
                            if (val == app.nationalIdMasked &&
                                app.nationalIdMasked?.isNotEmpty == true) {
                              return null;
                            }
                            if (val == null || val.trim().isEmpty) {
                              return 'Vui lòng nhập số CCCD';
                            }
                            if (val.trim().length != 12) {
                              return 'CCCD phải bao gồm đúng 12 số';
                            }
                            if (!RegExp(r'^[0-9]+$').hasMatch(val.trim())) {
                              return 'CCCD chỉ được chứa các chữ số';
                            }
                            return null;
                          },
                        ),
                        PartnerFormInput(
                          label: 'Số năm kinh nghiệm',
                          controller: _experienceCtrl,
                          hint: 'Vd: 3',
                          required: true,
                          keyboardType: TextInputType.number,
                          forceValidate: _hasSubmitted,
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Vui lòng nhập số năm kinh nghiệm';
                            }
                            final exp = int.tryParse(val.trim());
                            if (exp == null) {
                              return 'Chỉ được nhập số';
                            }
                            if (exp < 0 || exp > 50) {
                              return 'Số năm kinh nghiệm không hợp lệ';
                            }
                            return null;
                          },
                        ),

                        // Chọn ngày sinh
                        PartnerFormInput(
                          label: 'Ngày sinh',
                          controller: _birthDateDisplayCtrl,
                          hint: 'DD/MM/YYYY',
                          required: true,
                          readOnly: true,
                          onTap: _pickBirthDate,
                          suffixIcon: const Icon(
                            Icons.calendar_month,
                            color: Color(0xFF9CA3AF),
                          ),
                          forceValidate: _hasSubmitted,
                        ),

                        // Dropdown Giới tính
                        PartnerDropdownInput<String>(
                          label: 'Giới tính',
                          required: true,
                          value: _gender,
                          items: const [
                            DropdownMenuItem(value: 'MALE', child: Text('Nam')),
                            DropdownMenuItem(
                              value: 'FEMALE',
                              child: Text('Nữ'),
                            ),
                            DropdownMenuItem(
                              value: 'OTHER',
                              child: Text('Khác'),
                            ),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _gender = val);
                              _scheduleDraftSave();
                            }
                          },
                        ),
                      ],

                      const Divider(height: 48, color: Color(0xFFE5E7EB)),

                      const Text(
                        'Thông tin liên hệ chung',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 16),
                      PartnerFormInput(
                        label: 'Email liên hệ',
                        controller: _emailCtrl,
                        hint: 'provider@example.com',
                        required: true,
                        keyboardType: TextInputType.emailAddress,
                        forceValidate: _hasSubmitted,
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) {
                            return 'Vui lòng nhập email';
                          }
                          if (!RegExp(r'^[^@]+@[^@]+\.[^@]+')
                              .hasMatch(val.trim())) {
                            return 'Email không đúng định dạng';
                          }
                          return null;
                        },
                      ),
                      PartnerFormInput(
                        label: 'Giới thiệu bản thân/Tổ chức',
                        controller: _bioCtrl,
                        hint: 'Chia sẻ ngắn gọn về thế mạnh của bạn...',
                        maxLines: 4,
                        required: true,
                        forceValidate: _hasSubmitted,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(24.0),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: state.isLoading ? null : _submit,
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
                        'Tiếp tục',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
