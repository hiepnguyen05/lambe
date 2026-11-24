import 'package:equatable/equatable.dart';

class ProviderOrderExecutionState extends Equatable {
  final Map<String, dynamic>? order;
  final bool isLoading;
  final String? errorMessage;
  final bool isActionLoading;
  final bool cashReceivedChecked;
  final int inProgressSubStep;
  final Map<String, String> evidenceUrls;

  const ProviderOrderExecutionState({
    this.order,
    this.isLoading = true,
    this.errorMessage,
    this.isActionLoading = false,
    this.cashReceivedChecked = false,
    this.inProgressSubStep = 0,
    this.evidenceUrls = const {},
  });

  String? get status => order?['status']?.toString();

  bool get isTerminal {
    final s = status;
    return s == 'COMPLETED' ||
        s == 'CANCELLED' ||
        s == 'REJECTED' ||
        s == 'EXPIRED';
  }

  ProviderOrderExecutionState copyWith({
    Map<String, dynamic>? Function()? order,
    bool? isLoading,
    String? Function()? errorMessage,
    bool? isActionLoading,
    bool? cashReceivedChecked,
    int? inProgressSubStep,
    Map<String, String>? evidenceUrls,
  }) {
    return ProviderOrderExecutionState(
      order: order != null ? order() : this.order,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      isActionLoading: isActionLoading ?? this.isActionLoading,
      cashReceivedChecked: cashReceivedChecked ?? this.cashReceivedChecked,
      inProgressSubStep: inProgressSubStep ?? this.inProgressSubStep,
      evidenceUrls: evidenceUrls ?? this.evidenceUrls,
    );
  }

  @override
  List<Object?> get props => [
    order,
    isLoading,
    errorMessage,
    isActionLoading,
    cashReceivedChecked,
    inProgressSubStep,
    evidenceUrls,
  ];
}
