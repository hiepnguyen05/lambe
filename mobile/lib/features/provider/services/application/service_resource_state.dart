class ServiceResourceState<T> {
  final T? value;
  final bool busy, uncertain;
  final String? error;
  const ServiceResourceState({
    this.value,
    this.busy = false,
    this.uncertain = false,
    this.error,
  });
  bool get blocked => busy || uncertain;
}
