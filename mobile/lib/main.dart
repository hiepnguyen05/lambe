import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:mobile/firebase_options.dart';
import 'package:mobile/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  await initializeDateFormatting('vi_VN', null);

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await GoogleSignIn.instance.initialize(
      serverClientId: '430572073413-9lsv8a7gd88duqris9v92g5di18hqd68.apps.googleusercontent.com',
    );
    debugPrint('✅ Firebase initialized successfully.');
  } catch (e) {
    debugPrint('⚠️ Firebase initialization failed: $e');
  }

  runApp(const ProviderScope(child: LambeApp()));
}
