import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../di/onboarding_providers.dart';
import '../widgets/audience_step_widget.dart';
import '../widgets/category_step_widget.dart';
import '../widgets/gender_step_widget.dart';
import '../widgets/onboarding_progress_bar.dart';
import '../widgets/price_step_widget.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  final bool isEditingPreferences;

  const OnboardingScreen({super.key, this.isEditingPreferences = false});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  final int _totalPages = 4;

  void _nextPage() {
    if (_currentPage == 2 &&
        ref.read(onboardingNotifierProvider).categoryIds.isEmpty) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Hãy chọn ít nhất một danh mục quan tâm.'),
          ),
        );
      return;
    }

    if (_currentPage < _totalPages - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _submit();
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _submit() async {
    final notifier = ref.read(onboardingNotifierProvider.notifier);
    final success = widget.isEditingPreferences
        ? await notifier.savePreferences()
        : await notifier.completeOnboarding();
    if (success && mounted) {
      if (widget.isEditingPreferences) {
        context.pop();
        return;
      }
      if (GoRouter.of(context).canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    }
  }

  Future<void> _skip() async {
    final success = await ref
        .read(onboardingNotifierProvider.notifier)
        .skipOnboarding();
    if (success && mounted) {
      if (GoRouter.of(context).canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(onboardingNotifierProvider);

    ref.listen<OnboardingState>(onboardingNotifierProvider, (prev, next) {
      if (prev?.error == null && next.error != null) {
        AppDialogs.showErrorDialog(context, message: next.error!);
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: widget.isEditingPreferences
            ? const Text(
                'Sở thích làm đẹp',
                style: TextStyle(
                  color: Color(0xFF0B1C30),
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              )
            : null,
        centerTitle: true,
        leading: _currentPage > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
                onPressed: _previousPage,
              )
            : widget.isEditingPreferences
            ? IconButton(
                icon: const Icon(Icons.close, color: Color(0xFF0B1C30)),
                onPressed: () => context.pop(),
              )
            : null,
        actions: [
          if (!widget.isEditingPreferences)
            TextButton(
              onPressed: state.isLoading ? null : _skip,
              child: const Text(
                'Bỏ qua',
                style: TextStyle(
                  color: Color(0xFF005C55),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            OnboardingProgressBar(
              totalPages: _totalPages,
              currentPage: _currentPage,
            ),
            Expanded(
              child: state.isLoading && state.options == null
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF0F766E),
                      ),
                    )
                  : PageView(
                      controller: _pageController,
                      physics: const NeverScrollableScrollPhysics(),
                      onPageChanged: (idx) {
                        setState(() {
                          _currentPage = idx;
                        });
                      },
                      children: const [
                        GenderStepWidget(),
                        AudienceStepWidget(),
                        CategoryStepWidget(),
                        PriceStepWidget(),
                      ],
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: state.isLoading ? null : _nextPage,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
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
                      : Text(
                          _currentPage == _totalPages - 1
                              ? widget.isEditingPreferences
                                    ? 'Lưu thay đổi'
                                    : 'Hoàn tất'
                              : 'Tiếp tục',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
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
