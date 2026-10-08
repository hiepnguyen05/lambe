import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/onboarding_options_entity.dart';
import '../domain/entities/onboarding_preferences.dart';
import '../domain/repositories/onboarding_repository.dart';

class OnboardingState {
  static const maxCategorySelections = 3;

  final bool isLoading;
  final String? error;
  final OnboardingOptionsEntity? options;
  final String? gender;
  final String? preferredAudience;
  final List<String> categoryIds;
  final String? pricePreference;

  const OnboardingState({
    this.isLoading = false,
    this.error,
    this.options,
    this.gender,
    this.preferredAudience,
    this.categoryIds = const [],
    this.pricePreference,
  });

  OnboardingState copyWith({
    bool? isLoading,
    String? error,
    OnboardingOptionsEntity? options,
    String? gender,
    String? preferredAudience,
    List<String>? categoryIds,
    String? pricePreference,
  }) {
    return OnboardingState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      options: options ?? this.options,
      gender: gender ?? this.gender,
      preferredAudience: preferredAudience ?? this.preferredAudience,
      categoryIds: categoryIds ?? this.categoryIds,
      pricePreference: pricePreference ?? this.pricePreference,
    );
  }
}

class OnboardingNotifier extends StateNotifier<OnboardingState> {
  final OnboardingRepository _repository;
  final void Function(String status) _updateSessionStatus;

  OnboardingNotifier(this._repository, this._updateSessionStatus)
    : super(const OnboardingState()) {
    _loadData();
  }

  Future<void> _loadData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final results = await Future.wait<Object>([
        _repository.getOptions(),
        _repository.getCurrentPreferences(),
      ]);
      final options = results[0] as OnboardingOptionsEntity;
      final preferences = results[1] as OnboardingPreferences;
      state = state.copyWith(
        isLoading: false,
        options: options,
        gender: preferences.gender,
        preferredAudience: preferences.preferredAudience,
        categoryIds: preferences.categoryIds,
        pricePreference: preferences.pricePreference,
      );
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
    }
  }

  void updateGender(String gender) => state = state.copyWith(gender: gender);

  void updatePreferredAudience(String audience) {
    state = state.copyWith(preferredAudience: audience);
  }

  bool toggleCategory(String categoryId) {
    final ids = [...state.categoryIds];
    if (ids.contains(categoryId)) {
      ids.remove(categoryId);
    } else {
      if (ids.length >= OnboardingState.maxCategorySelections) return false;
      ids.add(categoryId);
    }
    state = state.copyWith(categoryIds: ids);
    return true;
  }

  void updatePricePreference(String price) {
    state = state.copyWith(pricePreference: price);
  }

  OnboardingPreferences _currentPreferences() {
    return OnboardingPreferences(
      gender: state.gender,
      preferredAudience: state.preferredAudience,
      categoryIds: state.categoryIds,
      pricePreference: state.pricePreference,
    );
  }

  Future<bool> savePreferences() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.saveOnboardingData(_currentPreferences());
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<bool> completeOnboarding() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final preferences = _currentPreferences();
      if (!preferences.isEmpty) {
        await _repository.saveOnboardingData(preferences);
      }
      await _repository.completeOnboarding();
      _updateSessionStatus('COMPLETED');
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }

  Future<bool> skipOnboarding() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.skipOnboarding();
      _updateSessionStatus('SKIPPED');
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      return false;
    }
  }
}
