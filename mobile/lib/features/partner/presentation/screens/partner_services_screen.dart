import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/partner_providers.dart';
import '../../domain/entities/service_catalog_entity.dart';
import '../../../../core/utils/app_dialogs.dart';
import '../models/partner_service_form_model.dart';
import '../widgets/partner_compact_service_card.dart';
import '../widgets/partner_registration_progress.dart';
import '../widgets/partner_service_card.dart';
import '../widgets/partner_suggest_service_modal.dart';

class PartnerServicesScreen extends ConsumerStatefulWidget {
  const PartnerServicesScreen({super.key});

  @override
  ConsumerState<PartnerServicesScreen> createState() =>
      _PartnerServicesScreenState();
}

class _PartnerServicesScreenState extends ConsumerState<PartnerServicesScreen> {
  List<PartnerServiceFormModel> _masterServices = [];
  bool _isLoadingData = true;
  String _searchQuery = '';
  String? _selectedCategory;
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadServices();

    // Tự động hiển thị hướng dẫn khi mới vào màn hình
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _showInstructionDialog();
    });
  }

  void _showInstructionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.all(24),
        title: const Row(
          children: [
            Icon(Icons.menu_book_rounded, color: Color(0xFF0F766E)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Hướng dẫn thiết lập',
                style: TextStyle(
                  color: Color(0xFF0B1C30),
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ],
        ),
        content: const SingleChildScrollView(
          child: Text(
            'Chào mừng bạn đến với bước thiết lập Dịch vụ của hệ thống Lambe!\n\n'
            '1. TÌM KIẾM DỊCH VỤ\n'
            '• Nhập từ khoá vào thanh tìm kiếm (VD: "Cắt tóc", "Nhuộm") để tìm nhanh.\n'
            '• Hoặc bấm vào thanh danh mục (Tóc, Nail, Spa...) để lọc dịch vụ theo chuyên môn của bạn.\n\n'
            '2. THIẾT LẬP GIÁ & THỜI GIAN\n'
            '• Bấm chọn một dịch vụ, một biểu mẫu sẽ mở ra.\n'
            '• Hãy nhấn vào nút (i) Gợi ý để xem giới hạn mức Giá sàn (thấp nhất) và Giá trần (cao nhất) cho phép.\n'
            '• Điền giá tiền và thời gian thực hiện (tính bằng phút) mà bạn tự tin nhất.\n\n'
            '3. LƯU & CHỈNH SỬA\n'
            '• Nhấn "Lưu thông tin", dịch vụ sẽ tự động được thu gọn lại và chuyển xuống khu vực DỊCH VỤ ĐÃ CHỌN ở cuối màn hình.\n'
            '• Nếu muốn đổi giá, bấm biểu tượng Cây bút. Nếu muốn bỏ chọn, bấm Dấu X.\n\n'
            '4. ĐỀ XUẤT DỊCH VỤ MỚI\n'
            '• Nếu bạn có kỹ năng đặc biệt mà hệ thống chưa có, hãy lướt xuống cuối danh sách và nhấn "Đề xuất dịch vụ mới".',
            style: TextStyle(
              color: Color(0xFF3E4947),
              fontSize: 14,
              height: 1.6,
            ),
            textAlign: TextAlign.left,
          ),
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text(
                'Đã hiểu',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    for (final service in _masterServices) {
      service.dispose();
    }
    super.dispose();
  }

  Future<void> _loadServices() async {
    try {
      final services = await ref.read(masterServicesProvider.future);
      if (mounted) {
        setState(() {
          _masterServices = services
              .map(PartnerServiceFormModel.fromCatalog)
              .toList();
          _isLoadingData = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingData = false;
        });
        AppDialogs.showErrorDialog(
          context,
          message: 'Lỗi khi tải danh sách dịch vụ: $e',
        );
      }
    }
  }

  Future<void> _submit() async {
    final selectedServices = _masterServices.where((s) => s.isSaved).toList();

    if (selectedServices.isEmpty) {
      AppDialogs.showErrorDialog(
        context,
        message: 'Vui lòng chọn ít nhất một dịch vụ bạn muốn cung cấp.',
      );
      return;
    }

    // Kiểm tra giá tiền
    for (var s in selectedServices) {
      final price = s.priceController.text.trim();
      if (price.isEmpty) {
        AppDialogs.showErrorDialog(
          context,
          message: 'Vui lòng nhập giá đề xuất cho dịch vụ: ${s.name}',
        );
        return;
      }
      final priceNum = int.tryParse(price);
      if (priceNum == null) {
        AppDialogs.showErrorDialog(
          context,
          message: 'Giá đề xuất cho dịch vụ ${s.name} không hợp lệ.',
        );
        return;
      }

      if (s.minPrice != null && priceNum < s.minPrice!) {
        AppDialogs.showErrorDialog(
          context,
          message:
              'Giá đề xuất cho ${s.name} thấp hơn mức giá sàn cho phép (${s.minPrice}đ).',
        );
        return;
      }
      if (s.maxPrice != null && priceNum > s.maxPrice!) {
        AppDialogs.showErrorDialog(
          context,
          message:
              'Giá đề xuất cho ${s.name} vượt quá mức giá trần cho phép (${s.maxPrice}đ).',
        );
        return;
      }

      final duration = s.durationController.text.trim();
      if (duration.isEmpty ||
          int.tryParse(duration) == null ||
          int.tryParse(duration)! <= 0) {
        AppDialogs.showErrorDialog(
          context,
          message: 'Vui lòng nhập thời gian hợp lệ cho dịch vụ: ${s.name}',
        );
        return;
      }
    }

    final payloadServices = selectedServices
        .where((s) => !s.isSuggestion)
        .map(
          (s) => ProviderServiceInput(
            serviceId: s.id,
            proposedPriceAmount: s.proposedPrice ?? 0,
            durationMinutes: s.durationMinutes ?? s.defaultDuration,
            description: s.descriptionController.text.trim().isNotEmpty
                ? s.descriptionController.text.trim()
                : 'Cung cấp bởi đối tác Lambe',
          ),
        )
        .toList();

    final payloadSuggestions = selectedServices
        .where((s) => s.isSuggestion)
        .map(
          (s) => ServiceSuggestionInput(
            categoryId: s.categoryId!,
            name: s.name,
            description: s.descriptionController.text.trim().isEmpty
                ? null
                : s.descriptionController.text.trim(),
            proposedPriceAmount: s.proposedPrice ?? 0,
            durationMinutes: s.durationMinutes ?? s.defaultDuration,
          ),
        )
        .toList();

    final success = await ref
        .read(partnerNotifierProvider.notifier)
        .addServicesAndSuggestions(payloadServices, payloadSuggestions);

    if (success && mounted) {
      context.push('/partner/identity');
    }
  }

  void _showSuggestServiceModal() async {
    // Collect unique categories for dropdown
    final categories = <String, String>{};
    for (final service in _masterServices) {
      if (service.categoryId != null) {
        categories[service.categoryId!] = service.category;
      }
    }

    final result = await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PartnerSuggestServiceModal(categories: categories),
    );

    if (!mounted) return;
    if (result is PartnerServiceFormModel) {
      setState(() {
        _masterServices.insert(0, result);
        _searchQuery = '';
        _searchCtrl.clear();
        _selectedCategory = null;
      });
      AppDialogs.showMessageDialog(
        context,
        title: 'Thành công',
        message: 'Đã thêm dịch vụ đề xuất vào danh sách của bạn. Vui lòng bấm "Tiếp tục" để gửi hồ sơ.',
      );
    }
  }

  String _removeDiacritics(String str) {
    const withDia =
        'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ';
    const withoutDia =
        'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD';
    for (int i = 0; i < withDia.length; i++) {
      str = str.replaceAll(withDia[i], withoutDia[i]);
    }
    return str;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);

    // Split services into selected (isSaved) and unselected
    final selectedServices = _masterServices.where((s) => s.isSaved).toList();
    var unselectedServices = _masterServices.where((s) => !s.isSaved).toList();

    // Filter logic ONLY applies to unselected services
    if (_searchQuery.isNotEmpty) {
      final normalizedQuery = _removeDiacritics(_searchQuery).toLowerCase();
      unselectedServices = unselectedServices.where((s) {
        final normalizedName = _removeDiacritics(s.name).toLowerCase();
        return normalizedName.contains(normalizedQuery);
      }).toList();
    }
    if (_selectedCategory != null) {
      unselectedServices = unselectedServices
          .where((s) => s.category == _selectedCategory)
          .toList();
    }

    // Extract categories from ALL services
    final availableCategories = _masterServices
        .map((s) => s.category)
        .toSet()
        .toList();
    availableCategories.sort();

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Dịch vụ cung cấp',
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
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline, color: Color(0xFF0F766E)),
            onPressed: _showInstructionDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const PartnerRegistrationProgress(
              currentStep: PartnerRegistrationStep.services,
            ),
            // Header Search & Filter section
            Container(
              color: Colors.white,
              padding: const EdgeInsets.only(
                left: 20,
                right: 20,
                top: 8,
                bottom: 16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Chọn dịch vụ bạn chuyên môn',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Search Bar
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val),
                      decoration: const InputDecoration(
                        hintText: 'Tìm kiếm dịch vụ...',
                        hintStyle: TextStyle(
                          color: Color(0xFF9CA3AF),
                          fontSize: 14,
                        ),
                        prefixIcon: Icon(
                          Icons.search,
                          color: Color(0xFF6B7280),
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Categories Filter Row
                  if (availableCategories.isNotEmpty)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildFilterChip(
                            'Tất cả',
                            _selectedCategory == null,
                            () => setState(() => _selectedCategory = null),
                          ),
                          ...availableCategories.map(
                            (cat) => _buildFilterChip(
                              cat,
                              _selectedCategory == cat,
                              () => setState(() => _selectedCategory = cat),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),

            // List Services
            Expanded(
              child: _isLoadingData
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (unselectedServices.isNotEmpty) ...[
                            const Text(
                              'TẤT CẢ DỊCH VỤ',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF6B7280),
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 12),
                            ...unselectedServices.map(
                              (s) => PartnerServiceCard(
                                service: s,
                                onToggleExpand: () => setState(
                                  () => s.isExpanded = !s.isExpanded,
                                ),
                                onSave: () => setState(() {
                                  s.isSaved = true;
                                  s.isExpanded = false;
                                }),
                              ),
                            ),
                          ] else if (selectedServices.isEmpty) ...[
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.all(32.0),
                                child: Text(
                                  'Không tìm thấy dịch vụ phù hợp',
                                  style: TextStyle(color: Color(0xFF6B7280)),
                                ),
                              ),
                            ),
                          ],

                          if (selectedServices.isNotEmpty) ...[
                            const SizedBox(height: 24),
                            const Text(
                              'DỊCH VỤ ĐÃ CHỌN',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F766E),
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 12),
                            ...selectedServices.map(
                              (s) => PartnerCompactSelectedCard(
                                service: s,
                                onEdit: () => setState(() {
                                  s.isSaved = false;
                                  s.isExpanded = true;
                                }),
                                onRemove: () => setState(s.reset),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
            ),

            // Suggest button if not found
            if (!_isLoadingData)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: TextButton.icon(
                  onPressed: _showSuggestServiceModal,
                  icon: const Icon(
                    Icons.add_circle_outline,
                    color: Color(0xFF0F766E),
                  ),
                  label: const Text(
                    'Đề xuất dịch vụ mới',
                    style: TextStyle(
                      color: Color(0xFF0F766E),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),

            // Bottom Submit Button
            Container(
              padding: const EdgeInsets.all(20),
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
                  elevation: 0,
                ),
                child: state.isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
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

  Widget _buildFilterChip(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0B1C30) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(100),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF4B5563),
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
