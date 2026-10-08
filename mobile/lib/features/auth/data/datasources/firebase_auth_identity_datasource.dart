import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../domain/exceptions/auth_flow_exception.dart';
import 'auth_identity_datasource.dart';

class FirebaseAuthIdentityDataSource implements AuthIdentityDataSource {
  final FirebaseAuth _firebaseAuth;
  final GoogleSignIn _googleSignIn;
  final FacebookAuth _facebookAuth;

  FirebaseAuthIdentityDataSource({
    FirebaseAuth? firebaseAuth,
    GoogleSignIn? googleSignIn,
    FacebookAuth? facebookAuth,
  }) : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
       _googleSignIn = googleSignIn ?? GoogleSignIn.instance,
       _facebookAuth = facebookAuth ?? FacebookAuth.instance;

  @override
  Future<void> sendOtp(
    String phone, {
    required bool isLinking,
    required void Function(String verificationId) onCodeSent,
    required IdentityTokenCallback onAutoVerified,
    required IdentityErrorCallback onError,
  }) async {
    final normalizedPhone = phone.startsWith('0')
        ? '+84${phone.substring(1)}'
        : phone.startsWith('+')
        ? phone
        : '+84$phone';

    await _firebaseAuth.verifyPhoneNumber(
      phoneNumber: normalizedPhone,
      verificationCompleted: (credential) async {
        try {
          await _authenticateWithCredential(credential, isLinking: isLinking);
          await onAutoVerified(await _requiredIdToken(forceRefresh: true));
        } catch (error, stack) {
          onError(error, stack);
        }
      },
      verificationFailed: (error) => onError(error, StackTrace.current),
      codeSent: (verificationId, _) => onCodeSent(verificationId),
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  @override
  Future<String> verifyOtp(
    String verificationId,
    String smsCode, {
    required bool isLinking,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    await _authenticateWithCredential(credential, isLinking: isLinking);
    return _requiredIdToken(forceRefresh: true);
  }

  @override
  Future<String?> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.authenticate();
      final credential = GoogleAuthProvider.credential(
        idToken: googleUser.authentication.idToken,
      );
      await _firebaseAuth.signInWithCredential(credential);
      return await _requiredIdToken();
    } on GoogleSignInException {
      return null;
    }
  }

  @override
  Future<String?> signInWithFacebook() async {
    final result = await _facebookAuth.login();
    if (result.status == LoginStatus.cancelled) {
      return null;
    }
    if (result.status != LoginStatus.success || result.accessToken == null) {
      throw AuthenticationFailure(
        result.message ?? 'Không thể đăng nhập bằng Facebook.',
      );
    }

    final credential = FacebookAuthProvider.credential(
      result.accessToken!.tokenString,
    );
    await _firebaseAuth.signInWithCredential(credential);
    return _requiredIdToken();
  }

  @override
  Future<void> signOut() async {
    await _firebaseAuth.signOut();
    await _facebookAuth.logOut();
    await _googleSignIn.signOut();
  }

  Future<void> _authenticateWithCredential(
    AuthCredential credential, {
    required bool isLinking,
  }) async {
    final currentUser = _firebaseAuth.currentUser;
    if (isLinking && currentUser != null) {
      await currentUser.linkWithCredential(credential);
    } else {
      await _firebaseAuth.signInWithCredential(credential);
    }
  }

  Future<String> _requiredIdToken({bool forceRefresh = false}) async {
    final token = await _firebaseAuth.currentUser?.getIdToken(forceRefresh);
    if (token == null || token.isEmpty) {
      throw const AuthenticationFailure('Không lấy được mã xác thực Firebase.');
    }
    return token;
  }
}
