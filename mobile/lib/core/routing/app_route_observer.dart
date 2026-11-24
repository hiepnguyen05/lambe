import 'package:flutter/material.dart';

final appRouteObserver = RouteObserver<PageRoute<dynamic>>();

mixin RouteVisibility<T extends StatefulWidget>
    on State<T>, WidgetsBindingObserver, RouteAware {
  PageRoute<dynamic>? _observedRoute;
  bool _appActive = true;
  bool _routeActive = true;
  bool? _lastVisible;

  void onVisibilityChanged(bool visible);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute<dynamic> && route != _observedRoute) {
      appRouteObserver.unsubscribe(this);
      _observedRoute = route;
      appRouteObserver.subscribe(this, route);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appActive = state == AppLifecycleState.resumed;
    _notifyVisibility();
  }

  @override
  void didPush() {
    _routeActive = _observedRoute?.isCurrent ?? true;
    _notifyVisibility();
  }

  @override
  void didPopNext() => didPush();

  @override
  void didPushNext() {
    _routeActive = false;
    _notifyVisibility();
  }

  @override
  void didPop() {
    _routeActive = false;
    _notifyVisibility();
  }

  void _notifyVisibility() {
    final visible = _appActive && _routeActive;
    if (_lastVisible == visible) return;
    _lastVisible = visible;
    onVisibilityChanged(visible);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    appRouteObserver.unsubscribe(this);
    super.dispose();
  }
}
