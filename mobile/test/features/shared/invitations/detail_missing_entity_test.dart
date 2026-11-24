import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/members/di/provider_members_providers.dart';
import 'package:mobile/features/provider/members/domain/entities/provider_member_entity.dart';
import 'package:mobile/features/provider/members/domain/repositories/provider_members_repository.dart';
import 'package:mobile/features/provider/members/presentation/screens/provider_member_detail_screen.dart';
import 'package:mobile/features/shared/invitations/di/invitations_providers.dart';
import 'package:mobile/features/shared/invitations/domain/entities/received_invitation_entity.dart';
import 'package:mobile/features/shared/invitations/domain/repositories/invitations_repository.dart';
import 'package:mobile/features/shared/invitations/presentation/screens/invitation_detail_screen.dart';

void main() {
  final member = ProviderMemberEntity(
    id: 'missing',
    providerId: 'p',
    userId: 'u',
    role: 'WORKER',
    status: 'ACTIVE',
    canProvideServices: true,
    displayName: 'Stale member',
    joinedAt: DateTime.utc(2026),
    membershipVersion: 1,
  );
  final invitation = ReceivedInvitationEntity(
    id: 'missing',
    providerId: 'p',
    phone: '',
    status: 'PENDING',
    providerDisplayName: 'Stale organization',
    createdAt: DateTime.utc(2026),
    expiresAt: DateTime.now().add(const Duration(days: 1)),
  );

  testWidgets(
    'missing member ignores stale route snapshot and hides mutations',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            providerMembersRepositoryProvider.overrideWithValue(_Members()),
          ],
          child: MaterialApp(
            home: ProviderMemberDetailScreen(
              memberId: 'missing',
              initialMember: member,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Không tìm thấy nhân viên trong danh sách hiện tại.'),
        findsOneWidget,
      );
      expect(find.text('Stale member'), findsNothing);
      expect(find.text('Tạm đình chỉ nhân viên này'), findsNothing);
    },
  );

  testWidgets('member network failure has retry instead of a fake employee', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          providerMembersRepositoryProvider.overrideWithValue(
            _Members(fail: true),
          ),
        ],
        child: const MaterialApp(
          home: ProviderMemberDetailScreen(memberId: 'missing'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chưa tải được hồ sơ nhân viên.'), findsOneWidget);
    expect(find.text('Tải lại danh sách'), findsOneWidget);
  });

  testWidgets(
    'missing invitation ignores stale snapshot and hides accept form',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invitationsRepositoryProvider.overrideWithValue(_Invitations()),
          ],
          child: MaterialApp(
            home: InvitationDetailScreen(
              invitationId: 'missing',
              initialInvitation: invitation,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Không tìm thấy lời mời trong danh sách hiện tại.'),
        findsOneWidget,
      );
      expect(find.text('Stale organization'), findsNothing);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('Đồng ý gia nhập cơ sở'), findsNothing);
    },
  );

  testWidgets('invitation failure has retry instead of fake organization', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          invitationsRepositoryProvider.overrideWithValue(
            _Invitations(fail: true),
          ),
        ],
        child: const MaterialApp(
          home: InvitationDetailScreen(invitationId: 'missing'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chưa tải được lời mời.'), findsOneWidget);
    expect(find.text('Tải lại danh sách'), findsOneWidget);
  });
}

class _Members implements ProviderMembersRepository {
  final bool fail;
  _Members({this.fail = false});
  @override
  Future<List<ProviderMemberEntity>> getMembers({
    int page = 1,
    int limit = 50,
  }) async {
    if (fail) throw StateError('offline');
    return [];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Invitations implements InvitationsRepository {
  final bool fail;
  _Invitations({this.fail = false});
  @override
  Future<List<ReceivedInvitationEntity>> getMyInvitations() async {
    if (fail) throw StateError('offline');
    return [];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
