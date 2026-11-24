enum SplashTargetRoute {
  auth('/auth'),
  onboarding('/onboarding'),
  providerHome('/provider/home'),
  customerHome('/home');

  final String path;
  const SplashTargetRoute(this.path);
}
