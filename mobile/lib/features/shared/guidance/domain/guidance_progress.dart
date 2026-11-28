class GuidanceProgress {
  final String tourId, status;
  final int version, stepIndex;
  final bool pendingSync;
  const GuidanceProgress({
    required this.tourId,
    required this.status,
    required this.version,
    required this.stepIndex,
    this.pendingSync = false,
  });
  factory GuidanceProgress.fromJson(Map<String, dynamic> json) =>
      GuidanceProgress(
        tourId: json['tourId'] as String,
        status: json['status'] as String,
        version: (json['version'] as num).toInt(),
        stepIndex: (json['stepIndex'] as num).toInt(),
        pendingSync: json['pendingSync'] == true,
      );
  GuidanceProgress get synced => GuidanceProgress(
    tourId: tourId,
    status: status,
    version: version,
    stepIndex: stepIndex,
  );
  Map<String, dynamic> toJson() => {
    'tourId': tourId,
    'status': status,
    'version': version,
    'stepIndex': stepIndex,
    'pendingSync': pendingSync,
  };
}
