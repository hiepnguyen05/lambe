class ApiEndpoints {
  ApiEndpoints._();

  // Android Emulator maps 10.0.2.2 to the host machine where Docker exposes the API.
  // Use http://localhost:5000/api only when running through USB adb reverse.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000/api',
  );

  static const Duration connectionTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  // Auth Endpoints (Firebase-based)
  static const String exchangeFirebaseToken = '/auth/firebase';
  static const String checkPhoneLink = '/auth/firebase/phone-link-check';
  static const String completeRegistration = '/auth/complete-registration';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String meAvatar = '/auth/me/avatar';
  static const String mePushDevices = '/me/push-devices';
  static String mePushDevice(String id) => '$mePushDevices/$id';

  // Customer Onboarding
  static const String onboardingOptions = '/onboarding/options';
  static const String onboarding = '/me/onboarding';
  static const String onboardingComplete = '/me/onboarding/complete';
  static const String onboardingSkip = '/me/onboarding/skip';
  static const String serviceRecommendations = '/me/recommendations/services';

  // AI beauty consultation
  static const String aiConversations = '/me/ai-conversations';
  static String aiConversation(String id) => '$aiConversations/$id';
  static String aiConversationMessages(String id) =>
      '${aiConversation(id)}/messages';
  static String aiMessageRecommendations(String id, String clientMessageId) =>
      '${aiConversationMessages(id)}/${Uri.encodeComponent(clientMessageId)}/recommendations';
  static String aiConversationActions(String id) =>
      '${aiConversation(id)}/actions';
  static String feedPost(String id) => '/feed/posts/$id';

  // Categories & Services
  static const String categories = '/categories';
  static const String services = '/services';

  // Discovery
  static const String providerDiscoverySearch = '/discovery/providers/search';
  static String publicProviderProfile(String id) => '/providers/$id/public';

  // Customer Addresses
  static const String meAddresses = '/me/addresses';
  static String meAddress(String id) => '$meAddresses/$id';
  static String defaultAddress(String id) => '${meAddress(id)}/default';

  // Provider Applications
  static const String providerApplications = '/provider-applications';
  static String providerApplication(String id) => '$providerApplications/$id';
  static String providerApplicationServices(String id) =>
      '${providerApplication(id)}/services';
  static String providerServiceSuggestions(String id) =>
      '${providerApplication(id)}/service-suggestions';
  static String providerDocument(String id, String type) =>
      '${providerApplication(id)}/documents/$type';
  static String providerTerms(String id) =>
      '${providerApplication(id)}/terms/accept';
  static String providerSubmit(String id) =>
      '${providerApplication(id)}/submit';
  static const String providerServiceChanges =
      '/me/provider/service-change-requests';
  static String providerServiceChange(String id) =>
      '$providerServiceChanges/$id';

  // Provider Wallet
  static const String providerWallet = '/me/provider/wallet';
  static const String providerWalletTransactions =
      '/me/provider/wallet/transactions';
  static const String providerMomoTopup = '/me/provider/wallet/top-ups/momo';
  static const String providerSepayTopup = '/me/provider/wallet/top-ups/sepay';
  static String providerTopUpDetail(String id) =>
      '/me/provider/wallet/top-ups/$id';

  // Provider Schedule & Working Hours
  static const String providerSetup = '/me/provider/setup';
  static const String providerCalendar = '/me/provider/calendar';
  static const String providerTimeOff = '/me/provider/calendar/time-off';
  static String providerTimeOffItem(String id) => '$providerTimeOff/$id';

  // Booking & Orders
  static const String ordersQuote = '/orders/quote';
  static const String orders = '/orders';
  static const String meOrders = '/me/orders';
  static String meOrder(String id) => '$meOrders/$id';
  static String rematchCandidates(String id) =>
      '${meOrder(id)}/rematch-candidates';
  static String retryOrder(String id) => '${meOrder(id)}/retry';
  static String orderTracking(String id) => '${meOrder(id)}/tracking';
  static String orderTrackingEvents(String id) => '${orderTracking(id)}/events';
  static String providerOrderLocation(String id) =>
      '${meProviderOrder(id)}/location';
  static String cancelMeOrder(String id) => '${meOrder(id)}/cancel';
  static String decideOrderCancellation(String id) =>
      '${meOrder(id)}/cancellation/decision';
  static String orderReview(String id) => '${meOrder(id)}/review';
  static String orderEvidence(String orderId, String evidenceId) =>
      '/orders/$orderId/evidence/$evidenceId';
  static String providerAvailability(String providerId) =>
      '/providers/$providerId/availability';
  static String providerReviews(String providerId) =>
      '/providers/$providerId/reviews';

  // Provider Orders (Đối tác nhận đơn)
  static const String meProviderOrders = '/me/provider/orders';
  static String meProviderOrder(String id) => '$meProviderOrders/$id';
  static String acceptProviderOrder(String id) =>
      '${meProviderOrder(id)}/accept';
  static String rejectProviderOrder(String id) =>
      '${meProviderOrder(id)}/reject';
  static String cancelProviderOrder(String id) =>
      '${meProviderOrder(id)}/cancel';
  static String enRouteProviderOrder(String id) =>
      '${meProviderOrder(id)}/en-route';
  static String arriveProviderOrder(String id) =>
      '${meProviderOrder(id)}/arrive';
  static String startProviderOrder(String id) => '${meProviderOrder(id)}/start';
  static String completeProviderOrder(String id) =>
      '${meProviderOrder(id)}/complete';
  static String providerOrderPaymentDispute(String id) =>
      '${meProviderOrder(id)}/payment-dispute';
  static String providerOrderEvidence(String id, String type) =>
      '${meProviderOrder(id)}/evidence/$type';
  static String providerOrderContactAttempt(String id) =>
      '${meProviderOrder(id)}/contact-attempt';
  static String providerOrderCancellationRequest(String id) =>
      '${meProviderOrder(id)}/cancellation-request';

  // Notifications
  static const String meNotifications = '/me/notifications';
  static const String notificationEvents = '/me/notifications/events';
  static String markNotificationRead(String id) => '$meNotifications/$id/read';

  // Vouchers
  static String eligibleVouchers(String providerServiceId) =>
      '/me/vouchers?providerServiceId=$providerServiceId';
  static const String meProviderVouchers = '/me/provider/vouchers';
  static String disableProviderVoucher(String id) =>
      '/me/provider/vouchers/$id/disable';

  // Chat
  static const String meConversations = '/me/conversations';
  static String meConversation(String id) => '$meConversations/$id';
  static String meConversationMessages(String id) =>
      '${meConversation(id)}/messages';
  static String meConversationEvents(String id) =>
      '${meConversation(id)}/events';
  static String meConversationImages(String id) =>
      '${meConversation(id)}/images';
  static String meConversationRead(String id) => '${meConversation(id)}/read';
  static String meConversationBlock(String id) => '${meConversation(id)}/block';
  static String meConversationReports(String id) =>
      '${meConversation(id)}/reports';
}
