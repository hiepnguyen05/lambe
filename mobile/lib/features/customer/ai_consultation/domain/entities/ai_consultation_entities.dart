import 'package:equatable/equatable.dart';

class AiSuggestedServiceEntity extends Equatable {
  final String id;
  final String name;
  final String slug;
  final int minPriceAmount;
  final int maxPriceAmount;
  final String currencyCode;

  const AiSuggestedServiceEntity({
    required this.id,
    required this.name,
    this.slug = '',
    required this.minPriceAmount,
    required this.maxPriceAmount,
    this.currencyCode = 'VND',
  });

  factory AiSuggestedServiceEntity.fromJson(Map<String, dynamic> json) {
    return AiSuggestedServiceEntity(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Dịch vụ Lambe',
      slug: json['slug']?.toString() ?? '',
      minPriceAmount: (json['minPriceAmount'] as num?)?.toInt() ?? 0,
      maxPriceAmount: (json['maxPriceAmount'] as num?)?.toInt() ?? 0,
      currencyCode: json['currencyCode']?.toString() ?? 'VND',
    );
  }

  @override
  List<Object?> get props => [
    id,
    name,
    slug,
    minPriceAmount,
    maxPriceAmount,
    currencyCode,
  ];
}

class AiSuggestedProviderEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final String? biography;
  final int experienceYears;
  final String? serviceAreaName;
  final double distanceKm;
  final int? estimatedTravelFeeAmount;
  final bool available;
  final String providerServiceId;
  final String serviceName;
  final int priceAmount;
  final int durationMinutes;

  const AiSuggestedProviderEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.biography,
    this.experienceYears = 0,
    this.serviceAreaName,
    required this.distanceKm,
    this.estimatedTravelFeeAmount,
    this.available = true,
    required this.providerServiceId,
    this.serviceName = 'Dịch vụ làm đẹp',
    required this.priceAmount,
    required this.durationMinutes,
  });

  factory AiSuggestedProviderEntity.fromJson(Map<String, dynamic> json) {
    final service = json['service'] is Map
        ? Map<String, dynamic>.from(json['service'] as Map)
        : <String, dynamic>{};
    final catalogService = service['service'] is Map
        ? Map<String, dynamic>.from(service['service'] as Map)
        : <String, dynamic>{};
    return AiSuggestedProviderEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
      biography: json['biography']?.toString(),
      experienceYears: (json['experienceYears'] as num?)?.toInt() ?? 0,
      serviceAreaName: json['serviceAreaName']?.toString(),
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
      estimatedTravelFeeAmount: (json['estimatedTravelFeeAmount'] as num?)
          ?.toInt(),
      available: json['available'] != false,
      providerServiceId: service['id']?.toString() ?? '',
      serviceName: catalogService['name']?.toString() ?? 'Dịch vụ làm đẹp',
      priceAmount: (service['priceAmount'] as num?)?.toInt() ?? 0,
      durationMinutes: (service['durationMinutes'] as num?)?.toInt() ?? 60,
    );
  }

  @override
  List<Object?> get props => [
    id,
    displayName,
    avatarUrl,
    biography,
    experienceYears,
    serviceAreaName,
    distanceKm,
    estimatedTravelFeeAmount,
    available,
    providerServiceId,
    serviceName,
    priceAmount,
    durationMinutes,
  ];
}

class AiCitationEntity extends Equatable {
  final String title;
  final String url;

  const AiCitationEntity({required this.title, required this.url});

  factory AiCitationEntity.fromJson(Map<String, dynamic> json) {
    return AiCitationEntity(
      title: json['title']?.toString() ?? 'Nguồn tham khảo',
      url: json['url']?.toString() ?? '',
    );
  }

  @override
  List<Object?> get props => [title, url];
}

class AiSuggestedPostEntity extends Equatable {
  final String id;
  final String providerId;
  final String providerName;
  final String serviceName;
  final String mediaKind;
  final String? thumbnailUrl;
  final String mediaUrl;

  const AiSuggestedPostEntity({
    required this.id,
    required this.providerId,
    required this.providerName,
    required this.serviceName,
    required this.mediaKind,
    required this.thumbnailUrl,
    required this.mediaUrl,
  });

  factory AiSuggestedPostEntity.fromJson(Map<String, dynamic> json) {
    final provider = json['provider'] is Map
        ? Map<String, dynamic>.from(json['provider'] as Map)
        : <String, dynamic>{};
    final service = json['service'] is Map
        ? Map<String, dynamic>.from(json['service'] as Map)
        : <String, dynamic>{};
    return AiSuggestedPostEntity(
      id: json['id']?.toString() ?? '',
      providerId: provider['id']?.toString() ?? '',
      providerName: provider['displayName']?.toString() ?? '',
      serviceName: service['name']?.toString() ?? '',
      mediaKind: json['mediaKind']?.toString() ?? 'IMAGE',
      thumbnailUrl: json['thumbnailUrl']?.toString(),
      mediaUrl: json['mediaUrl']?.toString() ?? '',
    );
  }

  @override
  List<Object?> get props => [
    id,
    providerId,
    providerName,
    serviceName,
    mediaKind,
    thumbnailUrl,
    mediaUrl,
  ];
}

class AiNextActionEntity extends Equatable {
  final String type;
  final String label;
  final String? targetId;

  const AiNextActionEntity({
    required this.type,
    required this.label,
    this.targetId,
  });

  factory AiNextActionEntity.fromJson(Map<String, dynamic> json) =>
      AiNextActionEntity(
        type: json['type']?.toString() ?? '',
        label: json['label']?.toString() ?? '',
        targetId: json['targetId']?.toString(),
      );

  @override
  List<Object?> get props => [type, label, targetId];
}

class AiConsultationReplyEntity extends Equatable {
  final String clientMessageId;
  final String reply;
  final String intent;
  final String nextAction;
  final String? followUpQuestion;
  final String? conversionPrompt;
  final bool degradedMode;
  final bool suggestionsExpired;
  final List<AiSuggestedServiceEntity> suggestedServices;
  final List<AiSuggestedProviderEntity> suggestedProviders;
  final List<AiSuggestedPostEntity> suggestedPosts;
  final List<AiNextActionEntity> nextActions;
  final List<AiCitationEntity> citations;

  const AiConsultationReplyEntity({
    this.clientMessageId = '',
    required this.reply,
    required this.intent,
    required this.nextAction,
    this.followUpQuestion,
    this.conversionPrompt,
    this.degradedMode = false,
    this.suggestionsExpired = false,
    this.suggestedServices = const [],
    this.suggestedProviders = const [],
    this.suggestedPosts = const [],
    this.nextActions = const [],
    this.citations = const [],
  });

  factory AiConsultationReplyEntity.fromJson(Map<String, dynamic> json) {
    return AiConsultationReplyEntity(
      clientMessageId: json['clientMessageId']?.toString() ?? '',
      reply: json['reply']?.toString() ?? '',
      intent: json['intent']?.toString() ?? 'CONSULTATION',
      nextAction: json['nextAction']?.toString() ?? 'CONTINUE_CONSULTATION',
      followUpQuestion: json['followUpQuestion']?.toString(),
      conversionPrompt: json['conversionPrompt']?.toString(),
      degradedMode: json['degradedMode'] == true,
      suggestionsExpired: json['suggestionsExpired'] == true,
      suggestedServices: _maps(json['suggestedServices'])
          .map(AiSuggestedServiceEntity.fromJson)
          .toList(growable: false),
      suggestedProviders: _maps(json['suggestedProviders'])
          .map(AiSuggestedProviderEntity.fromJson)
          .toList(growable: false),
      suggestedPosts: _maps(json['suggestedPosts'])
          .map(AiSuggestedPostEntity.fromJson)
          .toList(growable: false),
      nextActions: _maps(json['nextActions'])
          .map(AiNextActionEntity.fromJson)
          .toList(growable: false),
      citations: _maps(json['citations'])
          .map(AiCitationEntity.fromJson)
          .where((item) => item.url.startsWith('https://'))
          .toList(growable: false),
    );
  }

  static Iterable<Map<String, dynamic>> _maps(dynamic value) {
    if (value is! List) return const [];
    return value.whereType<Map>().map(Map<String, dynamic>.from);
  }

  @override
  List<Object?> get props => [
    clientMessageId,
    reply,
    intent,
    nextAction,
    followUpQuestion,
    conversionPrompt,
    degradedMode,
    suggestionsExpired,
    suggestedServices,
    suggestedProviders,
    suggestedPosts,
    nextActions,
    citations,
  ];
}

class AiConsultationMessageEntity extends Equatable {
  final String id;
  final String role;
  final String text;
  final DateTime createdAt;
  final AiConsultationReplyEntity? result;
  final bool isPending;
  final bool hasError;
  final bool isRefreshingRecommendations;
  final bool recommendationsRefreshFailed;

  const AiConsultationMessageEntity({
    required this.id,
    required this.role,
    required this.text,
    required this.createdAt,
    this.result,
    this.isPending = false,
    this.hasError = false,
    this.isRefreshingRecommendations = false,
    this.recommendationsRefreshFailed = false,
  });

  bool get isUser => role == 'user';

  factory AiConsultationMessageEntity.fromJson(Map<String, dynamic> json) {
    final result = json['result'];
    return AiConsultationMessageEntity(
      id: json['id']?.toString() ?? '',
      role: json['role']?.toString() ?? 'assistant',
      text: json['text']?.toString() ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      result: result is Map
          ? AiConsultationReplyEntity.fromJson(
              Map<String, dynamic>.from(result),
            )
          : null,
    );
  }

  AiConsultationMessageEntity copyWith({
    bool? isPending,
    bool? hasError,
    AiConsultationReplyEntity? result,
    bool? isRefreshingRecommendations,
    bool? recommendationsRefreshFailed,
  }) {
    return AiConsultationMessageEntity(
      id: id,
      role: role,
      text: text,
      createdAt: createdAt,
      result: result ?? this.result,
      isPending: isPending ?? this.isPending,
      hasError: hasError ?? this.hasError,
      isRefreshingRecommendations:
          isRefreshingRecommendations ?? this.isRefreshingRecommendations,
      recommendationsRefreshFailed:
          recommendationsRefreshFailed ?? this.recommendationsRefreshFailed,
    );
  }

  @override
  List<Object?> get props => [
    id,
    role,
    text,
    createdAt,
    result,
    isPending,
    hasError,
    isRefreshingRecommendations,
    recommendationsRefreshFailed,
  ];
}
